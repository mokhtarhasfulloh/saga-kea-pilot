import * as React from 'react'

function cn(...cls: Array<string | undefined | false>) { return cls.filter(Boolean).join(' ') }

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm text-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:cursor-not-allowed disabled:opacity-50',
      '[&>option]:bg-background [&>option]:text-foreground',
      className
    )}
    {...props}
  />
))
Select.displayName = 'Select'

export default Select
