import axios from 'axios';
import { getHighPrecisionTime, hrtimeToMs } from '../utils/timeUtils';

const SERVER_URL = 'http://localhost:4000/api/time';

interface TestResult {
  success: boolean;
  latency: number;
  offset: number;
  error?: string;
}

class CristianClient {
  private clientId: string;
  private baseURL: string;

  constructor(clientId: string, baseURL: string = SERVER_URL) {
    this.clientId = clientId;
    this.baseURL = baseURL;
  }

  /**
   * Sincronizar tiempo con el servidor usando algoritmo de Cristian
   */
  async syncTime(): Promise<TestResult> {
    try {
      const T0 = getHighPrecisionTime(); // Tiempo de solicitud
      
      const response = await axios.post(`${this.baseURL}/sync`, {
        clientRequestTime: T0.toString()
      }, {
        headers: {
          'x-client-id': this.clientId,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const T3 = getHighPrecisionTime(); // Tiempo de respuesta
      const roundTripTime = hrtimeToMs(T3 - T0);

      if (response.data.success) {
        return {
          success: true,
          latency: roundTripTime,
          offset: response.data.syncResult.offset,
        };
      } else {
        return {
          success: false,
          latency: roundTripTime,
          offset: 0,
          error: response.data.error
        };
      }

    } catch (error) {
      return {
        success: false,
        latency: 0,
        offset: 0,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Obtener tiempo actual del servidor
   */
  async getCurrentTime() {
    try {
      const response = await axios.get(`${this.baseURL}/`, {
        headers: {
          'x-client-id': this.clientId
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error obteniendo tiempo:', error);
      return null;
    }
  }

  /**
   * Verificar estado de salud del servidor
   */
  async getHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/health`);
      return response.data;
    } catch (error) {
      console.error('Error verificando salud:', error);
      return null;
    }
  }

  /**
   * Obtener métricas del servidor
   */
  async getMetrics() {
    try {
      const response = await axios.get(`${this.baseURL}/metrics?clientId=${this.clientId}`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo métricas:', error);
      return null;
    }
  }
}

/**
 * Ejecutar batería de pruebas
 */
async function runTests() {
  console.log('🧪 Iniciando pruebas del algoritmo de Cristian\n');

  // Crear múltiples clientes para simular concurrencia
  const clients = [
    new CristianClient('test-client-1'),
    new CristianClient('test-client-2'),
    new CristianClient('test-client-3')
  ];

  // Prueba 1: Verificar salud del servidor
  console.log('📋 Prueba 1: Verificación de salud del servidor');
  const health = await clients[0].getHealth();
  if (health) {
    console.log(`✅ Estado general: ${health.overall}`);
    console.log(`📊 Servidores NTP: ${health.servers.primary.status} | ${health.servers.secondary.status}`);
  } else {
    console.log('❌ No se pudo verificar la salud del servidor');
    return;
  }

  // Prueba 2: Sincronización individual
  console.log('\n📋 Prueba 2: Sincronización individual');
  for (let i = 0; i < clients.length; i++) {
    const result = await clients[i].syncTime();
    if (result.success) {
      console.log(`✅ Cliente ${i + 1}: Offset=${result.offset.toFixed(2)}ms, Latencia=${result.latency.toFixed(2)}ms`);
    } else {
      console.log(`❌ Cliente ${i + 1}: ${result.error}`);
    }
  }

  // Prueba 3: Sincronización concurrente
  console.log('\n📋 Prueba 3: Sincronización concurrente (10 requests)');
  const concurrentPromises = [];
  for (let i = 0; i < 10; i++) {
    const client = clients[i % clients.length];
    concurrentPromises.push(client.syncTime());
  }

  const concurrentResults = await Promise.all(concurrentPromises);
  const successful = concurrentResults.filter(r => r.success);
  const avgLatency = successful.reduce((sum, r) => sum + r.latency, 0) / successful.length;
  const avgOffset = successful.reduce((sum, r) => sum + Math.abs(r.offset), 0) / successful.length;

  console.log(`✅ Exitosas: ${successful.length}/10`);
  console.log(`📊 Latencia promedio: ${avgLatency.toFixed(2)}ms`);
  console.log(`📊 Offset promedio: ${avgOffset.toFixed(2)}ms`);

  // Prueba 4: Prueba de estrés
  console.log('\n📋 Prueba 4: Prueba de estrés (50 requests en ráfaga)');
  const stressPromises = [];
  const startTime = Date.now();
  
  for (let i = 0; i < 50; i++) {
    const client = clients[i % clients.length];
    stressPromises.push(client.syncTime());
  }

  const stressResults = await Promise.all(stressPromises);
  const stressSuccessful = stressResults.filter(r => r.success);
  const totalTime = Date.now() - startTime;

  console.log(`✅ Exitosas: ${stressSuccessful.length}/50`);
  console.log(`⏱️ Tiempo total: ${totalTime}ms`);
  console.log(`📈 Throughput: ${(50 / totalTime * 1000).toFixed(2)} req/s`);

  // Prueba 5: Obtener métricas finales
  console.log('\n📋 Prueba 5: Métricas finales del sistema');
  const metrics = await clients[0].getMetrics();
  if (metrics) {
    console.log('📊 Métricas de servidores NTP:');
    metrics.servers.forEach((server: any) => {
      console.log(`  ${server.server}: Latencia=${server.averageLatency.toFixed(2)}ms, Éxito=${server.successRate.toFixed(1)}%`);
    });
    
    console.log('\n📊 Estadísticas del sistema:');
    console.log(`  Total sincronizaciones: ${metrics.system.totalSyncs}`);
    console.log(`  Sesiones activas: ${metrics.system.activeSessions}`);
    console.log(`  Tiempo activo: ${(metrics.system.uptime / 60).toFixed(1)} minutos`);
  }

  console.log('\n🎉 Pruebas completadas');
}

/**
 * Simulación de failover
 */
async function testFailover() {
  console.log('\n🔄 Prueba de Failover');
  console.log('Para probar el failover, desconecte la red o bloquee ntp.shoa.cl y ejecute esta función');
  
  const client = new CristianClient('failover-test-client');
  
  for (let i = 0; i < 5; i++) {
    console.log(`\nIntento ${i + 1}:`);
    const result = await client.syncTime();
    if (result.success) {
      console.log(`✅ Sincronización exitosa - Offset: ${result.offset.toFixed(2)}ms`);
    } else {
      console.log(`❌ Fallo: ${result.error}`);
    }
    
    // Esperar 2 segundos entre intentos
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Ejecutar pruebas si este archivo se ejecuta directamente
if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error en las pruebas:', error);
      process.exit(1);
    });
}

export { CristianClient, runTests, testFailover };
