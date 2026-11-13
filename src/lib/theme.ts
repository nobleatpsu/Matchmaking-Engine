import { create } from 'zustand';

export type ThemePref = 'light' | 'dark' | 'system';

const KEY = 'psrp.theme';
const read = (): ThemePref => { try { return (localStorage.getItem(KEY) as ThemePref) || 'light'; } catch { return 'light'; } };
const media = () => window.matchMedia('(prefers-color-scheme: dark)');
const resolve = (p: ThemePref) => (p === 'system' ? (media().matches ? 'dark' : 'light') : p);

function apply(p: ThemePref) {
  document.documentElement.dataset.theme = resolve(p);
}

/** Light is the reference theme; dark is opt-in (or follows the OS when set to system). Mirrors the pre-paint script in index.html. */
export const useTheme = create<{ pref: ThemePref; resolved: 'light' | 'dark'; setPref: (p: ThemePref) => void }>((set) => {
  const pref = read();
  if (typeof window !== 'undefined') {
    apply(pref);
    media().addEventListener('change', () => {
      const cur = useTheme.getState().pref;
      if (cur === 'system') { apply(cur); set({ resolved: resolve(cur) }); }
    });
  }
  return {
    pref,
    resolved: resolve(pref),
    setPref(p) {
      try { localStorage.setItem(KEY, p); } catch { /* private mode */ }
      apply(p);
      set({ pref: p, resolved: resolve(p) });
    },
  };
});

/** Resolve a color token to an rgb() string for libraries that need literal colors (charts). Re-read on theme change. */
export function token(name: string, alpha?: number) {
  const v = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return alpha === undefined ? `rgb(${v})` : `rgb(${v} / ${alpha})`;
}
