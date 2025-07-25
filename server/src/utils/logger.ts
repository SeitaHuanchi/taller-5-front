import colors from 'colors';
import { SyncResult } from './timeUtils';

// Niveles de log
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
  TRACE = 'TRACE'
}

// Interfaz para entradas de log
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: any;
  clientId?: string;
  server?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Máximo número de logs en memoria

  private formatTimestamp(): string {
    const now = new Date();
    return now.toISOString() + '.' + now.getMilliseconds().toString().padStart(3, '0');
  }

  private addLog(level: LogLevel, message: string, context?: any, clientId?: string, server?: string) {
    const logEntry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      message,
      context,
      clientId,
      server
    };

    // Agregar al array de logs
    this.logs.push(logEntry);

    // Mantener solo los últimos maxLogs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Imprimir en consola con colores
    this.printToConsole(logEntry);
  }

  private printToConsole(entry: LogEntry) {
    const prefix = `[${entry.timestamp}] [${entry.level}]`;
    let coloredMessage: string;

    switch (entry.level) {
      case LogLevel.ERROR:
        coloredMessage = colors.red.bold(`${prefix} ${entry.message}`);
        break;
      case LogLevel.WARN:
        coloredMessage = colors.yellow(`${prefix} ${entry.message}`);
        break;
      case LogLevel.INFO:
        coloredMessage = colors.blue(`${prefix} ${entry.message}`);
        break;
      case LogLevel.DEBUG:
        coloredMessage = colors.gray(`${prefix} ${entry.message}`);
        break;
      case LogLevel.TRACE:
        coloredMessage = colors.cyan(`${prefix} ${entry.message}`);
        break;
      default:
        coloredMessage = `${prefix} ${entry.message}`;
    }

    console.log(coloredMessage);

    // Si hay contexto, mostrarlo también
    if (entry.context) {
      console.log(colors.gray('  Context:'), entry.context);
    }
  }

  error(message: string, context?: any, clientId?: string, server?: string) {
    this.addLog(LogLevel.ERROR, message, context, clientId, server);
  }

  warn(message: string, context?: any, clientId?: string, server?: string) {
    this.addLog(LogLevel.WARN, message, context, clientId, server);
  }

  info(message: string, context?: any, clientId?: string, server?: string) {
    this.addLog(LogLevel.INFO, message, context, clientId, server);
  }

  debug(message: string, context?: any, clientId?: string, server?: string) {
    this.addLog(LogLevel.DEBUG, message, context, clientId, server);
  }

  trace(message: string, context?: any, clientId?: string, server?: string) {
    this.addLog(LogLevel.TRACE, message, context, clientId, server);
  }

  // Métodos específicos para sincronización
  logSyncAttempt(clientId: string, server: string) {
    this.info(`🔄 Iniciando sincronización con ${server}`, undefined, clientId, server);
  }

  logSyncSuccess(result: SyncResult, clientId: string) {
    this.info(
      `✅ Sincronización exitosa con ${result.server}`, 
      {
        offset: `${result.offset.toFixed(2)}ms`,
        rtt: `${result.roundTripTime.toFixed(2)}ms`,
        precision: `${result.precision.toFixed(2)}ms`,
        reliable: result.roundTripTime < 1000 && result.precision < 100
      },
      clientId,
      result.server
    );
  }

  logSyncFailure(error: string, clientId: string, server: string) {
    this.error(`❌ Fallo en sincronización con ${server}: ${error}`, undefined, clientId, server);
  }

  logFailover(fromServer: string, toServer: string, clientId: string) {
    this.warn(`🔄 Failover de ${fromServer} a ${toServer}`, undefined, clientId);
  }

  logCircuitBreakerEvent(event: string, server: string) {
    const emoji = event === 'open' ? '🔴' : event === 'close' ? '🟢' : '🟡';
    this.warn(`${emoji} Circuit Breaker ${event.toUpperCase()} para ${server}`, undefined, undefined, server);
  }

  logMetrics(metrics: any) {
    this.debug('📊 Métricas actualizadas', metrics);
  }

  // Obtener logs filtrados
  getLogs(filter?: {
    level?: LogLevel;
    clientId?: string;
    server?: string;
    since?: Date;
    limit?: number;
  }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.level) {
        filteredLogs = filteredLogs.filter(log => log.level === filter.level);
      }
      
      if (filter.clientId) {
        filteredLogs = filteredLogs.filter(log => log.clientId === filter.clientId);
      }
      
      if (filter.server) {
        filteredLogs = filteredLogs.filter(log => log.server === filter.server);
      }
      
      if (filter.since) {
        filteredLogs = filteredLogs.filter(log => 
          new Date(log.timestamp) >= filter.since!
        );
      }
      
      if (filter.limit) {
        filteredLogs = filteredLogs.slice(-filter.limit);
      }
    }

    return filteredLogs;
  }

  // Estadísticas de logs
  getLogStats(): {
    total: number;
    byLevel: Record<LogLevel, number>;
    byServer: Record<string, number>;
    recentErrors: LogEntry[];
  } {
    const byLevel = {} as Record<LogLevel, number>;
    const byServer = {} as Record<string, number>;

    // Inicializar contadores
    Object.values(LogLevel).forEach(level => {
      byLevel[level] = 0;
    });

    this.logs.forEach(log => {
      byLevel[log.level]++;
      
      if (log.server) {
        byServer[log.server] = (byServer[log.server] || 0) + 1;
      }
    });

    // Obtener errores recientes (últimos 10)
    const recentErrors = this.logs
      .filter(log => log.level === LogLevel.ERROR)
      .slice(-10);

    return {
      total: this.logs.length,
      byLevel,
      byServer,
      recentErrors
    };
  }

  // Limpiar logs
  clearLogs() {
    this.logs = [];
    this.info('🧹 Logs limpiados');
  }

  // Exportar logs (para debugging)
  exportLogs(): LogEntry[] {
    return [...this.logs];
  }
}

// Instancia singleton del logger
export const logger = new Logger();

// Funciones de conveniencia
export const logSyncAttempt = (clientId: string, server: string) => 
  logger.logSyncAttempt(clientId, server);

export const logSyncSuccess = (result: SyncResult, clientId: string) => 
  logger.logSyncSuccess(result, clientId);

export const logSyncFailure = (error: string, clientId: string, server: string) => 
  logger.logSyncFailure(error, clientId, server);

export const logFailover = (fromServer: string, toServer: string, clientId: string) => 
  logger.logFailover(fromServer, toServer, clientId);

export default logger;