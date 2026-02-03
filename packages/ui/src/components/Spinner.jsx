import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../utils/cn.js';

const spinnerVariants = cva(
  'animate-spin rounded-full border-solid border-current border-r-transparent',
  {
    variants: {
      size: {
        xs: 'h-3 w-3 border',
        sm: 'h-4 w-4 border-2',
        default: 'h-6 w-6 border-2',
        lg: 'h-8 w-8 border-2',
        xl: 'h-12 w-12 border-4',
      },
      variant: {
        default: 'text-primary-600',
        secondary: 'text-gray-600',
        white: 'text-white',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
  }
);

const Spinner = React.forwardRef(
  ({ className, size, variant, label, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-label={label || 'Loading'}
        className={cn('inline-flex items-center gap-2', className)}
        {...props}
      >
        <div className={cn(spinnerVariants({ size, variant }))} />
        {label && <span className="text-sm text-gray-500">{label}</span>}
        <span className="sr-only">{label || 'Loading...'}</span>
      </div>
    );
  }
);
Spinner.displayName = 'Spinner';

export { Spinner, spinnerVariants };
