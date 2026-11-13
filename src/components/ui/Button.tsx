import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle' | 'link';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-on shadow-xs hover:bg-accent-hover border border-transparent',
  secondary: 'bg-surface text-ink border border-line shadow-xs hover:bg-subtle hover:border-line-strong',
  ghost: 'text-ink-2 hover:bg-subtle hover:text-ink',
  subtle: 'bg-subtle text-ink-2 hover:bg-sunken hover:text-ink',
  danger: 'bg-surface text-bad border border-line shadow-xs hover:bg-bad-soft hover:border-bad/40',
  link: 'text-accent hover:text-accent-hover hover:underline underline-offset-2 px-0 h-auto',
};

const sizes: Record<Size, string> = {
  xs: 'h-6 px-2 text-xs gap-1 rounded',
  sm: 'h-7 px-2.5 text-sm gap-1.5 rounded-md',
  md: 'h-8 px-3 text-sm gap-1.5 rounded-md',
  lg: 'h-9 px-4 text-sm gap-2 rounded-md',
  icon: 'h-8 w-8 justify-center rounded-md',
  'icon-sm': 'h-7 w-7 justify-center rounded-md',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, iconRight, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-standard active:translate-y-px',
        'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:shadow-ring',
        variants[variant],
        variant !== 'link' && sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
      {iconRight}
    </button>
  );
});
