import * as React from 'react'
import { Button } from './button'

function cn(...cls: Array<string | undefined | false>) { return cls.filter(Boolean).join(' ') }

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className
}) => {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-border rounded-2xl bg-muted/20',
      className
    )}>
      {icon && (
        <div className="mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          {description}
        </p>
      )}
      
      {action && (
        <Button
          onClick={action.onClick}
          variant="outline"
          className="mt-2"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}

export default EmptyState
