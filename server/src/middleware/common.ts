import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Middleware para agregar headers de seguridad básicos
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('X-DNS-Prefetch-Control', 'off');
  next();
};

/**
 * Middleware para logging detallado de requests y responses
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const clientId = req.headers['x-client-id'] as string || 'anonymous';
  
  logger.trace(`📨 Request: ${req.method} ${req.path}`, {
    clientId,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
    query: req.query,
    bodySize: req.headers['content-length'] || '0'
  });

  // Override del método res.json para loggear responses
  const originalJson = res.json;
  const originalSend = res.send;
  
  res.json = function(body) {
    const duration = Date.now() - startTime;
    logger.trace(`📤 JSON Response: ${res.statusCode} in ${duration}ms`, {
      clientId,
      status: res.statusCode,
      duration,
      path: req.path
    });
    return originalJson.call(this, body);
  };

  res.send = function(body) {
    const duration = Date.now() - startTime;
    logger.trace(`📤 Response: ${res.statusCode} in ${duration}ms`, {
      clientId,
      status: res.statusCode,
      duration,
      path: req.path
    });
    return originalSend.call(this, body);
  };

  next();
};

/**
 * Middleware para manejar errores 404
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  logger.warn(`📍 Ruta no encontrada: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /api/time',
      'POST /api/time/sync',
      'GET /api/time/health',
      'GET /api/time/metrics',
      'GET /api/time/logs',
      'DELETE /api/time/logs'
    ]
  });
};

/**
 * Middleware global para manejo de errores
 */
export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('❌ Error no manejado', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Error de CORS
  if (error.message === 'ERROR DE CORS - Origen no permitido') {
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado por política CORS',
      timestamp: new Date().toISOString()
    });
  }

  // Error de validación de express-validator
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'JSON malformado en el cuerpo de la petición',
      timestamp: new Date().toISOString()
    });
  }

  // Error de timeout
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return res.status(504).json({
      success: false,
      error: 'Timeout en la conexión',
      timestamp: new Date().toISOString()
    });
  }

  // Error genérico del servidor
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { 
      details: error.message,
      stack: error.stack 
    })
  });
};

/**
 * Middleware para rate limiting básico (opcional)
 */
export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  // Implementación básica de rate limiting
  // En producción, usar librerías como express-rate-limit
  const clientId = req.headers['x-client-id'] as string || req.ip;
  
  // Por ahora solo logging, pero se puede extender
  logger.trace('🚦 Rate limit check', { clientId, path: req.path });
  
  next();
};
