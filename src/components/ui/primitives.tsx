import { type ReactNode, type InputHTMLAttributes, useId } from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t } from '@/lib/motion';

/* ---------------- Badge ---------------- */

export type Tone = 'neutral' | 'accent' | 'good' | 'warn' | 'bad' | 'talent' | 'brand' | 'outline' | 'demo';
const tones: Record<Tone, string> = {
  neutral: 'bg-subtle text-ink-2',
  accent: 'bg-accent-soft text-accent',
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  bad: 'bg-bad-soft text-bad',
  talent: 'bg-talent-soft text-talent',
  brand: 'bg-brand-soft text-brand',
  outline: 'bg-transparent text-ink-2 ring-1 ring-inset ring-line-strong/70',
  demo: 'bg-demo-soft text-demo ring-1 ring-inset ring-demo/25',
};

export function Badge({ tone = 'neutral', children, className, icon, dot }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 h-5 px-1.5 rounded-sm text-[11.5px] font-medium whitespace-nowrap [&>svg]:h-3 [&>svg]:w-3', tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {icon}
      {children}
    </span>
  );
}

/** A status that must be readable without color: a shaped mark plus a label. */
export function StatusDot({ tone, label, className, shape = 'dot' }: { tone: 'good' | 'warn' | 'bad' | 'neutral' | 'accent' | 'demo'; label: ReactNode; className?: string; shape?: 'dot' | 'ring' | 'square' }) {
  const c = { good: 'text-good', warn: 'text-warn', bad: 'text-bad', neutral: 'text-ink-4', accent: 'text-accent', demo: 'text-demo' }[tone];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-ink-2', className)}>
      <span className={cn('h-2 w-2 shrink-0', c, shape === 'ring' ? 'rounded-full ring-[1.5px] ring-current ring-inset' : shape === 'square' ? 'rounded-[2px] bg-current' : 'rounded-full bg-current')} />
      {label}
    </span>
  );
}

/* ---------------- Avatar ---------------- */

// Muted, institution-appropriate hues; rendered as tinted initials so they work on both themes.
const palette = ['30 64 124', '11 105 117', '92 72 150', '146 86 0', '22 112 72', '150 52 96', '58 82 120', '84 98 40'];
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

export function Avatar({ name, size = 28, square, className, title }: { name: string; size?: number; square?: boolean; className?: string; title?: string }) {
  const letters = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const rgb = palette[hash(name) % palette.length];
  return (
    <span
      title={title ?? name}
      aria-hidden={title === '' ? true : undefined}
      className={cn('avatar inline-flex shrink-0 items-center justify-center font-semibold select-none tracking-[-0.02em] [color:rgb(var(--av))]', square ? 'rounded-md' : 'rounded-full', className)}
      style={{ width: size, height: size, fontSize: Math.max(9.5, size * 0.38), ['--av' as string]: rgb, background: `rgb(${rgb} / 0.10)`, boxShadow: `inset 0 0 0 1px rgb(${rgb} / 0.18)` }}
    >
      {letters}
    </span>
  );
}

export function AvatarStack({ names, max = 3, size = 22 }: { names: string[]; max?: number; size?: number }) {
  return (
    <span className="flex -space-x-1.5">
      {names.slice(0, max).map((n) => <Avatar key={n} name={n} size={size} className="ring-2 ring-surface bg-surface" />)}
      {names.length > max && <span className="inline-flex items-center justify-center rounded-full bg-subtle text-2xs text-ink-3 ring-2 ring-surface tabular" style={{ width: size, height: size }}>+{names.length - max}</span>}
    </span>
  );
}

/* ---------------- Kbd, Skeleton ---------------- */

export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="kbd">{children}</kbd>;
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('skeleton', className)} />;

/* ---------------- Empty state ---------------- */

/** Empty states are designed moments: a quiet glyph, a sentence of fact, and the next real action. */
export function EmptyState({ icon, title, children, action, className, compact }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6', compact ? 'py-8' : 'py-14', className)}>
      {icon && (
        <div className="relative mb-3.5 flex h-10 w-10 items-center justify-center rounded-md border border-line bg-canvas text-ink-3 [&>svg]:h-[18px] [&>svg]:w-[18px]">
          {icon}
        </div>
      )}
      <div className="text-[14px] font-semibold text-ink">{title}</div>
      {children && <div className="mt-1 max-w-[46ch] text-sm text-ink-3">{children}</div>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ---------------- Form fields ---------------- */

export function Field({ label, hint, error, children, required, className, htmlFor }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; required?: boolean; className?: string; htmlFor?: string }) {
  const text = <span className="block text-[12.5px] font-medium text-ink-2">{label}{required && <span className="text-bad" aria-hidden> *</span>}{required && <span className="sr-only"> (required)</span>}</span>;
  return (
    <div className={cn('space-y-1.5', className)}>
      {/* With no explicit id, wrap the control so the label is implicitly associated. */}
      {htmlFor ? <><label htmlFor={htmlFor}>{text}</label>{children}</> : <label className="block space-y-1.5">{text}{children}</label>}
      {error ? <p className="text-xs text-bad" role="alert">{error}</p> : hint ? <p className="text-xs text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, description, disabled, className, ariaLabel }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean; className?: string; ariaLabel?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('group flex items-start gap-2.5 cursor-pointer select-none', disabled && 'opacity-50 cursor-not-allowed', className)}>
      <span className="relative mt-[2px] flex h-4 w-4 shrink-0">
        <input id={id} type="checkbox" className="peer sr-only" aria-label={label ? undefined : ariaLabel ?? 'Select'} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className={cn('h-4 w-4 rounded-[3px] border transition-colors duration-fast peer-focus-visible:shadow-ring', checked ? 'bg-accent border-accent' : 'bg-surface border-line-strong group-hover:border-ink-4')} />
        {checked && <Check className="absolute inset-0 m-auto h-3 w-3 text-accent-on animate-fade-in" strokeWidth={3} />}
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm text-ink">{label}</span>}
          {description && <span className="block text-xs text-ink-3">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="group inline-flex items-center gap-2 text-sm text-ink-2 disabled:opacity-50">
      <span className={cn('relative h-[18px] w-8 rounded-full transition-colors duration-base', checked ? 'bg-accent' : 'bg-line-strong')}>
        <span className={cn('absolute top-[2px] h-[14px] w-[14px] rounded-full bg-surface shadow-sm transition-transform duration-base ease-standard', checked ? 'translate-x-[16px]' : 'translate-x-[2px]')} />
      </span>
      {label}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('input', props.className)} />;
}

export function Select<T extends string>({ value, onChange, options, className, placeholder, ...rest }: { value: T | ''; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string; placeholder?: string; id?: string; 'aria-label'?: string; disabled?: boolean }) {
  return (
    <select
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={cn('input pr-8 appearance-none bg-[length:14px] bg-[right_8px_center] bg-no-repeat cursor-pointer', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23727a85' stroke-width='2'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E\")" }}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* ---------------- Segmented control ---------------- */

export function Segmented<T extends string>({ value, onChange, options, size = 'md', className, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: ReactNode; title?: string }[]; size?: 'sm' | 'md'; className?: string; label?: string }) {
  const lid = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-md bg-subtle p-0.5 ring-1 ring-inset ring-line/80', className)}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-[4px] font-medium transition-colors duration-fast [&>svg]:relative',
              size === 'sm' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-[13px]',
              on ? 'text-ink' : 'text-ink-3 hover:text-ink',
            )}
          >
            {on && <motion.span layoutId={`seg-${lid}`} transition={t.layout} className="absolute inset-0 rounded-[4px] bg-surface shadow-sm ring-1 ring-line/80" />}
            <span className="relative inline-flex items-center gap-1.5">{o.icon}{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Tabs (underline) ---------------- */

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number }[]; className?: string }) {
  const lid = useId();
  return (
    <div role="tablist" className={cn('flex gap-5 border-b border-line overflow-x-auto scroll-thin', className)}>
      {tabs.map((tb) => {
        const on = value === tb.value;
        return (
          <button
            key={tb.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tb.value)}
            className={cn('relative -mb-px flex items-center gap-1.5 whitespace-nowrap pb-2 pt-1 text-[13px] font-medium transition-colors duration-fast', on ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
          >
            {tb.label}
            {tb.count !== undefined && <span className={cn('meta !text-[11px]', on ? '!text-accent' : '')}>{tb.count}</span>}
            {on && <motion.span layoutId={`tab-${lid}`} transition={t.layout} className="absolute inset-x-0 -bottom-px h-[2px] bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Section heading ---------------- */

export function SectionTitle({ children, action, className, count }: { children: ReactNode; action?: ReactNode; className?: string; count?: number }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 mb-2.5', className)}>
      <h2 className="text-[13px] font-semibold text-ink flex items-center gap-2">
        {children}
        {count !== undefined && <span className="meta">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

/* ---------------- Meter ---------------- */

export function Meter({ value, max = 100, tone = 'accent', className, height = 6 }: { value: number; max?: number; tone?: 'accent' | 'good' | 'warn' | 'bad' | 'ink' | 'navy'; className?: string; height?: number }) {
  const color = { accent: 'bg-accent', good: 'bg-good', warn: 'bg-warn', bad: 'bg-bad', ink: 'bg-ink-3', navy: 'bg-viz-2' }[tone];
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-subtle', className)} style={{ height }} role="presentation">
      <motion.div className={cn('h-full rounded-full origin-left', color)} initial={{ scaleX: 0 }} animate={{ scaleX: pct / 100 }} transition={t.data} style={{ width: '100%' }} />
    </div>
  );
}

/* ---------------- Key/value list ---------------- */

export function KeyValue({ items, className, cols = 1 }: { items: { k: ReactNode; v: ReactNode }[]; className?: string; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-2.5', cols === 2 && 'sm:grid-cols-2', cols === 3 && 'sm:grid-cols-3', className)}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="eyebrow !text-[10px]">{it.k}</dt>
          <dd className="mt-0.5 text-sm text-ink">{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}
