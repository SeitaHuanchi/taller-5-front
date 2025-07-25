import { useState } from 'react';
import type { CristianApiService } from '../services/api';
import { useServerHealth } from '../hooks';

interface ServerStatusProps {
  apiService: CristianApiService;
}

function ServerStatus({ apiService }: ServerStatusProps) {
  const { health, isLoading: healthLoading } = useServerHealth(apiService, 2000); // Cada 2 segundos
  const [isSimulating, setIsSimulating] = useState(false);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  // Función auxiliar para determinar si un servidor está activo
  const isServerActive = (serverType: 'primary' | 'secondary') => {
    if (!health?.servers || !health?.connectivity) return false;
    
    const serverHealth = health.servers[serverType];
    const serverName = serverHealth?.server;
    
    // Buscar el test de conectividad correspondiente
    const connectivityTest = health.connectivity.find(conn => 
      conn.server === serverName
    );
    
    // Un servidor está activo si:
    // 1. Su test de conectividad está OK (esto es lo más importante)
    // 2. Y su circuit breaker no está completamente abierto (open)
    const isConnected = connectivityTest?.status === 'ok';
    const isCircuitNotOpen = serverHealth?.circuitBreakerState !== 'open';
    
    // Prioritizar la conectividad sobre el estado degraded
    // Si puede conectarse, está activo (aunque sea degraded)
    return isConnected && isCircuitNotOpen;
  };

  // Función auxiliar para determinar si un servidor está siendo usado activamente
  const isServerInUse = (serverType: 'primary' | 'secondary') => {
    if (!health?.servers) return false;
    return health.servers[serverType]?.isActive === true;
  };

  // Función auxiliar para obtener el estado visual del servidor
  const getServerDisplayStatus = (serverType: 'primary' | 'secondary') => {
    const isActive = isServerActive(serverType);
    const isInUse = isServerInUse(serverType);
    
    if (isInUse) {
      return {
        status: 'En Uso',
        color: 'green',
        bgColor: 'bg-green-50 border-green-200',
        textColor: 'text-green-600',
        dotColor: 'bg-green-500'
      };
    } else if (isActive) {
      return {
        status: serverType === 'primary' ? 'Activo' : 'Disponible',
        color: serverType === 'primary' ? 'blue' : 'blue',
        bgColor: serverType === 'primary' ? 'bg-blue-50 border-blue-200' : 'bg-blue-50 border-blue-200',
        textColor: serverType === 'primary' ? 'text-blue-600' : 'text-blue-600',
        dotColor: serverType === 'primary' ? 'bg-blue-500' : 'bg-blue-500'
      };
    } else {
      return {
        status: 'Inactivo',
        color: 'red',
        bgColor: 'bg-red-50 border-red-200',
        textColor: 'text-red-600',
        dotColor: 'bg-red-500'
      };
    }
  };

  // Determinar estados de los servidores basado en la información completa
  const primaryStatus = getServerDisplayStatus('primary');
  const secondaryStatus = getServerDisplayStatus('secondary');

  // Debug temporal para ver los datos del servidor
  if (health) {
    console.log('=== HEALTH DEBUG START ===');
    console.log('Full health response:', JSON.stringify(health, null, 2));
    console.log('Primary server data:', {
      server: health?.servers?.primary?.server,
      status: health?.servers?.primary?.status,
      circuitBreakerState: health?.servers?.primary?.circuitBreakerState,
      stats: health?.servers?.primary?.stats
    });
    console.log('Secondary server data:', {
      server: health?.servers?.secondary?.server,
      status: health?.servers?.secondary?.status,
      circuitBreakerState: health?.servers?.secondary?.circuitBreakerState,
      stats: health?.servers?.secondary?.stats
    });
    console.log('Connectivity tests:', health?.connectivity);
    console.log('Calculated states:', {
      primaryStatus: primaryStatus.status,
      secondaryStatus: secondaryStatus.status,
      primaryInUse: isServerInUse('primary'),
      secondaryInUse: isServerInUse('secondary')
    });
    console.log('=== HEALTH DEBUG END ===');
  }

  const handleSimulateFailure = async () => {
    setIsSimulating(true);
    try {
      const response = await fetch(`${apiService.getServerUrl()}/api/time/admin/simulate-failure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'fail-primary',
          duration: 30000 // 30 segundos
        })
      });
      
      if (response.ok) {
        // Mostrar notificación de éxito
        console.log('Simulación de fallo iniciada');
      }
    } catch (error) {
      console.error('Error simulando fallo:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleRestoreService = async () => {
    setIsSimulating(true);
    try {
      const response = await fetch(`${apiService.getServerUrl()}/api/time/admin/simulate-failure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'restore'
        })
      });
      
      if (response.ok) {
        console.log('Servicio restaurado');
      }
    } catch (error) {
      console.error('Error restaurando servicio:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  if (healthLoading && !health) {
    return (
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          🏢 Estado del Servidor
        </h2>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
        🏢 Estado del Servidor
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Estado General */}
        <div className={`p-4 rounded-lg border ${
          health?.overall === 'healthy' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Estado General</span>
            <div className={`w-3 h-3 rounded-full ${
              health?.overall === 'healthy' ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
          </div>
          <div className={`text-lg font-semibold ${
            health?.overall === 'healthy' ? 'text-green-800' : 'text-red-800'
          }`}>
            {health?.overall === 'healthy' ? 'Saludable' : 'Error'}
          </div>
        </div>

        {/* Servidor NTP Primario */}
        <div className={`p-4 rounded-lg border ${primaryStatus.bgColor}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Servidor Primario</span>
            <div className={`w-3 h-3 rounded-full ${primaryStatus.dotColor}`}></div>
          </div>
          <div className="text-sm font-medium text-gray-800">
            {health?.servers?.primary?.server || 'ntp.shoa.cl'}
          </div>
          <div className={`text-xs ${primaryStatus.textColor}`}>
            {primaryStatus.status}
          </div>
        </div>

        {/* Servidor NTP Secundario */}
        <div className={`p-4 rounded-lg border ${secondaryStatus.bgColor}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Servidor Secundario</span>
            <div className={`w-3 h-3 rounded-full ${secondaryStatus.dotColor}`}></div>
          </div>
          <div className="text-sm font-medium text-gray-800">
            {health?.servers?.secondary?.server || 'pool.ntp.org'}
          </div>
          <div className={`text-xs ${secondaryStatus.textColor}`}>
            {secondaryStatus.status}
          </div>
        </div>

        {/* Clientes Activos */}
        <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Clientes Activos</span>
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          </div>
          <div className="text-lg font-semibold text-blue-800">
            {health?.activeClients || 0}
          </div>
          <div className="text-xs text-blue-600">
            Conectados ahora
          </div>
        </div>
      </div>

      {/* Métricas del Servidor Primario */}
      {health?.servers?.primary && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            ⚡ Métricas Servidor Primario
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Latencia promedio</div>
              <div className="text-lg font-semibold text-gray-800">
                {health.servers.primary.metrics?.averageLatency?.toFixed(2) || '0.00'}ms
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Tasa de éxito</div>
              <div className="text-lg font-semibold text-gray-800">
                {health.servers.primary.metrics?.successRate?.toFixed(1) || '0.0'}%
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Circuit Breaker</div>
              <div className={`text-lg font-semibold ${
                health.servers.primary.circuitBreakerState === 'closed' ? 'text-green-800' : 'text-red-800'
              }`}>
                {health.servers.primary.circuitBreakerState === 'closed' ? 'Cerrado' : 'Abierto'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Métricas del Servidor Secundario */}
      {health?.servers?.secondary && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            🔄 Métricas Servidor Secundario
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Latencia promedio</div>
              <div className="text-lg font-semibold text-gray-800">
                {health.servers.secondary.metrics?.averageLatency?.toFixed(2) || '0.00'}ms
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Tasa de éxito</div>
              <div className="text-lg font-semibold text-gray-800">
                {health.servers.secondary.metrics?.successRate?.toFixed(1) || '0.0'}%
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Circuit Breaker</div>
              <div className={`text-lg font-semibold ${
                health.servers.secondary.circuitBreakerState === 'closed' ? 'text-green-800' : 'text-red-800'
              }`}>
                {health.servers.secondary.circuitBreakerState === 'closed' ? 'Cerrado' : 'Abierto'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Información del Sistema */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          ℹ️ Información del Sistema
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">Tiempo activo</div>
            <div className="font-medium">
              {health?.uptime ? formatUptime(health.uptime) : '0h 0m 0s'}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">Última actualización</div>
            <div className="font-medium">
              {health?.timestamp 
                ? new Date(health.timestamp).toLocaleTimeString('es-ES')
                : 'Nunca'
              }
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">Conectividad NTP</div>
            <div className="font-medium">
              {health?.connectivity ? 
                `${health.connectivity.filter(c => c.status === 'ok').length}/${health.connectivity.length} OK` : 
                'Desconocido'
              }
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-600">Solicitudes totales</div>
            <div className="font-medium">
              {health?.servers?.primary?.stats?.requests || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Controles de simulación */}
      <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          🧪 Herramientas de Testing
        </h3>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSimulateFailure}
            disabled={isSimulating}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              isSimulating 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {isSimulating ? '⏳ Procesando...' : '⚠️ Simular Fallo NTP Primario'}
          </button>
          
          <button
            onClick={handleRestoreService}
            disabled={isSimulating}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              isSimulating 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isSimulating ? '⏳ Procesando...' : '✅ Restaurar Servicio'}
          </button>
        </div>
        
        <p className="text-xs text-gray-600 mt-2">
          * La simulación de fallo dura 30 segundos y forzará el uso del servidor secundario
        </p>
      </div>

      {/* Actualización automática */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        {healthLoading ? (
          <span className="flex items-center justify-center gap-1">
            <div className="animate-spin w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full"></div>
            Actualizando...
          </span>
        ) : (
          `Última actualización: ${new Date().toLocaleTimeString('es-ES')}`
        )}
      </div>
    </div>
  );
}

export default ServerStatus;