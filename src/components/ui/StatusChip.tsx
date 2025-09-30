import * as React from 'react'

function cn(...cls: Array<string | undefined | false>) { return cls.filter(Boolean).join(' ') }

type StatusVariant = 'healthy' | 'unknown' | 'error' | 'warning' | 'offline'

export interface StatusChipProps {
  status: StatusVariant
  label?: string
  showDot?: boolean
  className?: string
}

const statusConfig: Record<StatusVariant, { 
  label: string
  dotColor: string
  bgColor: string
  textColor: string
}> = {
  healthy: {
    label: 'Healthy',
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
    textColor: 'text-green-700 dark:text-green-400'
  },
  unknown: {
    label: 'Unknown',
    dotColor: 'bg-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-950/20',
    textColor: 'text-gray-700 dark:text-gray-400'
  },
  error: {
    label: 'Error',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    textColor: 'text-red-700 dark:text-red-400'
  },
  warning: {
    label: 'Warning',
    dotColor: 'bg-yellow-500',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
    textColor: 'text-yellow-700 dark:text-yellow-400'
  },
  offline: {
    label: 'Offline',
    dotColor: 'bg-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-950/20',
    textColor: 'text-gray-600 dark:text-gray-500'
  }
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  label,
  showDot = true,
  className
}) => {
  const config = statusConfig[status]
  const displayLabel = label || config.label

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
      config.bgColor,
      config.textColor,
      'border-current/20',
      className
    )}>
      {showDot && (
        <div className={cn(
          'w-2 h-2 rounded-full',
          config.dotColor
        )} />
      )}
      <span>{displayLabel}</span>
    </div>
  )
}

export default StatusChip
