import type { IngestBatch, IngestReport } from '@shared/ingest';
import type { EvalResult } from '@shared/matching/eval';
import type { MatchResponse } from '@shared/matching/types';
import type { Database, MatchRequest, Op } from '@shared/types';

export type Workspace = 'live' | 'demo';

export interface Meta {
  workspace: Workspace;
  workspaces: Workspace[];
  authMode: 'dev' | 'header';
  version: string;
  me: string | null;
  seededAt: string;
  schemaVersion: number;
  file: string;
  defaultProvider: string;
  providers: { id: string; name: string; version: string; description: string; default: boolean }[];
  dataProviders: { id: string; name: string; description: string; sourceId: string; entities: string[] }[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body: Record<string, unknown> = {}) { super(message); }
}

/** Identity hints sent with every request (only honoured where the server allows them). */
let identity: { workspace: Workspace; persona?: string; devUser?: string } = { workspace: 'live' };
export const setIdentity = (x: typeof identity) => { identity = x; };

async function call<T>(path: string, init?: RequestInit, raw = false): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (identity.persona) headers['x-demo-persona'] = identity.persona;
  if (identity.devUser) headers['x-dev-user'] = identity.devUser;
  const res = await fetch(raw ? path : `/api/w/${identity.workspace}/${path}`, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`, data as Record<string, unknown>);
  return data as T;
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  config: () => call<{ workspaces: Workspace[]; authMode: 'dev' | 'header'; version: string }>('/api/config', undefined, true),
  state: () => call<{ db: Database; meta: Meta }>('state'),
  tx: (ops: Op[]) => post<{ ok: true }>('tx', { ops }),
  match: (request: MatchRequest, providerId?: string) => post<MatchResponse>('match', { request, providerId }),
  ingest: (batch: IngestBatch) => post<IngestReport>('ingest', batch),
  reset: () => post<{ ok: true }>('reset', {}),
  bootstrap: (name: string, email: string) => post<{ ok: true }>('bootstrap', { name, email }),
  audit: (before?: number) => call<{ entries: { id: number; at: string; actor: string; kind: string; summary: string }[] }>(`audit${before ? `?before=${before}` : ''}`),
  apiKeys: () => call<{ keys: { id: string; name: string; prefix: string; role: string; created_by: string; created_at: string; last_used_at: string | null; revoked_at: string | null }[] }>('apikeys'),
  createApiKey: (name: string, role: 'staff' | 'viewer') => post<{ id: string; key: string }>('apikeys', { name, role }),
  revokeApiKey: (id: string) => call<{ ok: true }>(`apikeys/${id}`, { method: 'DELETE' }),
  sync: (provider: string, options: Record<string, string> = {}) => post<{ reports: IngestReport[]; log: string[] }>('sync', { provider, options }),
  eval: (providerId?: string) => post<EvalResult>('eval', { providerId }),
  exportUrl: (what: 'corpus' | 'labels' | 'db') => `/api/w/${identity.workspace}/export/${what}`,
};
