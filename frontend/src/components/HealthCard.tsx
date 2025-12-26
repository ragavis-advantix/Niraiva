
import { motion } from 'framer-motion';
import { HealthParameter, getStatusClass, getChangeIcon } from '@/utils/healthData';
import { cn } from '@/lib/utils';

interface HealthCardProps {
  parameter: HealthParameter;
  className?: string;
}

export function HealthCard({ parameter, className }: HealthCardProps) {
  const statusClass = getStatusClass(parameter.status);
  const changeIcon = getChangeIcon(parameter.recentChange);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "glass-card p-4 flex flex-col hover-lift",
        className
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="uppercase tracking-wide text-gray-700 dark:text-gray-200 text-sm font-semibold">{parameter.name}</h3>
        <span className={`health-tag ${statusClass}`}>
          {parameter.status}
        </span>
      </div>

      <div className="flex items-end mt-2 space-x-2">
        <span className="text-3xl font-medium text-slate-800 dark:text-white">
          {parameter.value}
        </span>
        {parameter.unit && (
          <span className="text-sm text-light-subtext dark:text-dark-subtext mb-1">
            {parameter.unit}
          </span>
        )}
      </div>

      {parameter.recentChange && (
        <div className="mt-2 text-sm flex items-center">
          <span className={cn(
            "flex items-center",
            parameter.recentChange === 'improved' ? 'text-health-good' :
              parameter.recentChange === 'declined' ? 'text-health-poor' :
                'text-light-subtext dark:text-dark-subtext'
          )}>
            {changeIcon} {parameter.recentChange}
          </span>
        </div>
      )}

      <div className="mt-auto pt-2 text-xs text-light-subtext dark:text-dark-subtext">
        Last updated: {new Date(parameter.timestamp).toLocaleDateString()}
      </div>
    </motion.div>
  );
}
