import { Router } from 'express';
import type { Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /health - Health check básico del servidor
 */
router.get('/health', (req: Request, res: Response) => {
  try {
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      env: process.env.NODE_ENV || 'development',
      pid: process.pid,
      version: process.version,
      platform: process.platform
    };

    logger.trace('🏥 Health check solicitado', { 
      ip: req.ip,
      userAgent: req.headers['user-agent'] 
    });

    res.json(healthData);
  } catch (error) {
    logger.error('❌ Error en health check', { error });
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Error verificando estado del servidor'
    });
  }
});

/**
 * GET / - Información general del API
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const apiInfo = {
      name: 'Servidor de Sincronización Temporal - Algoritmo de Cristian',
      version: '1.0.0',
      description: 'Implementación del algoritmo de sincronización de Cristian con failover automático',
      author: 'Estudiante de Sistemas Distribuidos',
      
      endpoints: {
        'GET /': 'Información del API',
        'GET /health': 'Health check del servidor',
        'GET /api/time': 'Obtener hora actual del servidor',
        'POST /api/time/sync': 'Sincronizar tiempo usando algoritmo de Cristian',
        'GET /api/time/health': 'Estado detallado del sistema de tiempo',
        'GET /api/time/metrics': 'Métricas detalladas del sistema',
        'GET /api/time/logs': 'Logs del sistema',
        'DELETE /api/time/logs': 'Limpiar logs del sistema'
      },
      
      algorithm: {
        name: 'Cristian Clock Synchronization',
        description: 'Algoritmo de sincronización de relojes para sistemas distribuidos',
        precision: 'Usa process.hrtime.bigint() para máxima precisión',
        features: [
          'Compensación automática de latencia de red',
          'Cálculo de offset temporal',
          'Estimación de precisión',
          'Validación de confiabilidad'
        ]
      },
      
      ntpServers: {
        primary: 'ntp.shoa.cl',
        secondary: 'pool.ntp.org',
        timeout: '5000ms',
        failover: 'Automático'
      },
      
      features: [
        'Sincronización de alta precisión',
        'Failover automático entre servidores NTP',
        'Circuit breaker pattern para protección',
        'Métricas en tiempo real',
        'Sistema de logging completo',
        'Soporte para múltiples clientes concurrentes',
        'Validación exhaustiva de datos',
        'Headers de seguridad'
      ],
      
      technical: {
        runtime: `Node.js ${process.version}`,
        platform: process.platform,
        uptime: `${Math.floor(process.uptime())} segundos`,
        memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        pid: process.pid
      },
      
      usage: {
        syncExample: {
          method: 'POST',
          url: '/api/time/sync',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': 'mi-cliente'
          },
          body: {
            clientRequestTime: 'tiempo_en_nanosegundos'
          }
        },
        
        documentation: 'Ver API_DOCUMENTATION.md para más detalles',
        testCommands: 'Ver TESTING_COMMANDS.md para comandos de prueba'
      },
      
      timestamp: new Date().toISOString()
    };

    logger.trace('📖 Información del API solicitada', { 
      ip: req.ip,
      userAgent: req.headers['user-agent'] 
    });

    res.json(apiInfo);
  } catch (error) {
    logger.error('❌ Error mostrando información del API', { error });
    res.status(500).json({
      error: 'Error obteniendo información del API',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
