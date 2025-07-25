import morgan from 'morgan';
import { logger } from '../utils/logger';

/**
 * Configuración personalizada de Morgan para logging HTTP
 */
export const httpLogger = morgan('combined', {
  stream: {
    write: (message: string) => {
      // Filtrar mensajes de health checks para reducir ruido
      if (!message.includes('/health') || process.env.NODE_ENV === 'development') {
        logger.info(`🌐 ${message.trim()}`);
      }
    }
  },
  skip: (req, res) => {
    // Omitir logs de static assets y health checks en producción
    if (process.env.NODE_ENV === 'production') {
      return req.url.includes('/health') || 
             req.url.includes('/favicon.ico') ||
             req.url.includes('/static/');
    }
    return false;
  }
});

/**
 * Morgan logger más detallado para desarrollo
 */
export const httpLoggerDev = morgan(':method :url :status :res[content-length] - :response-time ms :user-agent', {
  stream: {
    write: (message: string) => {
      logger.debug(`🌐 ${message.trim()}`);
    }
  }
});

/**
 * Seleccionar el logger apropiado según el entorno
 */
export const getHttpLogger = () => {
  return process.env.NODE_ENV === 'development' ? httpLoggerDev : httpLogger;
};
