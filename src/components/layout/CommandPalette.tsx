import { Command } from 'cmdk';
import * as D from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  BarChart3, Building2, ClipboardCheck, Compass, DatabaseZap, FileBox, FlaskConical, GraduationCap, Kanban, LayoutDashboard,
  Plus, Radar, Sparkles, Briefcase,
} from 'lucide-react';
import { useDb } from '@/lib/store';
import { useUI } from '@/lib/ui';
import { Avatar } from '../ui/primitives';
import { stageLabel } from '@shared/rules';

export function CommandPalette() {
  const { palette, setPalette, openNewOpp, setNewCompany } = useUI();
  const db = useDb();
  const navigate = useNavigate();
  const go = (to: string) => { setPalette(false); navigate(to); };
  const run = (fn: () => void) => { setPalette(false); setTimeout(fn, 50); };

  return (
    <D.Root open={palette} onOpenChange={setPalette}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-modal bg-[rgb(4_12_26/0.38)] animate-fade-in" />
        <D.Content className="fixed inset-x-0 mx-auto top-[12vh] z-modal w-[min(640px,calc(100vw-24px))] overflow-hidden rounded-lg bg-raised shadow-lg ring-1 ring-line animate-pop-in">
          <D.Title className="sr-only">Search</D.Title>
          <D.Description className="sr-only">Search records or run a command</D.Description>
          <Command label="Command menu" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:eyebrow">
            <Command.Input autoFocus placeholder="Search people, companies, opportunities, IP — or type a command…" className="h-12 w-full border-b border-line bg-transparent px-4 text-[15px] outline-none placeholder:text-ink-4" />
            <Command.List className="max-h-[56vh] overflow-y-auto scroll-thin p-1.5">
              <Command.Empty className="px-4 py-10 text-center text-sm text-ink-3">No matches. Try a researcher name, company or topic.</Command.Empty>

              <Command.Group heading="Actions">
                <Item icon={<Sparkles />} onSelect={() => go('/match')} hint="Match Studio">Find faculty for an industry need</Item>
                <Item icon={<Plus />} onSelect={() => run(() => openNewOpp())}>New opportunity</Item>
                <Item icon={<Plus />} onSelect={() => run(() => setNewCompany(true))}>New company</Item>
              </Command.Group>

              <Command.Group heading="Go to">
                {[
                  ['/', 'Command Center', <LayoutDashboard key="i" />], ['/match', 'Match Studio', <Sparkles key="i" />], ['/review', 'Review Queue', <ClipboardCheck key="i" />],
                  ['/opportunities', 'Pipeline', <Kanban key="i" />], ['/faculty', 'Faculty', <GraduationCap key="i" />], ['/companies', 'Companies', <Building2 key="i" />],
                  ['/ip', 'IP & Commercialization', <FlaskConical key="i" />], ['/signals', 'Signals', <Radar key="i" />], ['/matchmaking-demo', 'Match Outputs (synthetic)', <FileBox key="i" />], ['/analytics', 'Outcomes & Analytics', <BarChart3 key="i" />],
                  ['/data', 'Data Health', <DatabaseZap key="i" />], ['/process', 'Process & Questions', <Compass key="i" />],
                ].map(([to, label, icon]) => <Item key={to as string} icon={icon as ReactNode} onSelect={() => go(to as string)}>{label as string}</Item>)}
              </Command.Group>

              <Command.Group heading="Faculty">
                {Object.values(db.faculty).map((f) => (
                  <Item key={f.id} value={`faculty ${f.name} ${f.keywords.join(' ')} ${db.departments[f.departmentId]?.name}`} icon={<Avatar name={f.name} size={20} />} onSelect={() => go(`/faculty/${f.id}`)} hint={db.departments[f.departmentId]?.name}>{f.name}</Item>
                ))}
              </Command.Group>
              <Command.Group heading="Companies">
                {Object.values(db.companies).map((c) => (
                  <Item key={c.id} value={`company ${c.name} ${c.industry}`} icon={<Avatar name={c.name} size={20} square />} onSelect={() => go(`/companies/${c.id}`)} hint={c.industry}>{c.name}</Item>
                ))}
              </Command.Group>
              <Command.Group heading="Opportunities">
                {Object.values(db.opportunities).map((o) => (
                  <Item key={o.id} value={`opportunity ${o.title} ${db.companies[o.companyId]?.name}`} icon={<Briefcase />} onSelect={() => go(`/opportunities/${o.id}`)} hint={stageLabel(o.stage)}>{o.title}</Item>
                ))}
              </Command.Group>
              <Command.Group heading="Research projects">
                {Object.values(db.projects).map((p) => (
                  <Item key={p.id} value={`project ${p.title}`} icon={<FileBox />} onSelect={() => go(`/faculty/${p.facultyIds[0]}?tab=research`)} hint={db.faculty[p.facultyIds[0]]?.name}>{p.title}</Item>
                ))}
              </Command.Group>
              <Command.Group heading="Intellectual property">
                {Object.values(db.ip).map((p) => (
                  <Item key={p.id} value={`ip ${p.title}`} icon={<FlaskConical />} onSelect={() => go(`/ip?item=${p.id}`)} hint={p.status}>{p.title}</Item>
                ))}
              </Command.Group>
            </Command.List>
            <div className="flex items-center gap-3 border-t border-line bg-canvas/60 px-4 py-2 text-2xs text-ink-3">
              <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> navigate</span><span><kbd className="kbd">↵</kbd> open</span><span><kbd className="kbd">esc</kbd> close</span><span className="ml-auto">Search covers this workspace only</span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function Item({ children, icon, onSelect, hint, value }: { children: ReactNode; icon?: ReactNode; onSelect: () => void; hint?: ReactNode; value?: string }) {
  return (
    <Command.Item
      value={value ?? String(children)}
      onSelect={onSelect}
      className="relative flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-3 text-[13px] text-ink aria-selected:bg-accent-soft aria-selected:text-ink aria-selected:before:absolute aria-selected:before:inset-y-2 aria-selected:before:left-0 aria-selected:before:w-[2px] aria-selected:before:rounded-full aria-selected:before:bg-accent [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-ink-3"
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="truncate text-xs text-ink-4 max-w-[45%]">{hint}</span>}
    </Command.Item>
  );
}
