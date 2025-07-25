import type { MetricsCardProps } from '../types';

const MetricsCard = ({ 
  title, 
  value, 
  subtitle, 
  trend, 
  icon, 
  color = 'blue' 
}: MetricsCardProps) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-800',
  };

  const trendIcons = {
    up: '↗️',
    down: '↘️',
    neutral: '➡️',
  };

  return (
    <div className={`rounded-lg border-2 p-4 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium opacity-75">{title}</h3>
          <div className="mt-1 flex items-baseline">
            <span className="text-lg font-semibold">{value}</span>
            {trend && (
              <span className="ml-2 text-sm">
                {trendIcons[trend]}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs opacity-60">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="ml-3 text-lg opacity-75">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsCard;
