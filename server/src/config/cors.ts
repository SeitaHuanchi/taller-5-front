import { CorsOptions } from 'cors';
import { logger } from '../utils/logger';

export const corsOptions: CorsOptions = {
    origin: function (origin, callback) {
        const whitelist = [
            process.env.FRONTEND_URL || 'http://localhost:5173',
            'http://localhost:3000', // Para desarrollo
            'http://localhost:5173', // Vite default
            'http://localhost:4173'  // Vite preview
        ];

        // Permitir requests sin origin (como Postman, curl, etc.) en desarrollo
        if (!origin && process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }

        if (whitelist.includes(origin)) {
            logger.trace(`✅ CORS permitido para origen: ${origin}`);
            return callback(null, true);
        } else {
            logger.warn(`❌ CORS bloqueado para origen: ${origin}`);
            callback(new Error('ERROR DE CORS - Origen no permitido'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'x-client-id',
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    credentials: true,
    optionsSuccessStatus: 200 // Para compatibilidad con browsers antiguos
};
