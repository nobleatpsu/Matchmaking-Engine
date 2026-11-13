import { BRAND } from '@shared/brand';
import { cn } from '@/lib/cn';

/**
 * Neutral typographic mark (a keystone: Pennsylvania's state symbol). This is NOT the
 * Penn State shield and must not be redrawn as one. Swap for an approved mark when available.
 */
export function BrandMark({ size = 28, className, onDark }: { size?: number; className?: string; onDark?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="6" fill={onDark ? '#FFFFFF' : '#001E44'} fillOpacity={onDark ? 0.08 : 1} stroke={onDark ? '#FFFFFF' : 'none'} strokeOpacity={0.14} />
      <path d="M9.5 8h13l-2.8 16h-7.4z" fill="#FFFFFF" />
      <path d="M13.2 8h5.6l-1.05 6h-3.5z" fill="#96BEE6" />
    </svg>
  );
}

export function Wordmark({ collapsed, onDark }: { collapsed?: boolean; onDark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={26} onDark={onDark} />
      <div className={cn('leading-none', collapsed && 'sr-only')}>
        <div className={cn('text-[10px] font-semibold uppercase tracking-[0.14em]', onDark ? 'text-pugh' : 'text-ink-3')}>{BRAND.institution}</div>
        <div className={cn('mt-[3px] whitespace-nowrap text-[14px] font-semibold tracking-[-0.01em]', onDark ? 'text-white' : 'text-navy')}>{BRAND.product}</div>
      </div>
    </div>
  );
}
