
import { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  createApiService,
  generateClientId,
  validateServerUrl,
} from './services/api';
import {
  useSync,
  useServerTime,
  useAutoSync,
  useServerConnection,
  useLocalStorage,
  useRealTimeDisplay,
} from './hooks';
import { validateClientName, validateSettings } from './types';
import type { AppSettings, ClientState } from './types';
import SyncButton from './components/SyncButton';
import MetricsCard from './components/MetricsCard';
import SyncHistory from './components/SyncHistory';
import ServerStatus from './components/ServerStatus';

// Crear el cliente de React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CristianSyncApp />
    </QueryClientProvider>
  );
}

function CristianSyncApp() {
  // Estados locales
  const [apiService] = useState(() => 
    createApiService('http://localhost:4000', generateClientId())
  );
  
  // Flag para evitar múltiples inicializaciones
  const isInitialized = useRef(false);
  
  // Configuraciones persistentes
  const [settings, setSettings] = useLocalStorage<AppSettings>('cristian-settings', {
    serverUrl: 'http://localhost:4000',
    autoSyncEnabled: false,
    syncInterval: 30,
    maxHistoryItems: 50,
    showAdvancedMetrics: false,
    theme: 'system',
    notifications: true,
  });

  const [clientState, setClientState] = useLocalStorage<ClientState>('cristian-client', {
    id: generateClientId(),
    name: `Cliente-${Math.random().toString(36).substring(2, 8)}`,
    isConnected: false,
    syncHistory: [], // Asegurar que siempre inicie vacío
    autoSync: false,
    syncInterval: 30,
  });

  // Hooks
  const { sync, isLoading: isSyncing, lastResult } = useSync(apiService);
  const { data: serverTime } = useServerTime(apiService, true);
  const { isConnected } = useServerConnection(apiService);
  const autoSync = useAutoSync(apiService, settings.syncInterval);
  const currentTime = useRealTimeDisplay(); // Tiempo local en tiempo real

  // Formularios
  const clientNameForm = useForm({ 
    defaultValues: { name: clientState.name }
  });
  const settingsForm = useForm({ 
    defaultValues: settings,
    values: settings // Sincronizar con el estado actual
  });

  // Efecto para sincronizar el formulario con el estado del cliente
  useEffect(() => {
    clientNameForm.setValue('name', clientState.name);
  }, [clientState.name, clientNameForm]);

  // Efectos
  useEffect(() => {
    setClientState(prev => ({ ...prev, isConnected }));
  }, [isConnected]); // Remover setClientState de las dependencias

  // Limpiar datos corruptos del localStorage al inicializar
  useEffect(() => {
    if (!isInitialized.current) {
      // Si el syncHistory tiene más de 100 elementos o datos inválidos, limpiar
      if (clientState.syncHistory.length > 100 || 
          clientState.syncHistory.some(s => !s.hasOwnProperty('success'))) {
        console.log('Limpiando datos corruptos del localStorage');
        setClientState(prev => ({ ...prev, syncHistory: [] }));
      }
      isInitialized.current = true;
    }
  }, []); // Solo ejecutar una vez al montar, usar una ref o estado inicial si es necesario

  useEffect(() => {
    if (lastResult) {
      setClientState(prev => ({
        ...prev,
        lastSync: lastResult.syncResult,
        syncHistory: [...prev.syncHistory, lastResult.syncResult].slice(-settings.maxHistoryItems),
      }));

      // Mostrar notificación con react-toastify
      if (settings.notifications) {
        if (lastResult.success) {
          toast.success(`Sincronización exitosa - Offset: ${lastResult.syncResult.offset.toFixed(2)}ms con ${lastResult.syncResult.server}`, {
            position: 'top-right',
            autoClose: 3000,
          });
        } else {
          toast.error(`Error de sincronización: ${lastResult.syncResult.error || 'Error desconocido'}`, {
            position: 'top-right',
            autoClose: 5000,
          });
        }
      }
    }
  }, [lastResult, settings.notifications, settings.maxHistoryItems]); // Remover setClientState

  // Handlers
  const handleSync = async () => {
    await sync();
  };

  const handleClientNameSubmit = (data: { name: string }) => {
    const validation = validateClientName(data);
    if (validation.success) {
      setClientState(prev => ({ ...prev, name: data.name }));
      toast.success(`Cliente renombrado a: ${data.name}`, {
        position: 'top-right',
        autoClose: 2000,
      });
    } else {
      toast.error('Nombre de cliente inválido', {
        position: 'top-right',
        autoClose: 3000,
      });
    }
  };

  const handleSettingsSubmit = (data: AppSettings) => {
    const validation = validateSettings(data);
    if (validation.success) {
      setSettings(data);
      
      // Actualizar URL del servidor si cambió
      if (data.serverUrl !== settings.serverUrl) {
        if (validateServerUrl(data.serverUrl)) {
          // Note: En una implementación completa, se debería propagar este cambio
          // a través de un contexto o estado global para reinicializar el servicio
          toast.info(`URL configurada: ${data.serverUrl}`, {
            position: 'top-right',
            autoClose: 3000,
          });
        }
      }

      // Actualizar intervalo de auto-sync
      if (data.syncInterval !== settings.syncInterval) {
        autoSync.setInterval(data.syncInterval);
      }

      toast.success('Los cambios se han aplicado correctamente', {
        position: 'top-right',
        autoClose: 2000,
      });
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                ⏰ Algoritmo de Cristian
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Sincronización temporal para sistemas distribuidos
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                isConnected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
              </div>
              
              <div className="text-sm text-gray-600">
                Cliente: <span className="font-medium">{clientState.name}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Contenedor de ToastContainer para notificaciones */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tiempo actual y sincronización */}
            <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  Tiempo Actual
                </h2>
                
                {serverTime ? (
                  <div className="space-y-2">
                    <div className="text-3xl font-mono font-bold text-blue-600">
                      {formatTime(serverTime.serverTime)}
                    </div>
                    <div className="text-sm text-gray-600">
                      Servidor: {serverTime.timezone}
                    </div>
                    <div className="text-xs text-gray-500">
                      Local: {formatTime(currentTime)}
                    </div>
                  </div>
                ) : (
                  <div className="text-3xl font-mono font-bold text-gray-400">
                    --:--:--.---
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <SyncButton
                  onSync={handleSync}
                  isLoading={isSyncing}
                  disabled={!isConnected}
                  size="lg"
                />
                
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={autoSync.isEnabled}
                      onChange={autoSync.toggle}
                      className="rounded"
                    />
                    Auto-sync
                  </label>
                  
                  {autoSync.isEnabled && (
                    <span className="text-sm text-gray-600">
                      (próximo en {autoSync.nextSyncIn}s)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Métricas de la última sincronización */}
            {clientState.lastSync && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricsCard
                  title="Diferencia Tiempo"
                  subtitle="Offset del reloj"
                  value={`${clientState.lastSync.offset >= 0 ? '+' : ''}${Math.round(clientState.lastSync.offset)}ms`}
                  icon="⚡"
                  color={Math.abs(clientState.lastSync.offset) < 50 ? 'green' : 'yellow'}
                />
                
                <MetricsCard
                  title="Tiempo de Red"
                  subtitle="Round Trip Time"
                  value={`${Math.round(clientState.lastSync.roundTripTime)}ms`}
                  icon="🌐"
                  color={clientState.lastSync.roundTripTime < 100 ? 'green' : 'yellow'}
                />
                
                <MetricsCard
                  title="Exactitud"
                  subtitle="Precisión estimada"
                  value={`${Math.round(clientState.lastSync.precision)}ms`}
                  icon="🎯"
                  color={clientState.lastSync.precision < 50 ? 'green' : 'yellow'}
                />
                
                <MetricsCard
                  title="Servidor"
                  value={clientState.lastSync.server}
                  icon="🏢"
                  color="blue"
                />
              </div>
            )}

            {/* Estado del servidor */}
            <ServerStatus apiService={apiService} />

            {/* Historial de sincronización */}
            <SyncHistory 
              history={clientState.syncHistory}
              maxItems={10}
              showDetails={settings.showAdvancedMetrics}
            />
          </div>

          {/* Panel lateral */}
          <div className="space-y-6">
            {/* Configuración del cliente */}
            <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                ⚙️ Configuración
              </h3>
              
              <form onSubmit={clientNameForm.handleSubmit(handleClientNameSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre del Cliente
                  </label>
                  <div className="flex gap-2">
                    <input
                      {...clientNameForm.register('name', { required: true })}
                      type="text"
                      className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm"
                      placeholder="Nombre del cliente"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      ✓
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Actual: {clientState.name}
                  </div>
                </div>
              </form>

              <div className="mt-4">
                <button
                  onClick={() => {
                    setClientState(prev => ({ ...prev, syncHistory: [] }));
                    toast.info('Estadísticas reiniciadas', {
                      position: 'top-right',
                      autoClose: 2000,
                    });
                  }}
                  className="w-full px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                >
                  🗑️ Limpiar Estadísticas
                </button>
              </div>

              <form onSubmit={settingsForm.handleSubmit(handleSettingsSubmit)} className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL del Servidor
                  </label>
                  <input
                    {...settingsForm.register('serverUrl')}
                    type="url"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="http://localhost:4000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Intervalo Auto-sync (segundos)
                  </label>
                  <input
                    {...settingsForm.register('syncInterval', { valueAsNumber: true })}
                    type="number"
                    min="5"
                    max="300"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      {...settingsForm.register('showAdvancedMetrics')}
                      type="checkbox"
                      className="rounded"
                    />
                    Mostrar métricas avanzadas
                  </label>
                  
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      {...settingsForm.register('notifications')}
                      type="checkbox"
                      className="rounded"
                    />
                    Activar notificaciones
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Guardar Configuración
                </button>
              </form>
            </div>

            {/* Estadísticas rápidas */}
            <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                📊 Estadísticas
              </h3>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total sincronizaciones:</span>
                  <span className="font-medium">{clientState.syncHistory.length}</span>
                </div>
                
                {clientState.syncHistory.length > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Éxito:</span>
                      <span className="font-medium text-green-600">
                        {clientState.syncHistory.filter(s => s.success).length}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Fallos:</span>
                      <span className="font-medium text-red-600">
                        {clientState.syncHistory.filter(s => !s.success).length}
                      </span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Offset promedio:</span>
                      <span className="font-medium">
                        {Math.abs(clientState.syncHistory
                          .filter(s => s.success)
                          .reduce((sum, s) => sum + s.offset, 0) / 
                          Math.max(clientState.syncHistory.filter(s => s.success).length, 1)
                        ).toFixed(2)}ms
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">RTT promedio:</span>
                      <span className="font-medium">
                        {(clientState.syncHistory
                          .filter(s => s.success)
                          .reduce((sum, s) => sum + s.roundTripTime, 0) / 
                          Math.max(clientState.syncHistory.filter(s => s.success).length, 1)
                        ).toFixed(2)}ms
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
