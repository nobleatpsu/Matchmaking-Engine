import { toast } from 'sonner';
import { OUTCOME_LABELS, stageLabel } from '@shared/rules';
import type { OutcomeKind, Stage } from '@shared/types';
import { ask, confirmAction } from '@/components/ui/overlays';
import { guardMove, moveOpportunity } from './actions';
import { useStore } from './store';

/**
 * Move an opportunity with the right human checkpoints:
 * blocked moves explain why, consequential moves ask for confirmation,
 * Outcome asks what happened, Closed asks why.
 */
export async function moveWithChecks(oppId: string, to: Stage, nav?: (to: string) => void): Promise<boolean> {
  const db = useStore.getState().db!;
  const opp = db.opportunities[oppId];
  const g = guardMove(opp, to);

  if (!g.ok) {
    if (g.fix === 'record-outcome') {
      const kind = await ask({
        title: 'What happened?', body: 'Outcomes are recorded by people and feed Outcomes & Analytics. They are kept separate from match scores.',
        confirmLabel: 'Record outcome & move', input: { label: 'Outcome', required: true, options: Object.entries(OUTCOME_LABELS).map(([value, v]) => ({ value, label: v.label })) },
      });
      if (!kind) return false;
      const note = await ask({ title: 'Add context (optional)', confirmLabel: 'Save', input: { label: 'Note', multiline: true } });
      return moveOpportunity(oppId, to, { outcome: { kind: kind as OutcomeKind, note: note || undefined, facultyId: opp.facultyIds[0] } });
    }
    if (g.fix === 'add-close-reason') {
      const reason = await ask({ title: 'Close this opportunity?', body: 'The reason is kept for later analysis of why engagements stall.', confirmLabel: 'Close opportunity', tone: 'danger', input: { label: 'Reason for closing', required: true, multiline: true } });
      if (!reason) return false;
      return moveOpportunity(oppId, to, { closeReason: reason });
    }
    toast.error(g.reason, nav && (g.fix === 'create-review' || g.fix === 'create-draft')
      ? { action: { label: g.fix === 'create-review' ? 'Open opportunity' : 'Go to draft', onClick: () => nav(`/opportunities/${oppId}#intro`) } }
      : undefined);
    return false;
  }
  if (g.confirm && !(await confirmAction({ title: `Move to “${stageLabel(to)}”?`, body: g.confirm, confirmLabel: 'Move' }))) return false;
  return moveOpportunity(oppId, to);
}
