import type { SyncButtonProps } from '../types';

const SyncButton = ({ 
  onSync, 
  isLoading, 
  disabled = false, 
  size = 'md', 
  variant = 'primary' 
}: SyncButtonProps) => {
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
    secondary: 'bg-gray-600 hover:bg-gray-700 text-white border-gray-600',
    outline: 'bg-transparent hover:bg-blue-50 text-blue-600 border-blue-600',
  };

  const disabledClasses = 'opacity-50 cursor-not-allowed hover:bg-current';

  return (
    <button
      onClick={onSync}
      disabled={disabled || isLoading}
      className={`
        font-medium rounded-lg border-2 transition-colors duration-200
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${(disabled || isLoading) ? disabledClasses : ''}
        flex items-center justify-center gap-2
      `}
    >
      {isLoading ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
          Sincronizando...
        </>
      ) : (
        <>
          <span>🔄</span>
          Sincronizar Tiempo
        </>
      )}
    </button>
  );
};

export default SyncButton;
