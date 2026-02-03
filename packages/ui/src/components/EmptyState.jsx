import * as React from 'react';
import { cn } from '../utils/cn.js';

const EmptyState = React.forwardRef(
  ({ className, icon, title, description, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center py-12 px-4 text-center',
          className
        )}
        {...props}
      >
        {icon && (
          <div className="mb-4 text-gray-400">
            {icon}
          </div>
        )}
        <h3 className="mb-1 text-lg font-medium text-gray-900">{title}</h3>
        {description && (
          <p className="mb-4 max-w-sm text-sm text-gray-500">{description}</p>
        )}
        {action && <div className="mt-2">{action}</div>}
      </div>
    );
  }
);
EmptyState.displayName = 'EmptyState';

export { EmptyState };
