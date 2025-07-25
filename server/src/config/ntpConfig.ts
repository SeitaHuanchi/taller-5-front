import CircuitBreaker from 'opossum';
import { getNTPTime, NTPMetrics } from '../utils/timeUtils';

// Configuración del Circuit Breaker para cada servidor NTP
const circuitBreakerOptions = {
  timeout: 5000, // 5 segundos timeout
  errorThresholdPercentage: 50, // 50% de fallos para abrir el circuito
  resetTimeout: 30000, // 30 segundos antes de intentar nuevamente
  rollingCountTimeout: 60000, // Ventana de 60 segundos
  rollingCountBuckets: 10,
  name: 'NTP-Server'
};

// Circuit Breakers para cada servidor
export const primaryNTPBreaker = new CircuitBreaker(getNTPTime, {
  ...circuitBreakerOptions,
  name: 'Primary-NTP-ntp.shoa.cl'
});

export const secondaryNTPBreaker = new CircuitBreaker(getNTPTime, {
  ...circuitBreakerOptions,
  name: 'Secondary-NTP-pool.ntp.org'
});

// Métricas globales
class NTPMetricsManager {
  private metrics: Map<string, NTPMetrics> = new Map();
  private activeServer: string = 'ntp.shoa.cl'; // Servidor actualmente en uso
  private lastSyncAttempt: { server: string; timestamp: number; success: boolean } | null = null;

  constructor() {
    // Inicializar métricas para servidores
    this.metrics.set('ntp.shoa.cl', {
      server: 'ntp.shoa.cl',
      averageLatency: 0,
      successRate: 100,
      responseTime: 0,
      failoverCount: 0,
      activeClients: 0,
      lastSync: 0
    });

    this.metrics.set('pool.ntp.org', {
      server: 'pool.ntp.org',
      averageLatency: 0,
      successRate: 100,
      responseTime: 0,
      failoverCount: 0,
      activeClients: 0,
      lastSync: 0
    });

    this.setupCircuitBreakerEvents();
  }

  private setupCircuitBreakerEvents() {
    // Eventos para servidor primario
    primaryNTPBreaker.on('open', () => {
      console.warn('🔴 Circuit Breaker ABIERTO para servidor primario ntp.shoa.cl');
      this.incrementFailover('ntp.shoa.cl');
    });

    primaryNTPBreaker.on('halfOpen', () => {
      console.info('🟡 Circuit Breaker MEDIO-ABIERTO para servidor primario ntp.shoa.cl');
    });

    primaryNTPBreaker.on('close', () => {
      console.info('🟢 Circuit Breaker CERRADO para servidor primario ntp.shoa.cl');
    });

    // Eventos para servidor secundario
    secondaryNTPBreaker.on('open', () => {
      console.warn('🔴 Circuit Breaker ABIERTO para servidor secundario pool.ntp.org');
      this.incrementFailover('pool.ntp.org');
    });

    secondaryNTPBreaker.on('halfOpen', () => {
      console.info('🟡 Circuit Breaker MEDIO-ABIERTO para servidor secundario pool.ntp.org');
    });

    secondaryNTPBreaker.on('close', () => {
      console.info('🟢 Circuit Breaker CERRADO para servidor secundario pool.ntp.org');
    });
  }

  updateMetrics(server: string, latency: number, success: boolean, responseTime: number) {
    const metric = this.metrics.get(server);
    if (!metric) return;

    // Actualizar latencia promedio (media móvil)
    metric.averageLatency = (metric.averageLatency * 0.8) + (latency * 0.2);
    
    // Actualizar tasa de éxito (media móvil)
    const successValue = success ? 100 : 0;
    metric.successRate = (metric.successRate * 0.9) + (successValue * 0.1);
    
    // Actualizar tiempo de respuesta
    metric.responseTime = responseTime;
    metric.lastSync = Date.now();

    this.metrics.set(server, metric);

    // Registrar el intento de sincronización
    this.lastSyncAttempt = {
      server,
      timestamp: Date.now(),
      success
    };

    // Si el intento fue exitoso, actualizar el servidor activo
    if (success) {
      this.activeServer = server;
      console.log(`🎯 Servidor activo actualizado a: ${server}`);
    }
  }

  // Método para obtener el servidor actualmente en uso
  getActiveServer(): string {
    return this.activeServer;
  }

  // Método para obtener información del último intento de sincronización
  getLastSyncAttempt() {
    return this.lastSyncAttempt;
  }

  // Método para establecer manualmente el servidor activo (para testing)
  setActiveServer(server: string) {
    this.activeServer = server;
    console.log(`🔧 Servidor activo establecido manualmente a: ${server}`);
  }

  incrementFailover(server: string) {
    const metric = this.metrics.get(server);
    if (metric) {
      metric.failoverCount++;
      this.metrics.set(server, metric);
    }
  }

  incrementActiveClients(server: string) {
    const metric = this.metrics.get(server);
    if (metric) {
      metric.activeClients++;
      this.metrics.set(server, metric);
    }
  }

  decrementActiveClients(server: string) {
    const metric = this.metrics.get(server);
    if (metric && metric.activeClients > 0) {
      metric.activeClients--;
      this.metrics.set(server, metric);
    }
  }

  getMetrics(server?: string): NTPMetrics | Map<string, NTPMetrics> {
    if (server) {
      return this.metrics.get(server) || {
        server,
        averageLatency: 0,
        successRate: 0,
        responseTime: 0,
        failoverCount: 0,
        activeClients: 0,
        lastSync: 0
      };
    }
    return this.metrics;
  }

  getAllMetrics(): NTPMetrics[] {
    return Array.from(this.metrics.values());
  }

  // Obtener estado de health de los servidores
  getHealthStatus() {
    const activeServer = this.getActiveServer();
    const lastSync = this.getLastSyncAttempt();
    
    return {
      primary: {
        server: 'ntp.shoa.cl',
        status: primaryNTPBreaker.stats.fires > 0 ? 'degraded' : 'healthy',
        circuitBreakerState: primaryNTPBreaker.closed ? 'closed' : primaryNTPBreaker.opened ? 'open' : 'half-open',
        stats: primaryNTPBreaker.stats,
        metrics: this.metrics.get('ntp.shoa.cl'),
        isActive: activeServer === 'ntp.shoa.cl'
      },
      secondary: {
        server: 'pool.ntp.org',
        status: secondaryNTPBreaker.stats.fires > 0 ? 'degraded' : 'healthy',
        circuitBreakerState: secondaryNTPBreaker.closed ? 'closed' : secondaryNTPBreaker.opened ? 'open' : 'half-open',
        stats: secondaryNTPBreaker.stats,
        metrics: this.metrics.get('pool.ntp.org'),
        isActive: activeServer === 'pool.ntp.org'
      },
      overall: this.getOverallHealth(),
      activeServer,
      lastSyncAttempt: lastSync
    };
  }

  private getOverallHealth(): 'healthy' | 'degraded' | 'critical' {
    const primaryHealthy = primaryNTPBreaker.closed;
    const secondaryHealthy = secondaryNTPBreaker.closed;

    if (primaryHealthy && secondaryHealthy) return 'healthy';
    if (primaryHealthy || secondaryHealthy) return 'degraded';
    return 'critical';
  }

  // Limpiar métricas periódicamente
  // Métodos para simulación de fallos
  forceFailure(server: string, duration: number) {
    if (server === 'primary') {
      primaryNTPBreaker.open();
      setTimeout(() => {
        primaryNTPBreaker.close();
      }, duration);
    } else if (server === 'secondary') {
      secondaryNTPBreaker.open();
      setTimeout(() => {
        secondaryNTPBreaker.close();
      }, duration);
    }
  }

  restoreService(server: string) {
    if (server === 'primary') {
      primaryNTPBreaker.close();
    } else if (server === 'secondary') {
      secondaryNTPBreaker.close();
    }
  }

  resetMetrics() {
    for (const [server, metric] of this.metrics.entries()) {
      this.metrics.set(server, {
        ...metric,
        averageLatency: 0,
        successRate: 100,
        responseTime: 0,
        failoverCount: 0,
        activeClients: 0
      });
    }
    console.info('📊 Métricas NTP reiniciadas');
  }
}

// Instancia singleton del gestor de métricas
export const ntpMetricsManager = new NTPMetricsManager();

// Función para obtener tiempo con circuit breaker y métricas
export async function getNTPTimeWithCircuitBreaker(server: string): Promise<{ time: number; roundTripTime: number }> {
  const startTime = Date.now();
  ntpMetricsManager.incrementActiveClients(server);

  try {
    let result;
    
    if (server === 'ntp.shoa.cl') {
      result = await primaryNTPBreaker.fire(server);
    } else {
      result = await secondaryNTPBreaker.fire(server);
    }

    const responseTime = Date.now() - startTime;
    ntpMetricsManager.updateMetrics(server, result.roundTripTime, true, responseTime);
    
    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    ntpMetricsManager.updateMetrics(server, 0, false, responseTime);
    throw error;
  } finally {
    ntpMetricsManager.decrementActiveClients(server);
  }
}

// Configuración para limpieza periódica de métricas (cada hora)
setInterval(() => {
  ntpMetricsManager.resetMetrics();
}, 60 * 60 * 1000);

export { NTPMetricsManager };