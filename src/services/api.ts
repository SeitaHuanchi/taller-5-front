import axios from 'axios';
import type { AxiosResponse } from 'axios';
import type { 
  SyncResponse, 
  ServerTime, 
  HealthStatus, 
  ClientMetrics
} from '../types';

// Configuración base de Axios
const createApiClient = (baseURL: string) => {
  return axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export class CristianApiService {
  private api;
  private clientId: string;
  private serverUrl: string;

  constructor(serverUrl: string, clientId: string) {
    this.serverUrl = serverUrl;
    this.api = createApiClient(serverUrl);
    this.clientId = clientId;
    
    // Interceptor para agregar el client-id a todas las requests
    this.api.interceptors.request.use((config) => {
      config.headers['x-client-id'] = this.clientId;
      return config;
    });

    // Interceptor para manejar errores de response
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error);
        throw error;
      }
    );
  }

  /**
   * Obtener información general del servidor
   */
  async getServerInfo(): Promise<any> {
    try {
      const response: AxiosResponse = await this.api.get('/');
      return response.data;
    } catch (error) {
      throw new Error(`Error obteniendo información del servidor: ${error}`);
    }
  }

  /**
   * Obtener tiempo actual del servidor
   */
  async getServerTime(): Promise<ServerTime> {
    try {
      const response: AxiosResponse<ServerTime> = await this.api.get('/api/time');
      return response.data;
    } catch (error) {
      throw new Error(`Error obteniendo tiempo del servidor: ${error}`);
    }
  }

  /**
   * Sincronizar tiempo usando algoritmo de Cristian
   */
  async syncTime(): Promise<SyncResponse> {
    try {
      // Obtener tiempo de alta precisión en nanosegundos
      const clientRequestTime = this.getHighPrecisionTime();
      
      const response: AxiosResponse<SyncResponse> = await this.api.post('/api/time/sync', {
        clientRequestTime: clientRequestTime.toString()
      });

      return response.data;
    } catch (error) {
      throw new Error(`Error sincronizando tiempo: ${error}`);
    }
  }

  /**
   * Obtener estado de salud del sistema
   */
  async getHealth(): Promise<HealthStatus> {
    try {
      const response: AxiosResponse<HealthStatus> = await this.api.get('/api/time/health');
      return response.data;
    } catch (error) {
      throw new Error(`Error obteniendo estado de salud: ${error}`);
    }
  }

  /**
   * Obtener métricas del cliente
   */
  async getClientMetrics(): Promise<ClientMetrics> {
    try {
      const response: AxiosResponse<{ clients: ClientMetrics[] }> = await this.api.get(`/api/time/metrics?clientId=${this.clientId}`);
      
      // Buscar las métricas del cliente actual
      const clientMetrics = response.data.clients?.find(c => c.clientId === this.clientId);
      
      if (!clientMetrics) {
        throw new Error('No se encontraron métricas para este cliente');
      }
      
      return clientMetrics;
    } catch (error) {
      throw new Error(`Error obteniendo métricas del cliente: ${error}`);
    }
  }

  /**
   * Obtener métricas generales del sistema
   */
  async getSystemMetrics(): Promise<any> {
    try {
      const response: AxiosResponse = await this.api.get('/api/time/metrics');
      return response.data;
    } catch (error) {
      throw new Error(`Error obteniendo métricas del sistema: ${error}`);
    }
  }

  /**
   * Obtener logs del sistema
   */
  async getLogs(options?: {
    level?: string;
    limit?: number;
    since?: string;
  }): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (options?.level) params.append('level', options.level);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.since) params.append('since', options.since);
      
      const response: AxiosResponse = await this.api.get(`/api/time/logs?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw new Error(`Error obteniendo logs: ${error}`);
    }
  }

  /**
   * Verificar conectividad con el servidor
   */
  async ping(): Promise<boolean> {
    try {
      const response = await this.api.get('/api/time/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Obtener tiempo de alta precisión en nanosegundos
   * Simula process.hrtime.bigint() del lado del cliente
   */
  private getHighPrecisionTime(): bigint {
    // En el navegador, usamos performance.now() que tiene precisión de microsegundos
    // Lo convertimos a nanosegundos para compatibilidad con el servidor
    const performanceTime = performance.now();
    const dateTime = Date.now();
    
    // Combinamos ambos para mejor precisión
    return BigInt(Math.floor(dateTime * 1000000)) + BigInt(Math.floor((performanceTime % 1) * 1000000));
  }

  /**
   * Cambiar URL del servidor
   */
  updateServerUrl(newUrl: string): void {
    this.api.defaults.baseURL = newUrl;
  }

  /**
   * Cambiar client ID
   */
  updateClientId(newClientId: string): void {
    this.clientId = newClientId;
  }

  /**
   * Obtener client ID actual
   */
  getClientId(): string {
    return this.clientId;
  }

  /**
   * Obtener URL del servidor actual
   */
  getServerUrl(): string {
    return this.serverUrl;
  }
}

// Función para crear una instancia del servicio
export const createApiService = (serverUrl: string, clientId: string): CristianApiService => {
  return new CristianApiService(serverUrl, clientId);
};

// Función para generar un client ID único
export const generateClientId = (prefix: string = 'client'): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
};

// Función para validar URL del servidor
export const validateServerUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export default CristianApiService;
