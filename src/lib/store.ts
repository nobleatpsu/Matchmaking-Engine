import { create } from 'zustand';
import { toast } from 'sonner';
import { applyLocalOps } from '@shared/apply';
import type { Database, Op } from '@shared/types';
import { api, ApiError, setIdentity, type Meta, type Workspace } from './api';

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export type Status = 'loading' | 'ready' | 'error' | 'bootstrap' | 'not-signed-in' | 'not-provisioned';

interface State {
  db: Database | null;
  meta: Meta | null;
  status: Status;
  error?: string;
  authEmail?: string;
  workspace: Workspace;
  /** Current user id (demo persona, dev-mode pick, or the SSO user). */
  userId: string;
  presentation: boolean;
  sidebarCollapsed: boolean;
  load: () => Promise<void>;
  /** Optimistically apply ops, persist them, roll back on failure. */
  commit: (ops: Op[], opts?: { success?: string; silent?: boolean }) => Promise<boolean>;
  setUser: (id: string) => void;
  setWorkspace: (ws: Workspace) => void;
  setPresentation: (on: boolean) => void;
  toggleSidebar: () => void;
  reset: () => Promise<void>;
}

const personaKey = (ws: Workspace) => `psrp.user.${ws}`;

function syncIdentity(ws: Workspace) {
  setIdentity({ workspace: ws, persona: ws === 'demo' ? read(personaKey('demo')) ?? undefined : undefined, devUser: ws === 'live' ? read(personaKey('live')) ?? undefined : undefined });
}

export const useStore = create<State>((set, get) => ({
  db: null,
  meta: null,
  status: 'loading',
  workspace: (read('psrp.workspace') as Workspace) ?? 'live',
  userId: '',
  presentation: read('psrp.presentation') === '1',
  sidebarCollapsed: read('psrp.sidebar') === '1',

  async load() {
    try {
      const cfg = await api.config();
      let ws = get().workspace;
      if (!cfg.workspaces.includes(ws)) { ws = cfg.workspaces[0]; set({ workspace: ws }); }
      syncIdentity(ws);
      const { db, meta } = await api.state();
      set({ db, meta, status: 'ready', error: undefined, userId: meta.me ?? '' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const reason = String(e.body.error ?? 'not-signed-in');
        set({ status: reason === 'bootstrap' ? 'bootstrap' : reason === 'not-provisioned' ? 'not-provisioned' : 'not-signed-in', authEmail: e.body.email as string | undefined, meta: (e.body.meta as Meta) ?? get().meta });
        return;
      }
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  },

  async commit(ops, opts) {
    const before = get().db;
    if (!before) return false;
    set({ db: applyLocalOps(before, ops) });
    try {
      await api.tx(ops);
      if (opts?.success && !opts.silent) toast.success(opts.success);
      return true;
    } catch (e) {
      set({ db: before });
      toast.error(e instanceof Error ? e.message : 'Could not save change');
      return false;
    }
  },

  setUser(id) {
    const ws = get().workspace;
    if (ws === 'live' && get().meta?.authMode !== 'dev') return; // SSO decides who you are
    write(personaKey(ws), id);
    syncIdentity(ws);
    set({ userId: id });
    get().load();
  },

  setWorkspace(ws) {
    write('psrp.workspace', ws);
    set({ workspace: ws, db: null, status: 'loading' });
    syncIdentity(ws);
    get().load();
  },

  setPresentation(on) { write('psrp.presentation', on ? '1' : '0'); set({ presentation: on }); },
  toggleSidebar() { const v = !get().sidebarCollapsed; write('psrp.sidebar', v ? '1' : '0'); set({ sidebarCollapsed: v }); },

  async reset() {
    await api.reset();
    await get().load();
    toast.success('Demo data restored');
  },
}));

/** Non-null database accessor for components rendered after load. */
export function useDb(): Database {
  return useStore((s) => s.db!) as Database;
}

const GUEST = { id: '', name: 'Unknown user', email: '', initials: '?', title: '', team: '', role: 'viewer' as const, active: true };
export function useMe() {
  return useStore((s) => s.db!.users[s.userId] ?? GUEST);
}

export const useIsDemo = () => useStore((s) => s.workspace === 'demo');
