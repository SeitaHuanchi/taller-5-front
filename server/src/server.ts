import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Configuraciones
import { corsOptions } from './config/cors';

// Middlewares
import { 
  securityHeaders, 
  requestLogger, 
  notFoundHandler, 
  errorHandler,
  rateLimiter 
} from './middleware/common';
import { getHttpLogger } from './middleware/logging';

// Rutas
import timeRoutes from './routes/timeRoutes';
import systemRoutes from './routes/systemRoutes';

// Utilidades
import { logger } from './utils/logger';

dotenv.config(); // Variables de entorno

const app = express();

// ========================
// MIDDLEWARES GLOBALES
// ========================

// CORS con configuración personalizada
app.use(cors(corsOptions));

// Parsing de datos
app.use(express.json({ 
  limit: '10mb',
  strict: true,
  type: 'application/json'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Logging HTTP
app.use(getHttpLogger());

// Headers de seguridad
app.use(securityHeaders);

// Rate limiting básico
app.use(rateLimiter);

// Logging detallado de requests
app.use(requestLogger);

// ========================
// RUTAS PRINCIPALES
// ========================

// Rutas del sistema (health, info general)
app.use('/', systemRoutes);

// Rutas de sincronización temporal
app.use('/api/time', timeRoutes);

// ========================
// MANEJO DE ERRORES
// ========================

// Middleware para rutas no encontradas (404)
app.use(notFoundHandler);

// Middleware global para manejo de errores
app.use(errorHandler);

// ========================
// INICIALIZACIÓN
// ========================

// Log de inicialización del servidor
logger.info('🚀 Servidor de sincronización temporal inicializado', {
  algorithm: 'Cristian',
  ntpServers: ['ntp.shoa.cl', 'pool.ntp.org'],
  features: ['failover', 'circuit-breaker', 'metrics', 'logging'],
  environment: process.env.NODE_ENV || 'development',
  cors: 'configurado',
  middleware: 'cargado',
  routes: 'configuradas'
});

export default app;