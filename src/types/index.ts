import { z } from 'zod';
import React from 'react';

// ========================
// TIPOS DE DATOS DEL API
// ========================

export interface SyncResult {
  success: boolean;
  serverTime: number;
  clientTime: number;
  offset: number;
  roundTripTime: number;
  precision: number;
  server: string;
  error?: string;
}

export interface SyncStats {
  averageOffset: number;
  averageRTT: number;
  successRate: number;
  reliability: number;
}

export interface SyncResponse {
  success: boolean;
  syncResult: SyncResult;
  isReliable: boolean;
  stats: SyncStats;
  recommendations: string[];
  clientId: string;
  serverProcessingTime: number;
}

export interface ServerTime {
  success: boolean;
  serverTime: number;
  serverTimeFormatted: string;
  highPrecisionTime: number;
  timezone: string;
  timestamp: string;
}

export interface HealthStatus {
  success: boolean;
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'critical';
  servers: {
    primary: ServerHealth;
    secondary: ServerHealth;
  };
  connectivity: ConnectivityTest[];
  activeClients: number;
  uptime: number;
}

export interface ServerHealth {
  server: string;
  status: 'healthy' | 'degraded';
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  stats: {
    fires: number;
    requests: number;
  };
  metrics: {
    averageLatency: number;
    successRate: number;
    activeClients: number;
  };
  isActive?: boolean; // Indica si este servidor está siendo usado activamente
}

export interface ConnectivityTest {
  server: string;
  status: 'ok' | 'failed';
}

export interface ClientMetrics {
  clientId: string;
  totalSyncs: number;
  stats: SyncStats;
  lastSync: SyncResult;
  reliableSyncs: number;
}

// ========================
// TIPOS DE ESTADO LOCAL
// ========================

export interface ClientState {
  id: string;
  name: string;
  isConnected: boolean;
  lastSync?: SyncResult;
  syncHistory: SyncResult[];
  stats?: SyncStats;
  autoSync: boolean;
  syncInterval: number; // en segundos
}

export interface AppSettings {
  serverUrl: string;
  autoSyncEnabled: boolean;
  syncInterval: number;
  maxHistoryItems: number;
  showAdvancedMetrics: boolean;
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
}

export interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: number;
  duration?: number;
}

// ========================
// ESQUEMAS DE VALIDACIÓN
// ========================

export const syncRequestSchema = z.object({
  clientRequestTime: z.string().min(1, 'Tiempo de solicitud requerido'),
});

export const settingsSchema = z.object({
  serverUrl: z.string().url('URL del servidor inválida'),
  autoSyncEnabled: z.boolean(),
  syncInterval: z.number().min(1).max(300), // 1 segundo a 5 minutos
  maxHistoryItems: z.number().min(10).max(1000),
  showAdvancedMetrics: z.boolean(),
  theme: z.enum(['light', 'dark', 'system']),
  notifications: z.boolean(),
});

export const clientNameSchema = z.object({
  name: z.string()
    .min(1, 'Nombre requerido')
    .max(50, 'Nombre muy largo')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Solo letras, números, espacios, guiones y guiones bajos'),
});

// ========================
// TIPOS DE EVENTOS
// ========================

export type SyncEvent = {
  type: 'sync_start' | 'sync_success' | 'sync_error' | 'sync_timeout';
  clientId: string;
  timestamp: number;
  data?: any;
};

export type ConnectionEvent = {
  type: 'connected' | 'disconnected' | 'reconnecting';
  timestamp: number;
  serverUrl: string;
};

// ========================
// CONSTANTES
// ========================

export const SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error',
  TIMEOUT: 'timeout',
} as const;

export type SyncStatus = typeof SYNC_STATUS[keyof typeof SYNC_STATUS];

export const SERVER_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  CRITICAL: 'critical',
  UNKNOWN: 'unknown',
} as const;

export type ServerStatus = typeof SERVER_STATUS[keyof typeof SERVER_STATUS];

// ========================
// UTILIDADES DE TIEMPO
// ========================

export interface TimeDisplayOptions {
  showMilliseconds: boolean;
  showTimeZone: boolean;
  format24Hour: boolean;
  showDate: boolean;
}

export interface SyncQualityMetrics {
  isReliable: boolean;
  qualityScore: number; // 0-100
  latencyGrade: 'excellent' | 'good' | 'fair' | 'poor';
  precisionGrade: 'excellent' | 'good' | 'fair' | 'poor';
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
}

// ========================
// TIPOS DE HOOKS
// ========================

export interface UseSyncReturn {
  sync: () => Promise<SyncResponse | null>;
  isLoading: boolean;
  error: string | null;
  lastResult: SyncResponse | null;
}

export interface UseServerHealthReturn {
  health: HealthStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseAutoSyncReturn {
  isEnabled: boolean;
  interval: number;
  toggle: () => void;
  setInterval: (interval: number) => void;
  nextSyncIn: number;
}

// ========================
// TIPOS DE COMPONENTES
// ========================

export interface SyncButtonProps {
  onSync: () => void;
  isLoading: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline';
}

export interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}

export interface SyncHistoryProps {
  history: SyncResult[];
  maxItems?: number;
  showDetails?: boolean;
}

// ========================
// FUNCIONES DE UTILIDAD
// ========================

export type ValidationResult<T> = {
  success: boolean;
  data?: T;
  errors?: string[];
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
};

// ========================
// EXPORTAR VALIDADORES
// ========================

export const validateSyncRequest = (data: unknown): ValidationResult<z.infer<typeof syncRequestSchema>> => {
  try {
    const validData = syncRequestSchema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.issues.map((issue: z.ZodIssue) => issue.message) 
      };
    }
    return { success: false, errors: ['Error de validación desconocido'] };
  }
};

export const validateSettings = (data: unknown): ValidationResult<z.infer<typeof settingsSchema>> => {
  try {
    const validData = settingsSchema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.issues.map((issue: z.ZodIssue) => issue.message) 
      };
    }
    return { success: false, errors: ['Error de validación desconocido'] };
  }
};

export const validateClientName = (data: unknown): ValidationResult<z.infer<typeof clientNameSchema>> => {
  try {
    const validData = clientNameSchema.parse(data);
    return { success: true, data: validData };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.issues.map((issue: z.ZodIssue) => issue.message) 
      };
    }
    return { 
      success: false, 
      errors: ['Error de validación desconocido'] 
    };
  }
};