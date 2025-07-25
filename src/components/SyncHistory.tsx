import type { SyncHistoryProps } from '../types';

const SyncHistory = ({ 
  history, 
  maxItems = 10, 
  showDetails = false 
}: SyncHistoryProps) => {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const formatOffset = (offset: number) => {
    const sign = offset >= 0 ? '+' : '';
    return `${sign}${offset.toFixed(2)}ms`;
  };

  const getStatusColor = (result: any) => {
    if (!result.success) return 'text-red-600 bg-red-50';
    if (result.roundTripTime > 500) return 'text-yellow-600 bg-yellow-50';
    if (result.precision > 100) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const getQualityIcon = (result: any) => {
    if (!result.success) return '❌';
    if (result.roundTripTime > 500 || result.precision > 100) return '⚠️';
    return '✅';
  };

  const displayHistory = history.slice(-maxItems).reverse();

  if (history.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <div className="text-gray-400 text-4xl mb-2">📊</div>
        <p className="text-gray-600">No hay sincronizaciones registradas</p>
        <p className="text-sm text-gray-500 mt-1">
          Haz clic en "Sincronizar Tiempo" para empezar
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          📈 Historial de Sincronización
          <span className="text-sm font-normal text-gray-600">
            ({history.length} total, últimas {Math.min(maxItems, history.length)})
          </span>
        </h3>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {displayHistory.map((sync, index) => (
          <div 
            key={`${sync.clientTime}-${index}`}
            className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
              index === 0 ? 'bg-blue-50' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-lg">{getQualityIcon(sync)}</span>
                <div>
                  <div className="font-medium text-gray-900">
                    {formatTime(sync.clientTime)}
                  </div>
                  <div className="text-sm text-gray-600">
                    Servidor: {sync.server}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className={`text-sm font-medium px-2 py-1 rounded ${getStatusColor(sync)}`}>
                  {sync.success ? formatOffset(sync.offset) : 'Error'}
                </div>
                {sync.success && (
                  <div className="text-xs text-gray-500 mt-1">
                    RTT: {sync.roundTripTime.toFixed(1)}ms
                  </div>
                )}
              </div>
            </div>

            {showDetails && sync.success && (
              <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Precisión:</span>
                  <span className="ml-2 font-medium">
                    {sync.precision.toFixed(2)}ms
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Tiempo servidor:</span>
                  <span className="ml-2 font-medium">
                    {formatTime(sync.serverTime)}
                  </span>
                </div>
              </div>
            )}

            {!sync.success && sync.error && (
              <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                {sync.error}
              </div>
            )}
          </div>
        ))}
      </div>

      {history.length > maxItems && (
        <div className="bg-gray-50 px-4 py-2 text-center text-sm text-gray-600">
          Mostrando las últimas {maxItems} de {history.length} sincronizaciones
        </div>
      )}
    </div>
  );
};

export default SyncHistory;
