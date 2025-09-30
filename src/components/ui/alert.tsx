import * as React from 'react'
import { AlertCircle, Info, AlertTriangle, CheckCircle } from 'lucide-react'

function cn(...cls: Array<string | undefined | false>) { return cls.filter(Boolean).join(' ') }

type AlertVariant = 'default' | 'destructive' | 'warning' | 'success' | 'error' | 'warn'

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant
}

const alertVariants: Record<AlertVariant, string> = {
  default: 'bg-background text-foreground border-border',
  destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
  warning: 'border-yellow-500/50 text-yellow-600 dark:border-yellow-500 dark:text-yellow-400 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400',
  success: 'border-green-500/50 text-green-600 dark:border-green-500 dark:text-green-400 [&>svg]:text-green-600 dark:[&>svg]:text-green-400',
  error: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
  warn: 'border-yellow-500/50 text-yellow-600 dark:border-yellow-500 dark:text-yellow-400 [&>svg]:text-yellow-600 dark:[&>svg]:text-yellow-400',
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        'relative w-full rounded-2xl border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
        alertVariants[variant],
        className
      )}
      {...props}
    />
  )
)
Alert.displayName = 'Alert'

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn('mb-1 font-medium leading-none tracking-tight', className)}
      {...props}
    />
  )
)
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('text-sm [&_p]:leading-relaxed', className)}
      {...props}
    />
  )
)
AlertDescription.displayName = 'AlertDescription'

// Pre-configured alert components for common use cases
export const ErrorAlert = ({ title = 'Error', children, className, ...props }: { title?: string; children: React.ReactNode } & Omit<AlertProps, 'variant'>) => (
  <Alert variant="destructive" className={className} {...props}>
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>
      <div className="font-mono text-sm">{children}</div>
    </AlertDescription>
  </Alert>
)

export const WarningAlert = ({ title = 'Warning', children, className, ...props }: { title?: string; children: React.ReactNode } & Omit<AlertProps, 'variant'>) => (
  <Alert variant="warning" className={className} {...props}>
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>{children}</AlertDescription>
  </Alert>
)

export const InfoAlert = ({ title = 'Info', children, className, ...props }: { title?: string; children: React.ReactNode } & Omit<AlertProps, 'variant'>) => (
  <Alert variant="default" className={className} {...props}>
    <Info className="h-4 w-4" />
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>{children}</AlertDescription>
  </Alert>
)

export const SuccessAlert = ({ title = 'Success', children, className, ...props }: { title?: string; children: React.ReactNode } & Omit<AlertProps, 'variant'>) => (
  <Alert variant="success" className={className} {...props}>
    <CheckCircle className="h-4 w-4" />
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>{children}</AlertDescription>
  </Alert>
)

export { Alert, AlertTitle, AlertDescription }

