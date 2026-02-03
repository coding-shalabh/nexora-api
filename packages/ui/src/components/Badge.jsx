import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../utils/cn.js';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-100 text-primary-800',
        secondary: 'border-transparent bg-gray-100 text-gray-800',
        destructive: 'border-transparent bg-red-100 text-red-800',
        success: 'border-transparent bg-green-100 text-green-800',
        warning: 'border-transparent bg-yellow-100 text-yellow-800',
        info: 'border-transparent bg-blue-100 text-blue-800',
        outline: 'border-gray-300 text-gray-800',
        whatsapp: 'border-transparent bg-whatsapp/10 text-whatsapp-dark',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0.5 text-[10px]',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Badge({ className, variant, size, dot, dotColor, children, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className="mr-1.5 h-2 w-2 rounded-full"
          style={{ backgroundColor: dotColor || 'currentColor' }}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
