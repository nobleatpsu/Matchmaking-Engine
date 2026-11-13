import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Compact page header: title and one line of purpose on the left, primary actions on the right,
 * closed by a hairline. Data screens should spend their height on data, not on introductions.
 */
export function PageHeader({ title, description, actions, crumbs, className, meta, eyebrow, ruled = true }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; crumbs?: { label: string; to?: string }[]; className?: string; meta?: ReactNode; eyebrow?: ReactNode; ruled?: boolean;
}) {
  return (
    <header className={cn('mb-5', ruled && 'border-b border-line pb-4', className)}>
      {crumbs && (
        <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1 text-xs text-ink-3">
          {crumbs.map((c, i) => (
            <span key={i} className="flex min-w-0 items-center gap-1">
              {c.to ? <Link to={c.to} className="hover:text-ink hover:underline underline-offset-2">{c.label}</Link> : <span className="truncate">{c.label}</span>}
              {i < crumbs.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-ink-4" />}
            </span>
          ))}
        </nav>
      )}
      {eyebrow && !crumbs && <div className="eyebrow mb-1">{eyebrow}</div>}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.02em] text-ink">{title}</h1>
          {description && <p className="mt-1 max-w-[80ch] text-[13.5px] leading-5 text-ink-3">{description}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-1.5">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 py-5 sm:px-6 lg:px-8', wide ? 'max-w-[1760px]' : 'max-w-[1400px]', className)}>{children}</div>;
}
