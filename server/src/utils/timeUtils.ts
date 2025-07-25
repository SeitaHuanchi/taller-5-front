import ntpClient from 'ntp-client';
import { getNTPTimeWithCircuitBreaker, ntpMetricsManager } from '../config/ntpConfig';

// Configuración de servidores NTP
export const NTP_SERVERS = {
  primary: 'ntp.shoa.cl',
  secondary: 'pool.ntp.org',
  timeout: 5000
};

// Interfaz para el resultado de sincronización
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

// Interfaz para métricas
export interface NTPMetrics {
  server: string;
  averageLatency: number;
  successRate: number;
  responseTime: number;
  failoverCount: number;
  activeClients: number;
  lastSync: number;
}

/**
 * Obtiene el tiempo actual con máxima precisión usando process.hrtime.bigint()
 */
export function getHighPrecisionTime(): bigint {
  return process.hrtime.bigint();
}

/**
 * Convierte tiempo de alta precisión a milisegundos
 */
export function hrtimeToMs(hrtime: bigint): number {
  return Number(hrtime) / 1000000;
}

/**
 * Obtiene tiempo de servidor NTP con manejo de errores
 */
export async function getNTPTime(server: string = NTP_SERVERS.primary): Promise<{ time: number; roundTripTime: number }> {
  return new Promise((resolve, reject) => {
    const startTime = getHighPrecisionTime();
    
    ntpClient.getNetworkTime(server, 123, (err, date) => {
      const endTime = getHighPrecisionTime();
      const roundTripTime = hrtimeToMs(endTime - startTime);
      
      if (err) {
        reject(new Error(`Error conectando a ${server}: ${err.message}`));
        return;
      }
      
      if (!date) {
        reject(new Error(`No se recibió fecha del servidor ${server}`));
        return;
      }
      
      resolve({
        time: date.getTime(),
        roundTripTime
      });
    });
  });
}

/**
 * Implementación del algoritmo de Cristian
 * T0: Tiempo cuando el cliente envía la solicitud
 * T1: Tiempo cuando el servidor recibe la solicitud
 * T2: Tiempo cuando el servidor envía la respuesta
 * T3: Tiempo cuando el cliente recibe la respuesta
 */
export async function cristianSyncAlgorithm(clientRequestTime: number): Promise<SyncResult> {
  // Normalización: si el valor es muy grande, probablemente viene en nanosegundos
  let T0 = clientRequestTime;
  if (T0 > 1e12) {
    // Si el valor es mayor a 1e12, probablemente está en nanosegundos
    T0 = Math.floor(T0 / 1e6); // Convertir a milisegundos
  }
  
  const T0_ms = Number(T0); // clientRequestTime debe ser timestamp absoluto en ms
  let serverUsed = NTP_SERVERS.primary;
  
  try {
    // Intentar con servidor primario usando circuit breaker
    console.log(`🔄 Intentando sincronización con servidor primario: ${NTP_SERVERS.primary}`);
    const { time: serverTime, roundTripTime } = await getNTPTimeWithCircuitBreaker(NTP_SERVERS.primary);
    
    // Actualizar servidor activo en métricas manager
    ntpMetricsManager.setActiveServer(NTP_SERVERS.primary);
    
    console.log(`✅ Sincronización exitosa con servidor primario: ${NTP_SERVERS.primary}`);
    // Eliminada declaración previa de T3, ahora se usa Date.now() como T3
    const T1_T2 = serverTime; // Tiempo del servidor en milisegundos
    
    // --- CORRECCIÓN DE CÁLCULO DE SINCRONIZACIÓN ---
    // Usar tiempos absolutos para todos los cálculos
    const T3 = Date.now(); // Tiempo absoluto cuando el cliente recibe la respuesta
    const actualRTT = T3 - T0_ms;
    // Offset según Cristian: offset = T1_T2 - (T0 + RTT/2)
    const offset = T1_T2 - (T0_ms + actualRTT / 2);
    // Precisión: la mitad del RTT
    const precision = actualRTT / 2;
    return {
      success: true,
      serverTime: T1_T2,
      clientTime: T3,
      offset,
      roundTripTime: actualRTT,
      precision,
      server: serverUsed
    };
    // --- FIN CORRECCIÓN ---
    
  } catch (primaryError) {
    // Failover al servidor secundario
    console.warn(`⚠️ Servidor primario ${NTP_SERVERS.primary} falló: ${primaryError}. Intentando servidor de respaldo...`);
    serverUsed = NTP_SERVERS.secondary;
    
    try {
      console.log(`🔄 Failover: Intentando sincronización con servidor secundario: ${NTP_SERVERS.secondary}`);
      const { time: serverTime, roundTripTime } = await getNTPTimeWithCircuitBreaker(NTP_SERVERS.secondary);
      
      // Actualizar servidor activo en métricas manager
      ntpMetricsManager.setActiveServer(NTP_SERVERS.secondary);
      
      console.log(`✅ Failover exitoso: Sincronización completada con servidor secundario: ${NTP_SERVERS.secondary}`);
      // Eliminada declaración previa de T3, ahora se usa Date.now() como T3
      const T1_T2 = serverTime;
      
      // --- CORRECCIÓN DE CÁLCULO DE SINCRONIZACIÓN EN FAILOVER ---
      // Usar tiempos absolutos para todos los cálculos
      const T0_ms = Number(T0); // clientRequestTime debe ser timestamp absoluto en ms
      const T3 = Date.now(); // Tiempo absoluto cuando el cliente recibe la respuesta
      const actualRTT = T3 - T0_ms;
      // Offset según Cristian: offset = T1_T2 - (T0 + RTT/2)
      const offset = T1_T2 - (T0_ms + actualRTT / 2);
      // Precisión: la mitad del RTT
      const precision = actualRTT / 2;
      return {
        success: true,
        serverTime: T1_T2,
        clientTime: T3,
        offset,
        roundTripTime: actualRTT,
        precision,
        server: serverUsed
      };
      // --- FIN CORRECCIÓN ---
      
    } catch (secondaryError) {
      console.error(`❌ Failover falló: Ambos servidores no disponibles. Primario: ${primaryError}. Secundario: ${secondaryError}`);
      return {
        success: false,
        serverTime: 0,
        clientTime: Date.now(),
        offset: 0,
        roundTripTime: 0,
        precision: 0,
        server: 'ninguno',
        error: `Ambos servidores fallaron. Primario: ${primaryError}. Secundario: ${secondaryError}`
      };
    }
  }
}

/**
 * Valida si un resultado de sincronización es confiable
 */
export function isReliableSync(result: SyncResult): boolean {
  if (!result.success) return false;
  
  // Consideramos confiable si:
  // 1. RTT < 1000ms (latencia razonable)
  // 2. Precisión < 100ms
  const MAX_RTT = 1000;
  const MAX_PRECISION = 100;
  
  return result.roundTripTime < MAX_RTT && result.precision < MAX_PRECISION;
}

/**
 * Formatea tiempo para logging
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString() + '.' + (timestamp % 1000).toString().padStart(3, '0');
}

/**
 * Calcula estadísticas de múltiples sincronizaciones
 */
export function calculateSyncStats(results: SyncResult[]): {
  averageOffset: number;
  averageRTT: number;
  successRate: number;
  reliability: number;
} {
  const successfulResults = results.filter(r => r.success);
  
  if (successfulResults.length === 0) {
    return {
      averageOffset: 0,
      averageRTT: 0,
      successRate: 0,
      reliability: 0
    };
  }
  
  const averageOffset = successfulResults.reduce((sum, r) => sum + r.offset, 0) / successfulResults.length;
  const averageRTT = successfulResults.reduce((sum, r) => sum + r.roundTripTime, 0) / successfulResults.length;
  const successRate = (successfulResults.length / results.length) * 100;
  const reliableResults = successfulResults.filter(isReliableSync);
  const reliability = (reliableResults.length / successfulResults.length) * 100;
  
  return {
    averageOffset,
    averageRTT,
    successRate,
    reliability
  };
}