import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import type { 
  SyncResponse, 
  UseSyncReturn,
  UseServerHealthReturn,
  UseAutoSyncReturn
} from '../types';
import { CristianApiService } from '../services/api';

/**
 * Hook para sincronización de tiempo
 */
export const useSync = (apiService: CristianApiService): UseSyncReturn => {
  const [lastResult, setLastResult] = useState<SyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => apiService.syncTime(),
    onSuccess: (data) => {
      setLastResult(data);
      setError(null);
    },
    onError: (error: Error) => {
      setError(error.message);
      console.error('Error en mutación:', error);
    },
  });

  const sync = useCallback(async (): Promise<SyncResponse | null> => {
    try {
      setError(null);
      const result = await mutation.mutateAsync();
      setLastResult(result);
      return result;
    } catch (error) {
      console.error('Error en sync:', error);
      setError(error instanceof Error ? error.message : 'Error desconocido');
      
      // Crear respuesta de error para mantener la UI consistente
      const errorResponse: SyncResponse = {
        success: false,
        syncResult: {
          success: false,
          serverTime: 0,
          clientTime: Date.now(),
          offset: 0,
          roundTripTime: 0,
          precision: 0,
          server: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido'
        },
        isReliable: false,
        stats: {
          averageOffset: 0,
          averageRTT: 0,
          successRate: 0,
          reliability: 0
        },
        recommendations: ['Verificar conectividad con el servidor'],
        clientId: apiService.getClientId(),
        serverProcessingTime: 0
      };
      
      setLastResult(errorResponse);
      return errorResponse;
    }
  }, [mutation, apiService]);

  return {
    sync,
    isLoading: mutation.isPending,
    error,
    lastResult,
  };
};

/**
 * Hook para el estado de salud del servidor
 */
export const useServerHealth = (
  apiService: CristianApiService,
  refetchInterval: number = 5000 // Reducir a 5 segundos para mayor responsividad
): UseServerHealthReturn => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['serverHealth'],
    queryFn: () => apiService.getHealth(),
    refetchInterval,
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: 1000,
    staleTime: 0, // Forzar actualización constante
  });

  return {
    health: data || null,
    isLoading,
    error: error?.message || null,
    refetch,
  };
};

/**
 * Hook para tiempo del servidor
 */
export const useServerTime = (apiService: CristianApiService, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['serverTime'],
    queryFn: () => apiService.getServerTime(),
    enabled,
    refetchInterval: 1000, // Reducir a 1 segundo en lugar de 100ms
    refetchIntervalInBackground: true,
    staleTime: 0, // Siempre considerar datos obsoletos
  });
};

/**
 * Hook para métricas del cliente
 */
export const useClientMetrics = (apiService: CristianApiService, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['clientMetrics', apiService.getClientId()],
    queryFn: () => apiService.getClientMetrics(),
    enabled,
    refetchInterval: 10000, // Actualizar cada 10 segundos
  });
};

/**
 * Hook para sincronización automática
 */
export const useAutoSync = (
  apiService: CristianApiService,
  initialInterval: number = 30
): UseAutoSyncReturn => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [interval, setIntervalState] = useState(initialInterval);
  const [nextSyncIn, setNextSyncIn] = useState(0);
  
  const intervalRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  // Función para sincronizar
  const performSync = useCallback(async () => {
    try {
      await apiService.syncTime();
      // Invalidar queries relacionadas para actualizar la UI
      queryClient.invalidateQueries({ queryKey: ['clientMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['serverHealth'] });
    } catch (error) {
      console.error('Error en auto-sync:', error);
    }
  }, [apiService, queryClient]);

  // Iniciar countdown
  const startCountdown = useCallback(() => {
    setNextSyncIn(interval);
    
    countdownRef.current = window.setInterval(() => {
      setNextSyncIn((prev) => {
        if (prev <= 1) {
          return interval; // Reset countdown
        }
        return prev - 1;
      });
    }, 1000);
  }, [interval]);

  // Detener countdown
  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setNextSyncIn(0);
  }, []);

  // Iniciar auto-sync
  const startAutoSync = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }

    intervalRef.current = window.setInterval(performSync, interval * 1000);
    startCountdown();
  }, [performSync, interval, startCountdown]);

  // Detener auto-sync
  const stopAutoSync = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    stopCountdown();
  }, [stopCountdown]);

  // Toggle auto-sync
  const toggle = useCallback(() => {
    setIsEnabled((prev) => {
      const newState = !prev;
      if (newState) {
        startAutoSync();
      } else {
        stopAutoSync();
      }
      return newState;
    });
  }, [startAutoSync, stopAutoSync]);

  // Cambiar intervalo
  const setInterval = useCallback((newInterval: number) => {
    setIntervalState(newInterval);
    if (isEnabled) {
      stopAutoSync();
      // Restart con nuevo intervalo después de un pequeño delay
      setTimeout(() => startAutoSync(), 100);
    }
  }, [isEnabled, stopAutoSync, startAutoSync]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      stopAutoSync();
    };
  }, [stopAutoSync]);

  // Restart auto-sync cuando cambia el intervalo
  useEffect(() => {
    if (isEnabled) {
      stopAutoSync();
      startAutoSync();
    }
  }, [interval]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isEnabled,
    interval,
    toggle,
    setInterval,
    nextSyncIn,
  };
};

/**
 * Hook para conectividad del servidor
 */
export const useServerConnection = (apiService: CristianApiService) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const connected = await apiService.ping();
      setIsConnected(connected);
    } catch {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  }, [apiService]);

  // Verificar conexión al montar y periódicamente
  useEffect(() => {
    checkConnection();
    const interval = window.setInterval(checkConnection, 10000); // Reducir a cada 10 segundos
    
    return () => window.clearInterval(interval);
  }, [checkConnection]);

  return {
    isConnected,
    isChecking,
    checkConnection,
  };
};

/**
 * Hook para gestión de notificaciones usando react-toastify
 */
export const useNotifications = () => {
  const addNotification = useCallback((notification: {
    type: 'success' | 'warning' | 'error' | 'info';
    title: string;
    message: string;
    duration?: number;
  }) => {
    const options = {
      position: 'top-right' as const,
      autoClose: notification.duration || 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    };

    switch (notification.type) {
      case 'success':
        toast.success(`${notification.title}: ${notification.message}`, options);
        break;
      case 'warning':
        toast.warning(`${notification.title}: ${notification.message}`, options);
        break;
      case 'error':
        toast.error(`${notification.title}: ${notification.message}`, options);
        break;
      case 'info':
        toast.info(`${notification.title}: ${notification.message}`, options);
        break;
    }
  }, []);

  return {
    addNotification,
  };
};

/**
 * Hook para tiempo real local sincronizado
 */
export const useRealTimeDisplay = () => {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100); // Actualizar cada 100ms para mejor rendimiento

    return () => clearInterval(interval);
  }, []);

  return currentTime;
};

/**
 * Hook para persistir estado en localStorage
 */
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      setStoredValue((currentValue) => {
        // Permitir que value sea una función que recibe el valor anterior
        const valueToStore = value instanceof Function ? value(currentValue) : value;
        
        // Guardar en localStorage
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        
        return valueToStore;
      });
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue] as const;
};
