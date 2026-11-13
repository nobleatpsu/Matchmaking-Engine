import { differenceInCalendarDays, format, formatDistanceToNowStrict } from 'date-fns';

export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const nowIso = () => new Date().toISOString();

export function relTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  const days = differenceInCalendarDays(new Date(), d);
  if (days === 0) {
    const s = formatDistanceToNowStrict(d);
    return s.startsWith('0') || s.includes('second') ? 'just now' : `${s} ago`;
  }
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 365) return format(d, 'MMM d');
  return format(d, 'MMM yyyy');
}

export function dueLabel(iso?: string) {
  if (!iso) return { text: 'No date', tone: 'muted' as const, days: Infinity };
  const days = differenceInCalendarDays(new Date(iso), new Date());
  if (days < 0) return { text: `${-days}d overdue`, tone: 'bad' as const, days };
  if (days === 0) return { text: 'Today', tone: 'warn' as const, days };
  if (days === 1) return { text: 'Tomorrow', tone: 'warn' as const, days };
  if (days < 7) return { text: format(new Date(iso), 'EEE'), tone: 'muted' as const, days };
  return { text: format(new Date(iso), 'MMM d'), tone: 'muted' as const, days };
}

export const fmtDate = (iso?: string, f = 'MMM d, yyyy') => (iso ? format(new Date(iso), f) : '—');
export const daysSince = (iso?: string) => (iso ? differenceInCalendarDays(new Date(), new Date(iso)) : Infinity);

export const money = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`;

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const initials = (name: string) =>
  name.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join('');

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
