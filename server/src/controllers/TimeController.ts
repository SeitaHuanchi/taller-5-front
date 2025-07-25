import type { Request, Response } from "express";
import { 
  cristianSyncAlgorithm, 
  getHighPrecisionTime, 
  hrtimeToMs, 
  formatTime,
  calculateSyncStats,
  isReliableSync,
  SyncResult
} from "../utils/timeUtils";
import { 
  ntpMetricsManager, 
  getNTPTimeWithCircuitBreaker,
  primaryNTPBreaker,
  secondaryNTPBreaker
} from "../config/ntpConfig";
import { logger, logSyncAttempt, logSyncSuccess, logSyncFailure } from "../utils/logger";

export class TimeController {
  
  // Almacenar resultados de sincronización por cliente
  private static syncHistory: Map<string, SyncResult[]> = new Map();

  /**
   * GET /api/time - Obtener hora actual del servidor
   */
  static getCurrentTime = async (req: Request, res: Response) => {
    try {
      const serverTime = Date.now();
      const highPrecisionTime = getHighPrecisionTime();
      
      logger.info('⏰ Solicitud de tiempo actual', {
        serverTime: formatTime(serverTime),
        precision: hrtimeToMs(highPrecisionTime)
      });

      res.json({
        success: true,
        serverTime,
        serverTimeFormatted: formatTime(serverTime),
        highPrecisionTime: hrtimeToMs(highPrecisionTime),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('❌ Error obteniendo tiempo actual', { error: error instanceof Error ? error.message : error });
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor al obtener tiempo'
      });
    }
  };

  /**
   * POST /api/time/sync - Sincronizar tiempo usando algoritmo de Cristian
   */
  static syncTime = async (req: Request, res: Response) => {
    console.log('🔥 [SYNC DEBUG] Request received to /api/time/sync');
    console.log('🔥 [SYNC DEBUG] Request body:', req.body);
    console.log('🔥 [SYNC DEBUG] Request headers:', req.headers);
    
    const clientId = req.headers['x-client-id'] as string || `client-${Date.now()}`;
    const { clientRequestTime } = req.body;

    // Validar parámetros
    if (!clientRequestTime) {
      console.log('🔥 [SYNC DEBUG] Missing clientRequestTime!');
      return res.status(400).json({
        success: false,
        error: 'clientRequestTime es requerido'
      });
    }

    console.log('🔥 [SYNC DEBUG] Valid request, proceeding with sync...');
    try {
      // El parámetro debe ser number, no bigint
      const requestTimeMs = Number(clientRequestTime);
      logSyncAttempt(clientId, 'ntp.shoa.cl');
      
      // Ejecutar algoritmo de Cristian
      const syncResult = await cristianSyncAlgorithm(requestTimeMs);
      
      // Registrar histórico de sincronización
      if (!this.syncHistory.has(clientId)) {
        this.syncHistory.set(clientId, []);
      }
      
      const clientHistory = this.syncHistory.get(clientId)!;
      clientHistory.push(syncResult);
      
      // Mantener solo los últimos 50 resultados por cliente
      if (clientHistory.length > 50) {
        clientHistory.splice(0, clientHistory.length - 50);
      }

      if (syncResult.success) {
        logSyncSuccess(syncResult, clientId);
        
        // Calcular estadísticas del cliente
        const stats = calculateSyncStats(clientHistory);
        const isReliable = isReliableSync(syncResult);
        
        res.json({
          success: true,
          syncResult,
          isReliable,
          stats,
          recommendations: this.generateRecommendations(syncResult, stats),
          clientId,
          serverProcessingTime: Date.now() - requestTimeMs
        });
        
      } else {
        logSyncFailure(syncResult.error || 'Error desconocido', clientId, 'unknown');
        
        res.status(503).json({
          success: false,
          syncResult,
          error: syncResult.error,
          clientId,
          fallbackTime: Date.now()
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      logSyncFailure(errorMessage, clientId, 'server');
      
      logger.error('❌ Error en sincronización', { 
        error: errorMessage, 
        clientId,
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor durante sincronización',
        clientId,
        fallbackTime: Date.now()
      });
    }
  };

  /**
   * GET /api/time/health - Verificar estado del servidor de tiempo
   */
  static getHealthStatus = async (req: Request, res: Response) => {
    try {
      const healthStatus = ntpMetricsManager.getHealthStatus();
      const allMetrics = ntpMetricsManager.getAllMetrics();
      const logStats = logger.getLogStats();
      
      // Debug: Log del health status generado
      console.log('=== BACKEND HEALTH DEBUG ===');
      console.log('Raw healthStatus from ntpMetricsManager:', JSON.stringify(healthStatus, null, 2));
      
      // Reportar estado de conectividad basado en circuit breakers (sin hacer requests reales)
      const connectivity = [
        { 
          server: 'ntp.shoa.cl', 
          status: primaryNTPBreaker.closed ? 'ok' : primaryNTPBreaker.opened ? 'failed' : 'degraded' 
        },
        { 
          server: 'pool.ntp.org', 
          status: secondaryNTPBreaker.closed ? 'ok' : secondaryNTPBreaker.opened ? 'failed' : 'degraded' 
        }
      ];
      
      console.log('Connectivity status (from circuit breakers):', connectivity);

      logger.info('🏥 Verificación de salud del sistema', { healthStatus: healthStatus.overall });

      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        overall: healthStatus.overall,
        servers: healthStatus,
        metrics: allMetrics,
        connectivity,
        logging: {
          totalLogs: logStats.total,
          errorCount: logStats.byLevel.ERROR,
          recentErrorsCount: logStats.recentErrors.length
        },
        activeClients: this.getActiveClientsCount(),
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      };
      
      console.log('Final response being sent:', JSON.stringify(response, null, 2));
      console.log('=== BACKEND HEALTH DEBUG END ===');

      res.json(response);

    } catch (error) {
      logger.error('❌ Error verificando salud del sistema', { error: error instanceof Error ? error.message : error });
      
      res.status(500).json({
        success: false,
        error: 'Error verificando estado del sistema',
        timestamp: new Date().toISOString()
      });
    }
  };

  /**
   * GET /api/time/metrics - Obtener métricas detalladas
   */
  static getMetrics = async (req: Request, res: Response) => {
    try {
      const { clientId, server, period } = req.query;
      
      const allMetrics = ntpMetricsManager.getAllMetrics();
      const logStats = logger.getLogStats();
      
      // Filtrar por servidor si se especifica
      const filteredMetrics = server 
        ? allMetrics.filter(m => m.server === server)
        : allMetrics;

      // Estadísticas de sincronización por cliente
      const clientStats = clientId 
        ? this.getClientStats(clientId as string)
        : this.getAllClientsStats();

      // Estadísticas de período si se especifica
      const periodStats = period 
        ? this.getPeriodStats(period as string)
        : null;

      logger.debug('📊 Solicitud de métricas', { clientId, server, period });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        servers: filteredMetrics,
        clients: clientStats,
        period: periodStats,
        system: {
          totalSyncs: this.getTotalSyncsCount(),
          activeSessions: this.getActiveClientsCount(),
          uptime: process.uptime(),
          logs: logStats
        }
      });

    } catch (error) {
      logger.error('❌ Error obteniendo métricas', { error: error instanceof Error ? error.message : error });
      
      res.status(500).json({
        success: false,
        error: 'Error obteniendo métricas del sistema'
      });
    }
  };

  /**
   * GET /api/time/logs - Obtener logs del sistema
   */
  static getLogs = async (req: Request, res: Response) => {
    try {
      const { level, clientId, server, since, limit } = req.query;
      
      const filter: any = {};
      if (level) filter.level = level;
      if (clientId) filter.clientId = clientId;
      if (server) filter.server = server;
      if (since) filter.since = new Date(since as string);
      if (limit) filter.limit = parseInt(limit as string);
      
      const logs = logger.getLogs(filter);
      const stats = logger.getLogStats();
      
      res.json({
        success: true,
        logs,
        stats,
        filter,
        total: logs.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('❌ Error obteniendo logs', { error: error instanceof Error ? error.message : error });
      
      res.status(500).json({
        success: false,
        error: 'Error obteniendo logs del sistema'
      });
    }
  };

  /**
   * DELETE /api/time/logs - Limpiar logs del sistema
   */
  static clearLogs = async (req: Request, res: Response) => {
    try {
      logger.clearLogs();
      res.json({
        success: true,
        message: 'Logs limpiados exitosamente',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error limpiando logs del sistema'
      });
    }
  };

  // Métodos privados auxiliares

  private static generateRecommendations(result: SyncResult, stats: any): string[] {
    const recommendations: string[] = [];
    
    if (result.roundTripTime > 500) {
      recommendations.push('Latencia alta detectada. Considere usar una conexión de red más rápida.');
    }
    
    if (result.precision > 50) {
      recommendations.push('Precisión baja. La sincronización puede no ser confiable.');
    }
    
    if (stats.successRate < 95) {
      recommendations.push('Tasa de éxito baja. Verifique la conectividad de red.');
    }
    
    if (Math.abs(result.offset) > 1000) {
      recommendations.push('Diferencia de tiempo significativa detectada. Considere ajustar el reloj del sistema.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Sincronización funcionando correctamente.');
    }
    
    return recommendations;
  }

  private static getClientStats(clientId: string) {
    const history = this.syncHistory.get(clientId) || [];
    if (history.length === 0) return null;
    
    return {
      clientId,
      totalSyncs: history.length,
      stats: calculateSyncStats(history),
      lastSync: history[history.length - 1],
      reliableSyncs: history.filter(isReliableSync).length
    };
  }

  private static getAllClientsStats() {
    const allClients: any[] = [];
    
    for (const [clientId, history] of this.syncHistory.entries()) {
      if (history.length > 0) {
        allClients.push(this.getClientStats(clientId));
      }
    }
    
    return allClients;
  }

  private static getPeriodStats(period: string) {
    const now = Date.now();
    let periodMs: number;
    
    switch (period) {
      case 'hour': periodMs = 60 * 60 * 1000; break;
      case 'day': periodMs = 24 * 60 * 60 * 1000; break;
      case 'week': periodMs = 7 * 24 * 60 * 60 * 1000; break;
      default: return null;
    }
    
    const cutoff = now - periodMs;
    const periodResults: SyncResult[] = [];
    
    for (const history of this.syncHistory.values()) {
      periodResults.push(...history.filter(r => r.clientTime > cutoff));
    }
    
    return {
      period,
      count: periodResults.length,
      stats: calculateSyncStats(periodResults)
    };
  }

  /**
   * POST /api/admin/simulate-failure - Simular fallo del servidor NTP primario
   */
  static simulateNTPFailure = async (req: Request, res: Response) => {
    try {
      const { action, duration } = req.body;
      
      if (action === 'fail-primary') {
        // Simular fallo del servidor primario por un tiempo determinado
        const failureDuration = duration || 30000; // 30 segundos por defecto
        
        // Forzar el circuit breaker a abrirse temporalmente
        ntpMetricsManager.forceFailure('primary', failureDuration);
        
        logger.warn(`🚨 Simulando fallo del servidor NTP primario por ${failureDuration}ms`);
        
        res.json({
          success: true,
          message: `Servidor primario simulando fallo por ${failureDuration / 1000} segundos`,
          action: 'fail-primary',
          duration: failureDuration
        });
        
      } else if (action === 'restore') {
        // Restaurar el servidor primario
        ntpMetricsManager.restoreService('primary');
        
        logger.info('✅ Restaurando servidor NTP primario');
        
        res.json({
          success: true,
          message: 'Servidor primario restaurado',
          action: 'restore'
        });
        
      } else {
        res.status(400).json({
          success: false,
          error: 'Acción no válida. Use "fail-primary" o "restore"'
        });
      }
      
    } catch (error) {
      logger.error('❌ Error simulando fallo NTP', { error: error instanceof Error ? error.message : error });
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  };

  private static getActiveClientsCount(): number {
    // Considerar activos a clientes que han sincronizado en los últimos 30 segundos (más agresivo)
    const thirtySecondsAgo = Date.now() - (30 * 1000);
    let activeCount = 0;
    
    for (const history of this.syncHistory.values()) {
      if (history.length > 0 && history[history.length - 1].clientTime > thirtySecondsAgo) {
        activeCount++;
      }
    }
    
    return Math.max(activeCount, 1); // Siempre mostrar al menos 1 si hay conexiones recientes
  }

  private static getTotalSyncsCount(): number {
    let total = 0;
    for (const history of this.syncHistory.values()) {
      total += history.length;
    }
    return total;
  }
}