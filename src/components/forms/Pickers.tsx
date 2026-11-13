import { useMemo, useState, type ReactNode } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { CONCEPTS, conceptLabel, type Domain } from '@shared/taxonomy';
import { useDb } from '@/lib/store';
import { cn } from '@/lib/cn';
import { Popover } from '../ui/overlays';
import { Avatar } from '../ui/primitives';

function PickerList<T extends { id: string }>({ items, selected, onToggle, render, search, placeholder, groupBy }: {
  items: T[]; selected: string[]; onToggle: (id: string) => void; render: (x: T) => ReactNode; search: (x: T) => string; placeholder: string; groupBy?: (x: T) => string;
}) {
  const [q, setQ] = useState('');
  const filtered = items.filter((x) => search(x).toLowerCase().includes(q.toLowerCase()));
  const groups = groupBy ? [...new Set(filtered.map(groupBy))] : [''];
  return (
    <div className="w-[320px]">
      <div className="border-b border-line p-2"><input autoFocus className="input h-8" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="max-h-[300px] overflow-y-auto scroll-thin p-1">
        {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-3">Nothing found</p>}
        {groups.map((g) => (
          <div key={g}>
            {g && <div className="px-2 pb-1 pt-2 eyebrow">{g}</div>}
            {filtered.filter((x) => !groupBy || groupBy(x) === g).map((x) => {
              const on = selected.includes(x.id);
              return (
                <button key={x.id} type="button" onClick={() => onToggle(x.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-subtle">
                  <span className={cn('flex h-4 w-4 items-center justify-center rounded border', on ? 'border-accent bg-accent text-white' : 'border-line-strong')}>{on && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                  {render(x)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FacultyPicker({ value, onChange, trigger }: { value: string[]; onChange: (ids: string[]) => void; trigger?: ReactNode }) {
  const db = useDb();
  const items = useMemo(() => Object.values(db.faculty).sort((a, b) => a.name.localeCompare(b.name)), [db.faculty]);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((id) => (
        <span key={id} className="inline-flex h-7 items-center gap-1.5 rounded-md bg-subtle pl-1 pr-1.5 text-sm">
          <Avatar name={db.faculty[id]?.name ?? '?'} size={20} />{db.faculty[id]?.name}
          <button type="button" aria-label="Remove" onClick={() => onChange(value.filter((x) => x !== id))} className="text-ink-4 hover:text-ink"><X className="h-3.5 w-3.5" /></button>
        </span>
      ))}
      <Popover align="start" trigger={trigger ?? <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-line-strong px-2 text-sm text-ink-3 hover:border-accent hover:text-accent"><Plus className="h-3.5 w-3.5" />Add researcher</button>}>
        <PickerList
          items={items}
          selected={value}
          placeholder="Search researchers…"
          search={(f) => `${f.name} ${db.departments[f.departmentId]?.name}`}
          onToggle={(id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])}
          render={(f) => <><Avatar name={f.name} size={20} /><span className="flex-1 truncate">{f.name}</span><span className="truncate text-xs text-ink-4 max-w-[45%]">{db.departments[f.departmentId]?.name}</span></>}
        />
      </Popover>
    </div>
  );
}

export function TopicPicker({ value, onChange, label = 'Add topic', size = 'md' }: { value: string[]; onChange: (ids: string[]) => void; label?: string; size?: 'sm' | 'md' }) {
  const items = useMemo(() => [...CONCEPTS].sort((a, b) => a.domain.localeCompare(b.domain) || a.label.localeCompare(b.label)), []);
  return (
    <Popover align="start" trigger={
      <button type="button" className={cn('inline-flex items-center gap-1 rounded-md border border-dashed border-line-strong text-ink-3 hover:border-accent hover:text-accent', size === 'sm' ? 'h-6 px-1.5 text-xs' : 'h-7 px-2 text-sm')}>
        <Plus className="h-3.5 w-3.5" />{label}
      </button>
    }>
      <PickerList
        items={items}
        selected={value}
        placeholder="Search research topics…"
        search={(c) => `${c.label} ${c.phrases.join(' ')} ${c.domain}`}
        groupBy={(c) => c.domain as Domain}
        onToggle={(id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])}
        render={(c) => <span className="flex-1">{c.label}</span>}
      />
    </Popover>
  );
}

export function TopicChips({ ids, onRemove, max, tone = 'neutral' }: { ids: string[]; onRemove?: (id: string) => void; max?: number; tone?: 'neutral' | 'accent' }) {
  const shown = max ? ids.slice(0, max) : ids;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {shown.map((id) => (
        <span key={id} className={cn('inline-flex h-[22px] items-center gap-1 rounded-[5px] px-1.5 text-xs', tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-subtle text-ink-2')}>
          {conceptLabel(id)}
          {onRemove && <button type="button" aria-label={`Remove ${conceptLabel(id)}`} onClick={() => onRemove(id)} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>}
        </span>
      ))}
      {max && ids.length > max && <span className="inline-flex h-[22px] items-center px-1 text-xs text-ink-4">+{ids.length - max}</span>}
    </span>
  );
}
