import {Router} from 'express';
import { TimeController } from '../controllers/TimeController';
import { body, param, query } from 'express-validator';
import { handleInputErrors } from '../middleware/validation';

const router = Router(); //inicializa el router

// GET /api/time - Obtener hora actual del servidor
router.get('/', TimeController.getCurrentTime);

// POST /api/time/sync - Sincronizar tiempo usando algoritmo de Cristian
router.post('/sync',
  [
    body('clientRequestTime')
      .notEmpty()
      .withMessage('clientRequestTime es requerido')
      .isNumeric()
      .withMessage('clientRequestTime debe ser un número')
      .custom((value) => {
        const num = BigInt(value);
        if (num <= 0) {
          throw new Error('clientRequestTime debe ser mayor que 0');
        }
        return true;
      })
  ],
  handleInputErrors,
  TimeController.syncTime
);

// GET /api/time/health - Verificar estado del servidor de tiempo
router.get('/health', TimeController.getHealthStatus);

// GET /api/time/metrics - Obtener métricas detalladas
router.get('/metrics',
  [
    query('clientId').optional().isString().withMessage('clientId debe ser string'),
    query('server').optional().isIn(['ntp.shoa.cl', 'pool.ntp.org']).withMessage('server debe ser ntp.shoa.cl o pool.ntp.org'),
    query('period').optional().isIn(['hour', 'day', 'week']).withMessage('period debe ser hour, day o week')
  ],
  handleInputErrors,
  TimeController.getMetrics
);

// GET /api/time/logs - Obtener logs del sistema
router.get('/logs',
  [
    query('level').optional().isIn(['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']).withMessage('level inválido'),
    query('clientId').optional().isString().withMessage('clientId debe ser string'),
    query('server').optional().isString().withMessage('server debe ser string'),
    query('since').optional().isISO8601().withMessage('since debe ser una fecha ISO8601'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('limit debe ser entre 1 y 1000')
  ],
  handleInputErrors,
  TimeController.getLogs
);

// DELETE /api/time/logs - Limpiar logs del sistema
router.delete('/logs', TimeController.clearLogs);

// POST /api/time/admin/simulate-failure - Simular fallo del servidor NTP (solo para testing)
router.post('/admin/simulate-failure',
  [
    body('action')
      .isIn(['fail-primary', 'restore'])
      .withMessage('action debe ser fail-primary o restore'),
    body('duration')
      .optional()
      .isInt({ min: 1000, max: 300000 })
      .withMessage('duration debe estar entre 1000ms y 300000ms (5 minutos)')
  ],
  handleInputErrors,
  TimeController.simulateNTPFailure
);

export default router;
