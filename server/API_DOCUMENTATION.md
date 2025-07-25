# API de Sincronización Temporal - Algoritmo de Cristian

## Descripción General

Este servidor implementa el algoritmo de sincronización de Cristian para proporcionar sincronización temporal precisa entre clientes y un servidor de tiempo autoritativo. El sistema incluye failover automático, circuit breaker pattern, métricas en tiempo real y logging completo.

## Características Principales

- ✅ **Algoritmo de Cristian**: Implementación completa con cálculo de offset y compensación de latencia
- ✅ **Failover Automático**: Servidor primario (ntp.shoa.cl) con respaldo (pool.ntp.org)
- ✅ **Circuit Breaker**: Patrón de protección contra fallos en cascada
- ✅ **Alta Precisión**: Usa `process.hrtime.bigint()` para mediciones temporales precisas
- ✅ **Métricas en Tiempo Real**: Estadísticas de latencia, éxito y rendimiento
- ✅ **Logging Completo**: Sistema de logs con diferentes niveles y filtros
- ✅ **Concurrencia**: Soporte para múltiples clientes simultáneos

## Endpoints de la API

### 1. Obtener Tiempo Actual
```http
GET /api/time
```

**Respuesta:**
```json
{
  "success": true,
  "serverTime": 1642123456789,
  "serverTimeFormatted": "2024-01-13T15:30:56.789.123",
  "highPrecisionTime": 1234567890.123456,
  "timezone": "America/Santiago",
  "timestamp": "2024-01-13T15:30:56.789Z"
}
```

### 2. Sincronizar Tiempo (Algoritmo de Cristian)
```http
POST /api/time/sync
Content-Type: application/json
x-client-id: mi-cliente-id

{
  "clientRequestTime": "1234567890123456789"
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "syncResult": {
    "success": true,
    "serverTime": 1642123456789,
    "clientTime": 1642123456750,
    "offset": 39.5,
    "roundTripTime": 45.2,
    "precision": 2.3,
    "server": "ntp.shoa.cl"
  },
  "isReliable": true,
  "stats": {
    "averageOffset": 35.2,
    "averageRTT": 42.1,
    "successRate": 98.5,
    "reliability": 95.0
  },
  "recommendations": [
    "Sincronización funcionando correctamente."
  ],
  "clientId": "mi-cliente-id",
  "serverProcessingTime": 15.3
}
```

### 3. Estado de Salud del Sistema
```http
GET /api/time/health
```

**Respuesta:**
```json
{
  "success": true,
  "timestamp": "2024-01-13T15:30:56.789Z",
  "overall": "healthy",
  "servers": {
    "primary": {
      "server": "ntp.shoa.cl",
      "status": "healthy",
      "circuitBreakerState": "closed",
      "stats": { "fires": 0, "requests": 150 },
      "metrics": {
        "averageLatency": 35.2,
        "successRate": 98.5,
        "activeClients": 3
      }
    },
    "secondary": {
      "server": "pool.ntp.org",
      "status": "healthy",
      "circuitBreakerState": "closed"
    }
  },
  "connectivity": [
    { "server": "ntp.shoa.cl", "status": "ok" },
    { "server": "pool.ntp.org", "status": "ok" }
  ],
  "activeClients": 3,
  "uptime": 3600.5
}
```

### 4. Métricas Detalladas
```http
GET /api/time/metrics?clientId=mi-cliente&period=hour
```

**Parámetros de Query:**
- `clientId` (opcional): Filtrar por cliente específico
- `server` (opcional): `ntp.shoa.cl` o `pool.ntp.org`
- `period` (opcional): `hour`, `day`, `week`

**Respuesta:**
```json
{
  "success": true,
  "timestamp": "2024-01-13T15:30:56.789Z",
  "servers": [
    {
      "server": "ntp.shoa.cl",
      "averageLatency": 35.2,
      "successRate": 98.5,
      "responseTime": 42.1,
      "failoverCount": 2,
      "activeClients": 3,
      "lastSync": 1642123456789
    }
  ],
  "clients": [
    {
      "clientId": "mi-cliente",
      "totalSyncs": 50,
      "stats": {
        "averageOffset": 35.2,
        "averageRTT": 42.1,
        "successRate": 98.0,
        "reliability": 95.0
      },
      "reliableSyncs": 47
    }
  ],
  "system": {
    "totalSyncs": 1250,
    "activeSessions": 8,
    "uptime": 3600.5
  }
}
```

### 5. Logs del Sistema
```http
GET /api/time/logs?level=ERROR&limit=100
```

**Parámetros de Query:**
- `level` (opcional): `ERROR`, `WARN`, `INFO`, `DEBUG`, `TRACE`
- `clientId` (opcional): Filtrar por cliente
- `server` (opcional): Filtrar por servidor
- `since` (opcional): Fecha ISO8601
- `limit` (opcional): Máximo 1000

### 6. Limpiar Logs
```http
DELETE /api/time/logs
```

## Algoritmo de Cristian - Implementación

### Proceso de Sincronización

1. **T0**: Cliente envía solicitud de tiempo
2. **T1**: Servidor recibe solicitud (≈ tiempo del servidor)
3. **T2**: Servidor envía respuesta (≈ tiempo del servidor)
4. **T3**: Cliente recibe respuesta

### Cálculos

```typescript
const networkDelay = (T3 - T0) / 2;  // RTT/2
const offset = serverTime - T0 - networkDelay;
const precision = |actualRTT - estimatedRTT| / 2;
```

### Criterios de Confiabilidad

- **RTT < 1000ms**: Latencia aceptable
- **Precisión < 100ms**: Sincronización confiable
- **Tasa de éxito > 95%**: Sistema estable

## Failover y Circuit Breaker

### Configuración del Circuit Breaker

- **Timeout**: 5 segundos
- **Umbral de error**: 50%
- **Tiempo de reset**: 30 segundos
- **Ventana de tiempo**: 60 segundos

### Secuencia de Failover

1. Intento con servidor primario (ntp.shoa.cl)
2. Si falla, automáticamente usa servidor secundario (pool.ntp.org)
3. Circuit breaker protege contra fallos en cascada
4. Logging completo de eventos de failover

## Casos de Uso

### Cliente Básico
```typescript
import axios from 'axios';

const clientId = 'mi-aplicacion';
const requestTime = BigInt(Date.now() * 1000000); // Nanosegundos

const response = await axios.post('http://localhost:4000/api/time/sync', {
  clientRequestTime: requestTime.toString()
}, {
  headers: { 'x-client-id': clientId }
});

if (response.data.success) {
  const offset = response.data.syncResult.offset;
  console.log(`Ajuste de tiempo necesario: ${offset}ms`);
}
```

### Monitoreo de Salud
```typescript
// Verificar estado cada 30 segundos
setInterval(async () => {
  const health = await axios.get('http://localhost:4000/api/time/health');
  if (health.data.overall !== 'healthy') {
    console.warn('⚠️ Sistema de tiempo con problemas');
  }
}, 30000);
```

## Métricas y Monitoreo

### Métricas Clave
- **Latencia Promedio**: Tiempo de respuesta de servidores NTP
- **Tasa de Éxito**: Porcentaje de sincronizaciones exitosas
- **Frecuencia de Failover**: Cambios entre servidores
- **Clientes Activos**: Número de clientes sincronizando
- **Tiempo de Respuesta**: Latencia del API

### Alertas Recomendadas
- RTT > 500ms: Latencia alta
- Tasa de éxito < 95%: Problemas de conectividad
- Circuit breaker abierto: Servidor NTP no disponible
- Offset > 1000ms: Diferencia temporal significativa

## Códigos de Error

- **400**: Parámetros inválidos
- **500**: Error interno del servidor
- **503**: Servicio NTP no disponible (ambos servidores fallan)

## Configuración y Deployment

### Variables de Entorno
```env
PORT=4000
NODE_ENV=production
FRONTEND_URL=http://localhost:5173
```

### Inicio del Servidor
```bash
npm run dev  # Desarrollo
npm start    # Producción
```

### Pruebas
```bash
npm run test              # Pruebas unitarias
npm run test:integration  # Pruebas de integración
npm run test:client       # Cliente de prueba
```

## Limitaciones y Consideraciones

1. **Precisión de Red**: La precisión depende de la estabilidad de la red
2. **Zona Horaria**: El servidor debe estar en la zona horaria correcta
3. **Recursos**: Cada cliente activo consume memoria para el historial
4. **Concurrencia**: Límite práctico de ~1000 clientes concurrentes

## Soporte y Mantenimiento

- Los logs se rotan automáticamente (máximo 1000 entradas)
- Las métricas se reinician cada hora
- Circuit breaker se auto-recupera después de 30 segundos
- Historial de clientes limitado a 50 sincronizaciones por cliente
