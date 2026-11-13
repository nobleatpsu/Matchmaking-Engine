import { Component, useState, type ReactNode } from 'react';
import { AlertTriangle, LockKeyhole, UserPlus } from 'lucide-react';
import { BRAND } from '@shared/brand';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { Button } from '../ui/Button';
import { Field } from '../ui/primitives';
import { BrandMark } from './Brand';

function Shell({ children }: { children: ReactNode }) {
  const { meta, setWorkspace } = useStore();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-[440px]">
        <div className="mb-6 flex items-center gap-3"><BrandMark size={36} /><div><div className="eyebrow">{BRAND.institution}</div><div className="font-serif text-xl font-semibold text-navy">{BRAND.product}</div></div></div>
        <div className="panel p-6 shadow-sm">{children}</div>
        {meta?.workspaces.includes('demo') && <p className="mt-4 text-center text-sm text-ink-3">Just looking? <button className="link" onClick={() => setWorkspace('demo')}>Open the demo workspace</button> (fictional data).</p>}
      </div>
    </div>
  );
}

/** Live workspace has no users yet (dev auth): create the first administrator. */
export function BootstrapScreen() {
  const load = useStore((s) => s.load);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(email)) { setErr('Enter your name and a valid email.'); return; }
    setBusy(true);
    try { await api.bootstrap(name, email); await load(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return (
    <Shell>
      <div className="flex items-center gap-2 text-md font-semibold text-ink"><UserPlus className="h-5 w-5 text-accent" />Set up the live workspace</div>
      <p className="mt-1.5 text-sm text-ink-3">The live workspace is empty. Create the first administrator — you can add colleagues, import faculty and companies, and connect data sources next.</p>
      <div className="mt-5 space-y-4">
        <Field label="Your name" required><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email" required error={err || undefined} hint="Use the address your SSO will send, so you keep access when SSO is turned on."><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} /></Field>
        <Button variant="primary" className="w-full justify-center" loading={busy} onClick={submit}>Create administrator</Button>
      </div>
      <p className="mt-4 text-xs text-ink-4">This screen only appears while there are no users, and only with AUTH_MODE=dev. In production, set ADMIN_EMAILS instead.</p>
    </Shell>
  );
}

export function NoAccessScreen({ reason }: { reason: 'not-signed-in' | 'not-provisioned' }) {
  const email = useStore((s) => s.authEmail);
  return (
    <Shell>
      <div className="flex items-center gap-2 text-md font-semibold text-ink"><LockKeyhole className="h-5 w-5 text-warn" />{reason === 'not-provisioned' ? 'You don’t have access yet' : 'Please sign in'}</div>
      <p className="mt-1.5 text-sm text-ink-3">
        {reason === 'not-provisioned'
          ? <>You’re signed in{email ? <> as <b>{email}</b></> : ''}, but no account exists for you here. Ask an administrator to add you in Admin → Users.</>
          : 'Your session could not be verified. Reload the page to sign in through the university login.'}
      </p>
      <Button className="mt-5" onClick={() => window.location.reload()}>Reload</Button>
    </Shell>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error(error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-warn" />
          <h2 className="mt-3 text-lg font-semibold text-ink">Something went wrong on this screen</h2>
          <p className="mt-1 text-sm text-ink-3">{this.state.error.message}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => this.setState({ error: undefined })}>Try again</Button>
            <Button variant="primary" onClick={() => { window.location.href = '/'; }}>Go to Command Center</Button>
          </div>
        </div>
      </div>
    );
  }
}
