import { useEffect, useState } from 'react';
import { Copy, Download, KeyRound, Play, Plus, RefreshCw, ShieldAlert, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ROLES, isAdmin, type Role } from '@shared/roles';
import type { EvalResult } from '@shared/matching/eval';
import type { Department, User } from '@shared/types';
import { api } from '@/lib/api';
import { useDb, useMe, useStore } from '@/lib/store';
import { fmtDate, relTime, uid } from '@/lib/format';
import { Page, PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Avatar, Badge, EmptyState, Field, Select, Switch, Tabs } from '@/components/ui/primitives';
import { Dialog, ask, confirmAction } from '@/components/ui/overlays';
import { InfoNote } from '@/components/domain';

type Tab = 'users' | 'keys' | 'sync' | 'matchers' | 'departments' | 'audit' | 'system';

export function AdminPage() {
  const me = useMe();
  const [tab, setTab] = useState<Tab>('users');
  if (!isAdmin(me)) return <Page><EmptyState icon={<ShieldAlert />} title="Administrators only">Ask an administrator for access.</EmptyState></Page>;
  return (
    <Page>
      <PageHeader title="Admin" description="People, credentials, data connections and the matching engine for this workspace." />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[
        { value: 'users', label: 'Users' }, { value: 'keys', label: 'API keys' }, { value: 'sync', label: 'Data sync' },
        { value: 'matchers', label: 'Matchers & evaluation' }, { value: 'departments', label: 'Departments' }, { value: 'audit', label: 'Audit log' }, { value: 'system', label: 'System' },
      ]} />
      {tab === 'users' && <Users />}
      {tab === 'keys' && <Keys />}
      {tab === 'sync' && <Sync />}
      {tab === 'matchers' && <Matchers />}
      {tab === 'departments' && <Departments />}
      {tab === 'audit' && <Audit />}
      {tab === 'system' && <System />}
    </Page>
  );
}

function Users() {
  const db = useDb();
  const me = useMe();
  const commit = useStore((s) => s.commit);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', title: '', team: '', role: 'staff' as Role });
  const [err, setErr] = useState('');
  const users = Object.values(db.users).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  const save = (u: User, msg: string) => commit([{ op: 'put', collection: 'users', record: u as never }], { success: msg });
  const add = async () => {
    if (f.name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(f.email)) { setErr('Name and a valid email are required.'); return; }
    if (users.some((u) => u.email.toLowerCase() === f.email.toLowerCase())) { setErr('A user with this email already exists.'); return; }
    const u: User = { id: uid('u'), name: f.name.trim(), email: f.email.trim().toLowerCase(), initials: f.name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(), title: f.title, team: f.team, role: f.role, active: true, createdAt: new Date().toISOString() };
    if (await save(u, `Added ${u.name}`)) { setOpen(false); setF({ name: '', email: '', title: '', team: '', role: 'staff' }); setErr(''); }
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-3">With SSO (AUTH_MODE=header) people sign in with their university account; their email must match a user here, or AUTO_PROVISION_ROLE must be set.</p>
        <Button variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setOpen(true)}>Add user</Button>
      </div>
      <div className="panel overflow-x-auto scroll-thin">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line bg-canvas/60 text-left text-xs text-ink-3"><tr><th className="px-4 py-2.5 font-medium">Person</th><th className="px-3 py-2.5 font-medium">Team / title</th><th className="px-3 py-2.5 font-medium">Role</th><th className="px-3 py-2.5 font-medium">Active</th><th className="px-3 py-2.5 font-medium">Last seen</th></tr></thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'opacity-60'}>
                <td className="px-4 py-3"><div className="flex items-center gap-2.5"><Avatar name={u.name} size={28} /><div><div className="font-medium text-ink">{u.name}{u.id === me.id && <span className="ml-1.5 text-xs text-ink-4">(you)</span>}</div><div className="text-xs text-ink-3">{u.email}</div></div></div></td>
                <td className="px-3 py-3 text-ink-2">{[u.team, u.title].filter(Boolean).join(' · ') || '—'}</td>
                <td className="px-3 py-3 w-[170px]"><Select className="h-8" value={u.role} onChange={(r) => u.id === me.id && r !== 'admin' ? toast.error('You can’t remove your own admin role.') : save({ ...u, role: r }, `${u.name} is now ${r}`)} options={ROLES.map((r) => ({ value: r.id, label: r.label }))} aria-label="Role" /></td>
                <td className="px-3 py-3"><Switch checked={u.active} disabled={u.id === me.id} onChange={(v) => save({ ...u, active: v }, v ? 'Reactivated' : 'Deactivated')} /></td>
                <td className="px-3 py-3 text-ink-3">{relTime(u.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">{ROLES.map((r) => <div key={r.id} className="rounded-md bg-canvas p-3 ring-1 ring-line/70"><div className="text-sm font-semibold text-ink">{r.label}</div><p className="mt-0.5 text-xs text-ink-3">{r.description}</p></div>)}</div>
      <Dialog open={open} onOpenChange={setOpen} title="Add a user" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={add}>Add user</Button></>}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" required className="col-span-2"><input className="input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="University email" required error={err || undefined} className="col-span-2"><input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="abc123@psu.edu" /></Field>
          <Field label="Team"><input className="input" value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })} placeholder="CEC, OTT…" /></Field>
          <Field label="Title"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Role" className="col-span-2" hint={ROLES.find((r) => r.id === f.role)?.description}><Select value={f.role} onChange={(r) => setF({ ...f, role: r })} options={ROLES.map((r) => ({ value: r.id, label: r.label }))} /></Field>
        </div>
      </Dialog>
    </div>
  );
}

function Keys() {
  const [keys, setKeys] = useState<Awaited<ReturnType<typeof api.apiKeys>>['keys']>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const load = () => api.apiKeys().then((r) => setKeys(r.keys)).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);
  const create = async () => {
    const name = await ask({ title: 'Create an API key', body: 'Keys let scripts and scrapers push data through the ingestion API with staff permissions.', confirmLabel: 'Create key', input: { label: 'What is it for?', required: true, placeholder: 'e.g. Faculty directory scraper (Athrav)' } });
    if (!name) return;
    const r = await api.createApiKey(name, 'staff');
    setFresh(r.key);
    load();
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><p className="text-sm text-ink-3">Send as <code className="rounded bg-subtle px-1">Authorization: Bearer &lt;key&gt;</code> to <code className="rounded bg-subtle px-1">POST /api/w/{useStore.getState().workspace}/ingest</code>. See docs/data-ingestion.md.</p><Button variant="primary" icon={<KeyRound className="h-4 w-4" />} onClick={create}>Create key</Button></div>
      {fresh && (
        <InfoNote tone="good" icon={<KeyRound />}>
          <div className="font-semibold">Copy this key now — it won’t be shown again.</div>
          <div className="mt-2 flex items-center gap-2"><code className="flex-1 truncate rounded bg-white px-2 py-1 font-mono text-xs ring-1 ring-good/20">{fresh}</code><Button size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => { navigator.clipboard.writeText(fresh).then(() => toast.success('Copied')); }}>Copy</Button><Button size="sm" variant="ghost" onClick={() => setFresh(null)}>Done</Button></div>
        </InfoNote>
      )}
      <div className="panel overflow-x-auto scroll-thin">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-line bg-canvas/60 text-left text-xs text-ink-3"><tr><th className="px-4 py-2.5 font-medium">Name</th><th className="px-3 py-2.5 font-medium">Key</th><th className="px-3 py-2.5 font-medium">Created</th><th className="px-3 py-2.5 font-medium">Last used</th><th className="px-3 py-2.5" /></tr></thead>
          <tbody className="divide-y divide-line">
            {keys.length === 0 && <tr><td colSpan={5}><EmptyState icon={<KeyRound />} title="No API keys">Create one for each script or scraper so access can be revoked individually.</EmptyState></td></tr>}
            {keys.map((k) => (
              <tr key={k.id} className={k.revoked_at ? 'opacity-50' : ''}>
                <td className="px-4 py-3 font-medium text-ink">{k.name}</td>
                <td className="px-3 py-3 font-mono text-xs text-ink-3">{k.prefix}…</td>
                <td className="px-3 py-3 text-ink-3">{fmtDate(k.created_at)} · {k.created_by}</td>
                <td className="px-3 py-3 text-ink-3">{k.last_used_at ? relTime(k.last_used_at) : 'Never'}</td>
                <td className="px-3 py-3 text-right">{k.revoked_at ? <Badge>Revoked</Badge> : <Button size="sm" variant="danger" onClick={async () => { if (await confirmAction({ title: `Revoke “${k.name}”?`, body: 'Scripts using this key will stop working immediately.', confirmLabel: 'Revoke', tone: 'danger' })) { await api.revokeApiKey(k.id); load(); } }}>Revoke</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Sync() {
  const meta = useStore((s) => s.meta);
  const load = useStore((s) => s.load);
  const db = useDb();
  const [running, setRunning] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const run = async (id: string, dryRun: boolean) => {
    setRunning(id); setLog([`Running ${id}${dryRun ? ' (dry run)' : ''}…`]);
    try { const r = await api.sync(id, dryRun ? { dryRun: '1' } : {}); setLog((l) => [...l, ...r.log]); if (!dryRun) await load(); }
    catch (e) { setLog((l) => [...l, `Error: ${e instanceof Error ? e.message : e}`]); }
    finally { setRunning(null); }
  };
  return (
    <div className="space-y-4">
      <InfoNote>Data providers live in <code>server/data-providers/</code>. Run them here, from the command line (<code>npm run sync -- --provider=&lt;id&gt;</code>), or on a schedule (cron). Every run goes through the same sync engine: matching, provenance, conflict detection.</InfoNote>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {meta?.dataProviders.map((p) => {
          const src = db.sources[p.sourceId];
          return (
            <section key={p.id} className="panel p-5">
              <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-ink">{p.name}</div><div className="text-xs text-ink-3"><code>{p.id}</code> · {p.entities.join(', ')}</div></div>{src?.lastSync && <Badge tone="outline">Last run {relTime(src.lastSync)}</Badge>}</div>
              <p className="mt-2 text-sm text-ink-2">{p.description}</p>
              {src?.lastResult && <p className="mt-2 text-xs text-ink-3">Last result: +{src.lastResult.created} created, {src.lastResult.updated} updated, {src.lastResult.conflicts} conflicts, {src.lastResult.errors} errors</p>}
              <div className="mt-4 flex gap-2"><Button size="sm" icon={<Play className="h-3.5 w-3.5" />} loading={running === p.id} onClick={() => run(p.id, true)}>Dry run</Button><Button size="sm" variant="primary" loading={running === p.id} onClick={() => run(p.id, false)}>Run sync</Button></div>
            </section>
          );
        })}
      </div>
      {log.length > 0 && <pre className="panel max-h-[320px] overflow-auto scroll-thin p-4 font-mono text-xs leading-relaxed text-ink-2">{log.join('\n')}</pre>}
    </div>
  );
}

function Matchers() {
  const meta = useStore((s) => s.meta);
  const [results, setResults] = useState<Record<string, EvalResult>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const evaluate = async (id: string) => {
    setBusy(id);
    try { const r = await api.eval(id); setResults((x) => ({ ...x, [id]: r })); } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };
  return (
    <div className="space-y-4">
      <InfoNote>Register matchers in <code>server/matchers/index.ts</code> or with <code>MATCHERS_HTTP</code>. Evaluation replays every labelled decision in this workspace (outcomes, review decisions, shortlists) through a matcher. See docs/matching/evaluation.md.</InfoNote>
      <div className="panel overflow-x-auto scroll-thin">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-line bg-canvas/60 text-left text-xs text-ink-3"><tr><th className="px-4 py-2.5 font-medium">Matcher</th><th className="px-3 py-2.5 font-medium">Labelled queries</th><th className="px-3 py-2.5 font-medium">Hit@1</th><th className="px-3 py-2.5 font-medium">Hit@3</th><th className="px-3 py-2.5 font-medium">MRR</th><th className="px-3 py-2.5 font-medium">Recall</th><th className="px-3 py-2.5 font-medium">Pairwise</th><th className="px-3 py-2.5" /></tr></thead>
          <tbody className="divide-y divide-line">
            {meta?.providers.map((p) => {
              const r = results[p.id];
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3"><div className="font-medium text-ink">{p.name} {p.default && <Badge tone="accent">default</Badge>}</div><div className="text-xs text-ink-3"><code>{p.id}</code> v{p.version} — {p.description}</div></td>
                  <td className="px-3 py-3 tabular">{r ? `${r.withPositives}/${r.queries}` : '—'}</td>
                  {(['hitAt1', 'hitAt3', 'mrr', 'recall'] as const).map((k) => <td key={k} className="px-3 py-3 tabular">{r ? r[k].toFixed(2) : '—'}</td>)}
                  <td className="px-3 py-3 tabular">{r?.pairwiseAccuracy != null ? r.pairwiseAccuracy.toFixed(2) : '—'}</td>
                  <td className="px-3 py-3 text-right"><Button size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} loading={busy === p.id} onClick={() => evaluate(p.id)}>Evaluate</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={api.exportUrl('corpus')} download><Button icon={<Download className="h-4 w-4" />}>Download corpus (JSON)</Button></a>
        <a href={api.exportUrl('labels')} download><Button icon={<Download className="h-4 w-4" />}>Download labelled decisions</Button></a>
      </div>
      <p className="text-xs text-ink-3">Small samples say little. Treat these numbers as a regression check, not proof that one algorithm is better.</p>
    </div>
  );
}

function Departments() {
  const db = useDb();
  const commit = useStore((s) => s.commit);
  const depts = Object.values(db.departments).sort((a, b) => a.college.localeCompare(b.college) || a.name.localeCompare(b.name));
  const add = async () => {
    const name = await ask({ title: 'Add a department', confirmLabel: 'Next', input: { label: 'Department name', required: true } });
    if (!name) return;
    const colleges = [...new Set(depts.map((d) => d.college))];
    const college = await ask({ title: `College for ${name}`, confirmLabel: 'Add department', input: { label: 'College (pick or type a new one)', required: true, initial: colleges[0] } });
    if (!college) return;
    const d: Department = { id: `d-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`, name, college };
    if (db.departments[d.id]) return toast.error('That department already exists.');
    commit([{ op: 'put', collection: 'departments', record: d as never }], { success: 'Department added' });
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-between"><p className="text-sm text-ink-3">{depts.length} departments. Faculty are linked to one; ingestion can also create them.</p><Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={add}>Add department</Button></div>
      <div className="panel divide-y divide-line">
        {depts.map((d) => <div key={d.id} className="flex justify-between px-4 py-2.5 text-sm"><span className="text-ink">{d.name}</span><span className="text-ink-3">{d.college} · <code className="text-xs">{d.id}</code></span></div>)}
      </div>
    </div>
  );
}

function Audit() {
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof api.audit>>['entries']>([]);
  const [done, setDone] = useState(false);
  const db = useDb();
  const more = (before?: number) => api.audit(before).then((r) => { setEntries((e) => (before ? [...e, ...r.entries] : r.entries)); if (r.entries.length < 200) setDone(true); }).catch((e) => toast.error(e.message));
  useEffect(() => { more(); }, []);
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-3">Every change to this workspace, newest first. Append-only.</p>
      <div className="panel divide-y divide-line">
        {entries.map((e) => (
          <div key={e.id} className="grid grid-cols-[160px_180px_100px_1fr] gap-3 px-4 py-2 text-sm">
            <span className="text-ink-3 tabular">{fmtDate(e.at, 'MMM d, HH:mm:ss')}</span>
            <span className="truncate text-ink-2">{db.users[e.actor]?.name ?? e.actor}</span>
            <span><Badge tone="outline">{e.kind}</Badge></span>
            <span className="truncate text-ink-2">{e.summary}</span>
          </div>
        ))}
      </div>
      {!done && entries.length > 0 && <Button onClick={() => more(entries[entries.length - 1].id)}>Load older</Button>}
    </div>
  );
}

function System() {
  const meta = useStore((s) => s.meta)!;
  const rows: [string, string][] = [
    ['Workspace', meta.workspace], ['Enabled workspaces', meta.workspaces.join(', ')], ['Authentication', meta.authMode === 'header' ? 'SSO header (production)' : 'Development sign-in — do not expose publicly'],
    ['Database file', meta.file], ['Schema version', String(meta.schemaVersion)], ['Created', fmtDate(meta.seededAt)], ['App version', meta.version],
    ['Default matcher', meta.defaultProvider], ['Matchers', meta.providers.map((p) => p.id).join(', ')], ['Data providers', meta.dataProviders.map((p) => p.id).join(', ')],
  ];
  return (
    <div className="space-y-4">
      {meta.authMode === 'dev' && meta.workspace === 'live' && <InfoNote tone="warn" icon={<ShieldAlert />}>Development sign-in lets anyone pick a user. Before real use, put the app behind university SSO and set <code>AUTH_MODE=header</code> (docs/deployment.md).</InfoNote>}
      <div className="panel divide-y divide-line">{rows.map(([k, v]) => <div key={k} className="grid grid-cols-[200px_1fr] px-4 py-2.5 text-sm"><span className="text-ink-3">{k}</span><span className="break-all text-ink">{v}</span></div>)}</div>
      <div className="flex gap-2"><a href={api.exportUrl('db')} download><Button icon={<Download className="h-4 w-4" />}>Export workspace (JSON)</Button></a></div>
      <p className="text-xs text-ink-3">For full backups use <code>npm run backup</code> on the server (SQLite online backup).</p>
    </div>
  );
}
