import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as D from '@radix-ui/react-dialog';
import * as T from '@radix-ui/react-tooltip';
import * as M from '@radix-ui/react-dropdown-menu';
import * as P from '@radix-ui/react-popover';
import { create } from 'zustand';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { Field, Select } from './primitives';

/* ---------------- Dialog ---------------- */

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', className }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; className?: string;
}) {
  const w = { sm: 'max-w-[420px]', md: 'max-w-[560px]', lg: 'max-w-[760px]', xl: 'max-w-[1080px]', full: 'max-w-[min(1400px,96vw)]' }[size];
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-modal bg-[rgb(4_12_26/0.38)] animate-fade-in" />
        <D.Content
          className={cn('fixed inset-x-0 mx-auto top-[8vh] z-modal w-[calc(100vw-24px)] rounded-lg bg-raised shadow-lg ring-1 ring-line animate-pop-in flex flex-col max-h-[84vh]', w, className)}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
            <div className="min-w-0">
              <D.Title className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</D.Title>
              {description ? <D.Description className="mt-0.5 text-sm text-ink-3">{description}</D.Description> : <D.Description className="sr-only">Dialog</D.Description>}
            </div>
            <D.Close asChild><Button variant="ghost" size="icon-sm" aria-label="Close"><X className="h-4 w-4" /></Button></D.Close>
          </div>
          {children && <div className="px-5 pb-4 overflow-y-auto scroll-thin">{children}</div>}
          {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3 bg-canvas/70 rounded-b-lg">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/* ---------------- Drawer (side sheet) ---------------- */

export function Drawer({ open, onOpenChange, title, subtitle, children, footer, width = 560, actions }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number; actions?: ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-drawer bg-[rgb(4_12_26/0.22)] animate-fade-in" />
        <D.Content
          className="fixed right-0 top-0 z-drawer flex h-full flex-col bg-raised shadow-lg border-l border-line animate-slide-in-right"
          style={{ width: `min(${width}px, 100vw)` }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
            <div className="min-w-0">
              <D.Title className="text-[15px] font-semibold tracking-[-0.01em] text-ink truncate">{title}</D.Title>
              <D.Description className={subtitle ? 'text-sm text-ink-3 mt-0.5' : 'sr-only'}>{subtitle ?? 'Details'}</D.Description>
            </div>
            <div className="flex items-center gap-1">
              {actions}
              <D.Close asChild><Button variant="ghost" size="icon-sm" aria-label="Close"><X className="h-4 w-4" /></Button></D.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin">{children}</div>
          {footer && <div className="border-t border-line px-5 py-3 bg-canvas/70">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/* ---------------- Tooltip ---------------- */

export function Tip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  if (!content) return <>{children}</>;
  return (
    <T.Root delayDuration={250}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="z-tooltip max-w-xs rounded-md bg-[rgb(0_30_68)] px-2.5 py-1.5 text-xs leading-snug text-white shadow-md ring-1 ring-white/10 animate-fade-in">
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

export const TipProvider = T.Provider;

/* ---------------- Menu ---------------- */

export function Menu({ trigger, children, align = 'end' }: { trigger: ReactNode; children: ReactNode; align?: 'start' | 'end' }) {
  return (
    <M.Root>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content align={align} sideOffset={6} className="z-popover min-w-[208px] rounded-lg bg-raised p-1 shadow-lg ring-1 ring-line animate-pop-in">
          {children}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}

export function MenuItem({ children, onSelect, icon, danger, disabled, hint }: { children: ReactNode; onSelect?: () => void; icon?: ReactNode; danger?: boolean; disabled?: boolean; hint?: ReactNode }) {
  return (
    <M.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn('flex cursor-pointer items-center gap-2 rounded-md px-2 h-8 text-[13px] outline-none data-[highlighted]:bg-subtle data-[disabled]:opacity-40 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-ink-3', danger ? 'text-bad' : 'text-ink')}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-xs text-ink-4">{hint}</span>}
    </M.Item>
  );
}
export const MenuLabel = ({ children }: { children: ReactNode }) => <M.Label className="px-2 pb-1 pt-1.5 eyebrow">{children}</M.Label>;
export const MenuSep = () => <M.Separator className="my-1 h-px bg-line" />;

/* ---------------- Popover ---------------- */

export function Popover({ trigger, children, align = 'end', className, open, onOpenChange }: { trigger: ReactNode; children: ReactNode; align?: 'start' | 'end' | 'center'; className?: string; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  return (
    <P.Root open={open} onOpenChange={onOpenChange}>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content align={align} sideOffset={6} className={cn('z-popover rounded-lg bg-raised shadow-lg ring-1 ring-line animate-pop-in outline-none', className)}>
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

/* ---------------- Imperative confirm / prompt ---------------- */

interface AskOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  input?: { label: string; placeholder?: string; required?: boolean; multiline?: boolean; options?: { value: string; label: string }[]; initial?: string };
}

const useAsk = create<{ opts: AskOptions | null; resolve: ((v: string | null) => void) | null }>(() => ({ opts: null, resolve: null }));

/** Ask the user to confirm. Resolves to the input value ('' when no input) or null if cancelled. */
export function ask(opts: AskOptions): Promise<string | null> {
  return new Promise((resolve) => useAsk.setState({ opts, resolve }));
}
export const confirmAction = async (opts: AskOptions) => (await ask(opts)) !== null;

export function AskHost() {
  const { opts, resolve } = useAsk();
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  useEffect(() => { setValue(opts?.input?.initial ?? ''); setTouched(false); }, [opts]);
  const close = (v: string | null) => { resolve?.(v); useAsk.setState({ opts: null, resolve: null }); };
  const invalid = !!opts?.input?.required && !value.trim();
  const submit = () => { setTouched(true); if (!invalid) close(value); };
  return (
    <Dialog
      open={!!opts}
      onOpenChange={(o) => !o && close(null)}
      title={opts?.title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(null)}>Cancel</Button>
          <Button variant={opts?.tone === 'danger' ? 'danger' : 'primary'} onClick={submit}>{opts?.confirmLabel ?? 'Confirm'}</Button>
        </>
      }
    >
      {opts?.body && <div className="text-sm text-ink-2 leading-relaxed">{opts.body}</div>}
      {opts?.input && (
        <Field label={opts.input.label} required={opts.input.required} error={touched && invalid ? 'This is required.' : undefined} className="mt-3">
          {opts.input.options ? (
            <Select value={value} onChange={setValue} options={opts.input.options} placeholder="Choose…" />
          ) : opts.input.multiline ? (
            <textarea ref={ref} autoFocus rows={3} className="input" placeholder={opts.input.placeholder} value={value} aria-invalid={touched && invalid} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }} />
          ) : (
            <input ref={ref} autoFocus className="input" placeholder={opts.input.placeholder} value={value} aria-invalid={touched && invalid} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          )}
        </Field>
      )}
    </Dialog>
  );
}
