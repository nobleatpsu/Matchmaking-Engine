import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useUI } from '@/lib/ui';
import { Drawer } from '../ui/overlays';
import { Button } from '../ui/Button';
import { cn } from '@/lib/cn';

const STEPS: { title: string; say: string; to: string }[] = [
  { title: 'Start at the Command Center', say: 'This is an engagement lead’s day: reviews waiting, overdue follow-ups, new signals, stale records — each links to the underlying records.', to: '/' },
  { title: 'Open Match Studio', say: 'A company describes a need in plain language. No twenty-field form.', to: '/match?demo=voltaic' },
  { title: 'Run the energy-storage request', say: 'Voltaic Ridge wants solid-state batteries, storage and sustainable manufacturing. Press “Find matches”.', to: '/match?demo=voltaic' },
  { title: 'Read one explanation', say: 'Each score breaks into five components. Missing data is “not assessed” — it lowers confidence, not the match.', to: '/match?demo=voltaic' },
  { title: 'Inspect a profile', say: 'Open Adaeze Okafor. Projects, IP and data quality with sources and dates.', to: '/faculty/f-okafor' },
  { title: 'Compare candidates', say: 'Back in Match Studio, tick two to four researchers and press Compare. “Why A ranks above B” is computed, not guessed.', to: '/match?demo=voltaic' },
  { title: 'Shortlist two', say: 'Save Okafor and Lindqvist. Notes and statuses persist.', to: '/match?demo=voltaic' },
  { title: 'Create the opportunity', say: 'From the shortlist: create an opportunity for Voltaic, and send both to review.', to: '/match?demo=voltaic' },
  { title: 'Switch to a reviewer', say: 'Account menu → Marcus Hale. Open the Review Queue.', to: '/review' },
  { title: 'Approve with evidence in view', say: 'The checklist must be complete. Approval does not send anything.', to: '/review' },
  { title: 'Prepare the introduction', say: 'On the opportunity: create a draft, edit, copy. Status reads “Draft — not sent”.', to: '/opportunities' },
  { title: 'See it in the pipeline', say: 'The card sits in “Introduction prepared”. Recruiting cards can’t be dragged there — different workflow.', to: '/opportunities' },
  { title: 'Record what happened', say: 'After sending it yourself, “Record as sent”. It shows in the timeline and in Outcomes & Analytics.', to: '/analytics' },
];

export function DemoGuide() {
  const { guide, setGuide } = useUI();
  const navigate = useNavigate();
  const [done, setDone] = useState<number[]>([]);
  return (
    <Drawer open={guide} onOpenChange={setGuide} title="Demo script" subtitle="A 10-minute walkthrough of the core workflow" width={440}>
      <ol className="p-4 space-y-1">
        {STEPS.map((s, i) => (
          <li key={i} className={cn('group rounded-lg p-3 transition-colors hover:bg-subtle', done.includes(i) && 'opacity-60')}>
            <div className="flex items-start gap-3">
              <button
                onClick={() => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))}
                aria-label={done.includes(i) ? 'Mark not done' : 'Mark done'}
                className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1', done.includes(i) ? 'bg-good text-white ring-good' : 'bg-surface text-ink-2 ring-line')}
              >
                {done.includes(i) ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{s.title}</div>
                <p className="mt-0.5 text-sm text-ink-3">{s.say}</p>
              </div>
              <Button size="xs" variant="ghost" iconRight={<ArrowRight className="h-3 w-3" />} onClick={() => { navigate(s.to); setGuide(false); }}>Go</Button>
            </div>
          </li>
        ))}
      </ol>
      <p className="px-7 pb-6 text-xs text-ink-3">Tip: reset demo data from the account menu (outside presentation mode) before a meeting.</p>
    </Drawer>
  );
}
