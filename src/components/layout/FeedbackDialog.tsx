import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useUI } from '@/lib/ui';
import { submitFeedback } from '@/lib/actions';
import { Dialog } from '../ui/overlays';
import { Button } from '../ui/Button';
import { Field, Segmented, Select } from '../ui/primitives';
import type { Feedback } from '@shared/types';

const KINDS: { value: Feedback['kind']; label: string }[] = [
  { value: 'match-quality', label: 'Match quality' },
  { value: 'missing-data', label: 'Missing data' },
  { value: 'workflow', label: 'Confusing workflow' },
  { value: 'idea', label: 'Idea' },
];

export function FeedbackDialog() {
  const { feedback, setFeedback } = useUI();
  const loc = useLocation();
  const [kind, setKind] = useState<Feedback['kind']>('workflow');
  const [stakeholder, setStakeholder] = useState('');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const submit = async () => {
    if (text.trim().length < 5) { setErr('Please describe the feedback in a few words.'); return; }
    if (await submitFeedback({ kind, text: text.trim(), page: loc.pathname + loc.search, stakeholder: stakeholder || undefined })) {
      setText(''); setErr(''); setFeedback(false);
    }
  };
  return (
    <Dialog
      open={feedback}
      onOpenChange={setFeedback}
      title="Capture feedback"
      description="For discovery sessions with CEC, OTT and other stakeholders. Saved with the current screen."
      footer={<><Button variant="ghost" onClick={() => setFeedback(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Save feedback</Button></>}
    >
      <div className="space-y-4">
        <Field label="Type"><Segmented value={kind} onChange={setKind} options={KINDS} /></Field>
        <Field label="Who said it" hint="Optional — e.g. a stakeholder group, not a personal name.">
          <Select value={stakeholder} onChange={setStakeholder} placeholder="Not specified" options={['CEC', 'OTT', 'Research Office', 'Faculty', 'Industry partner', 'Project team'].map((x) => ({ value: x, label: x }))} />
        </Field>
        <Field label="Feedback" required error={err}>
          <textarea autoFocus rows={4} className="input" value={text} aria-invalid={!!err} onChange={(e) => setText(e.target.value)} placeholder="e.g. “We’d never introduce a company before checking whether OTT already has a relationship.”" />
        </Field>
        <p className="text-xs text-ink-3">Screen: <code className="rounded bg-subtle px-1">{loc.pathname}</code></p>
      </div>
    </Dialog>
  );
}
