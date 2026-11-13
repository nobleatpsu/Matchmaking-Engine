import { useEffect, useState, type ReactNode } from 'react';
import { isAdmin, ROLES } from '@shared/roles';
import { NavLink, Outlet, useLocation, useMatch, useNavigate, useResolvedPath } from 'react-router-dom';
import * as D from '@radix-ui/react-dialog';
import { motion } from 'motion/react';
import {
  BarChart3, Bell, Building2, Check, ChevronsLeft, ChevronsRight, ClipboardCheck, Compass, DatabaseZap, FlaskConical, GraduationCap,
  Kanban, LayoutDashboard, LogOut, Menu as MenuIcon, Monitor, MessageSquarePlus, MonitorPlay, Moon, Radar, RotateCcw, Search, Settings2,
  ShieldCheck, Sparkles, Sun, UserRound, Layers, X, FlaskRound,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useStore, useDb, useMe } from '@/lib/store';
import { useUI } from '@/lib/ui';
import { useTheme, type ThemePref } from '@/lib/theme';
import { relTime } from '@/lib/format';
import { pageVariants, t } from '@/lib/motion';
import { markNotificationsRead } from '@/lib/actions';
import { Button } from '../ui/Button';
import { Avatar, Kbd } from '../ui/primitives';
import { Menu, MenuItem, MenuLabel, MenuSep, Popover, Tip, confirmAction } from '../ui/overlays';
import { Wordmark } from './Brand';
import { BRAND } from '@shared/brand';
import { CommandPalette } from './CommandPalette';
import { FeedbackDialog } from './FeedbackDialog';
import { NewOpportunityDialog } from '../forms/NewOpportunityDialog';
import { NewCompanyDialog } from '../forms/NewCompanyDialog';
import { DemoGuide } from './DemoGuide';

interface NavItem { to: string; label: string; icon: ReactNode; badge?: number; badgeTip?: string; urgent?: boolean; end?: boolean; tag?: string }
interface NavGroup { label: string; items: NavItem[] }

/** Navigation model, grouped by what people are doing rather than by data type. */
function useNavGroups(): NavGroup[] {
  const db = useDb();
  const me = useMe();
  const admin = isAdmin(me);
  const open = Object.values(db.reviews).filter((r) => r.status === 'pending' || r.status === 'changes-requested');
  const mine = open.filter((r) => r.assigneeId === me.id).length;
  const newSignals = Object.values(db.signals).filter((s) => s.status === 'new').length;
  const issues = Object.values(db.issues).filter((i) => i.status === 'open').length;
  return [
    {
      label: 'Workspace', items: [
        { to: '/', label: 'Command Center', icon: <LayoutDashboard />, end: true },
        { to: '/match', label: 'Match Studio', icon: <Sparkles /> },
        { to: '/review', label: 'Review Queue', icon: <ClipboardCheck />, badge: open.length, urgent: mine > 0, badgeTip: `${open.length} open · ${mine} assigned to you` },
        { to: '/opportunities', label: 'Pipeline', icon: <Kanban /> },
      ],
    },
    {
      label: 'Research intelligence', items: [
        { to: '/faculty', label: 'Faculty', icon: <GraduationCap /> },
        { to: '/companies', label: 'Companies', icon: <Building2 /> },
        { to: '/ip', label: 'IP & Commercialization', icon: <FlaskConical /> },
        { to: '/signals', label: 'Signals', icon: <Radar />, badge: newSignals, badgeTip: `${newSignals} new signals to triage` },
        { to: '/matchmaking-demo', label: 'Match Outputs', icon: <Layers />, tag: 'Synthetic' },
      ],
    },
    {
      label: 'Operations', items: [
        { to: '/analytics', label: 'Outcomes & Analytics', icon: <BarChart3 /> },
        { to: '/data', label: 'Data Health', icon: <DatabaseZap />, badge: issues, badgeTip: `${issues} open data issues` },
        { to: '/process', label: 'Process & Questions', icon: <Compass /> },
      ],
    },
    ...(admin ? [{ label: 'System', items: [{ to: '/admin', label: 'Administration', icon: <Settings2 /> }] }] : []),
  ];
}

export function AppShell() {
  const narrow = useMedia('(max-width: 1023px)');
  const mobile = useMedia('(max-width: 767px)');
  const collapsed = useStore((s) => s.sidebarCollapsed) || narrow;
  const toggle = useStore((s) => s.toggleSidebar);
  const isDemo = useStore((s) => s.workspace === 'demo');
  const setPalette = useUI((s) => s.setPalette);
  const location = useLocation();
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); toggle(); }
      if (e.key === '/' && !isTyping(e)) { e.preventDefault(); setPalette(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPalette, toggle]);

  // Transitions are keyed by section so in-section navigation (e.g. /match → /match/:id) keeps component state.
  useEffect(() => { document.getElementById('main')?.scrollTo({ top: 0 }); setSheet(false); }, [location.pathname]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-toast focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-md">Skip to content</a>

      {!mobile && (
        <motion.aside
          className="no-print relative z-rail flex shrink-0 flex-col bg-rail text-rail-ink"
          initial={false}
          animate={{ width: collapsed ? 60 : 236 }}
          transition={t.slow}
        >
          <Rail collapsed={collapsed} onToggle={narrow ? undefined : toggle} />
        </motion.aside>
      )}

      {mobile && (
        <D.Root open={sheet} onOpenChange={setSheet}>
          <D.Portal>
            <D.Overlay className="fixed inset-0 z-drawer bg-[rgb(4_12_26/0.45)] animate-fade-in" />
            <D.Content className="fixed inset-y-0 left-0 z-drawer flex w-[272px] flex-col bg-rail text-rail-ink shadow-lg animate-slide-in-left">
              <D.Title className="sr-only">Navigation</D.Title>
              <D.Description className="sr-only">Main navigation</D.Description>
              <D.Close className="absolute right-2 top-3 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Close navigation"><X className="h-4 w-4" /></D.Close>
              <Rail collapsed={false} />
            </D.Content>
          </D.Portal>
        </D.Root>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4">
          {mobile && <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setSheet(true)}><MenuIcon className="h-[18px] w-[18px]" /></Button>}
          <button
            onClick={() => setPalette(true)}
            className="group flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-canvas px-2.5 text-[13px] text-ink-3 transition-colors duration-fast hover:border-line-strong hover:text-ink-2 sm:max-w-[420px]"
            aria-label="Search and commands"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate text-left">Search researchers, companies, opportunities, IP…</span>
            <span className="hidden gap-0.5 sm:flex"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <WorkspaceSwitch />
            <PresentationControls />
            <Notifications />
            <UserMenu />
          </div>
        </header>
        {isDemo && <DemoBand />}
        <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto scroll-thin focus:outline-none">
          <motion.div key={location.pathname.split('/')[1] || 'home'} variants={pageVariants} initial="initial" animate="enter" className="min-h-full">
            <Outlet />
          </motion.div>
        </main>
      </div>

      <CommandPalette />
      <FeedbackDialog />
      <NewOpportunityDialog />
      <NewCompanyDialog />
      {isDemo && <DemoGuide />}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function Rail({ collapsed, onToggle }: { collapsed: boolean; onToggle?: () => void }) {
  const groups = useNavGroups();
  const isDemo = useStore((s) => s.workspace === 'demo');
  return (
    <>
      <div className={cn('flex h-12 shrink-0 items-center border-b border-white/[0.07]', collapsed ? 'justify-center' : 'px-4')}>
        <NavLink to="/" aria-label={`${BRAND.name} — Command Center`} className="rounded-md focus-visible:outline-pugh"><Wordmark collapsed={collapsed} onDark /></NavLink>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3 [scrollbar-width:none]" aria-label="Main">
        {groups.map((g) => (
          <div key={g.label} className="mt-4 first:mt-3">
            {collapsed
              ? <div className="mx-auto mb-1.5 h-px w-5 bg-white/10" aria-hidden />
              : <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-pugh/70">{g.label}</div>}
            <ul className="space-y-px">
              {g.items.map((it) => (
                <li key={it.to}>
                  <RailLink it={it} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-1.5 border-t border-white/[0.07] p-2">
        <WorkspaceIdentity collapsed={collapsed} demo={isDemo} />
        {!collapsed && (
          <div className="flex items-start gap-2 px-2.5 py-1.5 text-[11px] leading-[15px] text-white/55">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-pugh/80" />
            <span>Never contacts anyone. People review, prepare and send every introduction.</span>
          </div>
        )}
        {onToggle && (
          <button onClick={onToggle} className={cn('flex h-7 w-full items-center gap-2 rounded-md px-2.5 text-[12px] text-white/50 outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-pugh/80', collapsed && 'justify-center px-0')} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}>
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" />Collapse<span className="ml-auto font-mono text-[10px] text-white/60">⌘\</span></>}
          </button>
        )}
      </div>
    </>
  );
}

function RailLink({ it, collapsed }: { it: NavItem; collapsed: boolean }) {
  const path = useResolvedPath(it.to);
  const isActive = !!useMatch({ path: path.pathname, end: !!it.end });
  return (
    <Tip content={collapsed ? <span>{it.label}{it.badge ? ` · ${it.badgeTip ?? it.badge}` : ''}</span> : it.badgeTip && it.badge ? it.badgeTip : null} side="right">
      <NavLink
        to={it.to}
        end={it.end}
        aria-label={collapsed ? it.label : undefined}
        className={cn(
          'group relative flex h-8 items-center gap-2.5 rounded-md text-[13px] font-medium outline-none transition-colors duration-fast',
          'focus-visible:ring-2 focus-visible:ring-pugh/80 [&>svg]:relative [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0',
          collapsed ? 'justify-center px-0' : 'px-2.5',
          isActive ? 'text-white [&>svg]:text-pugh' : 'text-white/70 hover:bg-white/[0.06] hover:text-white [&>svg]:text-white/55 hover:[&>svg]:text-white/80',
        )}
      >
        {isActive && (
          <motion.span layoutId="rail-active" transition={t.layout} className="absolute inset-0 rounded-md bg-white/[0.10] ring-1 ring-inset ring-white/[0.06]">
            <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-pugh" />
          </motion.span>
        )}
        {it.icon}
        {!collapsed && <span className="relative flex-1 truncate">{it.label}</span>}
        {!collapsed && it.tag && <span className="relative rounded-sm border border-white/15 px-1 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-white/55">{it.tag}</span>}
        {!!it.badge && (collapsed
          ? <span className={cn('absolute right-2.5 top-1.5 h-1.5 w-1.5 rounded-full', it.urgent ? 'bg-[#F2B544]' : 'bg-pugh')} />
          : <span className={cn('relative min-w-[20px] rounded-sm px-1 text-center font-mono text-[10.5px] font-medium leading-[18px] tabular', it.urgent ? 'bg-[#F2B544] text-[#001E44]' : 'bg-white/10 text-white/80')}>{it.badge}</span>)}
      </NavLink>
    </Tip>
  );
}

function WorkspaceIdentity({ collapsed, demo }: { collapsed: boolean; demo: boolean }) {
  if (collapsed) {
    return (
      <Tip side="right" content={demo ? 'Demo workspace — fictional records' : 'Live workspace — real records'}>
        <div className={cn('mx-auto flex h-7 w-7 items-center justify-center rounded-md', demo ? 'demo-hatch bg-[#F2B544]/15 ring-1 ring-[#F2B544]/50' : 'ring-1 ring-white/15')} aria-label={demo ? 'Demo workspace' : 'Live workspace'}>
          <span className={cn('h-2 w-2 rounded-full', demo ? 'bg-[#F2B544]' : 'bg-[#5BD49A]')} />
        </div>
      </Tip>
    );
  }
  return demo ? (
    <div className="relative overflow-hidden rounded-md bg-[#F2B544]/[0.10] px-2.5 py-2 ring-1 ring-inset ring-[#F2B544]/40">
      <span className="demo-hatch absolute inset-y-0 left-0 w-1.5 [--demo:242_181_68]" aria-hidden />
      <div className="pl-1.5 text-[12px] font-semibold text-[#F7CF7E]">Demo workspace</div>
      <div className="pl-1.5 text-[11px] leading-[14px] text-white/60">Fictional people and records</div>
    </div>
  ) : (
    <div className="rounded-md px-2.5 py-2 ring-1 ring-inset ring-white/10">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white"><span className="h-1.5 w-1.5 rounded-full bg-[#5BD49A]" />Live workspace</div>
      <div className="text-[11px] leading-[14px] text-white/55">Real institutional records</div>
    </div>
  );
}

/** The persistent demo marker. Thin enough to work under, impossible to miss. */
function DemoBand() {
  const { meta, setWorkspace } = useStore();
  const both = (meta?.workspaces.length ?? 0) > 1;
  return (
    <div role="note" className="no-print relative flex h-7 shrink-0 items-center gap-2 overflow-hidden border-b border-demo/25 bg-demo-soft pl-5 pr-3 text-[12px] text-ink-2">
      <span className="demo-hatch absolute inset-y-0 left-0 w-2.5" aria-hidden />
      <span className="font-semibold text-demo">Demo workspace</span>
      <span className="hidden truncate sm:inline">Every person, company, score and record here is fictional. Nothing reflects real Penn State data.</span>
      <span className="truncate sm:hidden">All records are fictional.</span>
      {both && <button onClick={() => setWorkspace('live')} className="ml-auto shrink-0 rounded-sm px-1.5 font-medium text-demo underline-offset-2 hover:underline">Switch to live</button>}
    </div>
  );
}

/** Live ↔ Demo. Always shows both states so the current one is never ambiguous. */
function WorkspaceSwitch() {
  const { meta, workspace, setWorkspace } = useStore();
  const both = (meta?.workspaces.length ?? 0) > 1;
  if (!both) return null;
  return (
    <div role="radiogroup" aria-label="Workspace" className="mr-1 hidden h-7 items-center rounded-md bg-subtle p-0.5 ring-1 ring-inset ring-line md:inline-flex">
      {(['live', 'demo'] as const).map((w) => {
        const on = workspace === w;
        return (
          <Tip key={w} content={w === 'live' ? 'Real records. Starts empty; filled by imports, sync and staff.' : 'Fictional dataset for training and presentations.'}>
            <button
              role="radio"
              aria-checked={on}
              onClick={() => !on && setWorkspace(w)}
              className={cn('relative flex h-6 items-center gap-1.5 rounded-[4px] px-2 text-[12px] font-medium transition-colors duration-fast',
                on ? (w === 'demo' ? 'text-demo' : 'text-ink') : 'text-ink-3 hover:text-ink')}
            >
              {on && <motion.span layoutId="ws-switch" transition={t.layout} className={cn('absolute inset-0 rounded-[4px] shadow-sm ring-1', w === 'demo' ? 'bg-demo-soft ring-demo/35' : 'bg-surface ring-line')} />}
              <span className={cn('relative h-1.5 w-1.5 rounded-full', w === 'live' ? 'bg-good' : 'bg-demo')} />
              <span className="relative">{w === 'live' ? 'Live' : 'Demo'}</span>
            </button>
          </Tip>
        );
      })}
    </div>
  );
}

function PresentationControls() {
  const presentation = useStore((s) => s.presentation);
  const isDemo = useStore((s) => s.workspace === 'demo');
  const setGuide = useUI((s) => s.setGuide);
  const setFeedback = useUI((s) => s.setFeedback);
  if (presentation && isDemo) return <Button variant="secondary" size="sm" icon={<MonitorPlay className="h-3.5 w-3.5" />} onClick={() => setGuide(true)}>Demo script</Button>;
  if (presentation) return null;
  return (
    <Tip content="Capture stakeholder feedback about this screen">
      <Button variant="ghost" size="icon" aria-label="Capture feedback" onClick={() => setFeedback(true)}><MessageSquarePlus className="h-[17px] w-[17px]" /></Button>
    </Tip>
  );
}

function Notifications() {
  const db = useDb();
  const userId = useStore((s) => s.userId);
  const navigate = useNavigate();
  const mine = Object.values(db.notifications).filter((n) => n.userId === userId).sort((a, b) => b.at.localeCompare(a.at));
  const unread = mine.filter((n) => !n.read);
  return (
    <Popover
      className="w-[min(380px,calc(100vw-24px))]"
      trigger={
        <Button variant="ghost" size="icon" aria-label={`Notifications (${unread.length} unread)`} className="relative">
          <Bell className="h-[17px] w-[17px]" />
          {unread.length > 0 && <span className="absolute right-1 top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-accent px-1 font-mono text-[9.5px] font-semibold text-accent-on ring-2 ring-surface">{unread.length}</span>}
        </Button>
      }
    >
      <div className="flex items-center justify-between border-b border-line px-4 h-10">
        <div className="text-[13px] font-semibold">Notifications</div>
        {unread.length > 0 && <Button variant="link" className="text-xs" onClick={() => markNotificationsRead(unread.map((n) => n.id))}>Mark all read</Button>}
      </div>
      <div className="max-h-[400px] overflow-y-auto scroll-thin p-1">
        {mine.length === 0 && <p className="px-3 py-8 text-center text-sm text-ink-3">You’re all caught up.</p>}
        {mine.map((n) => (
          <button
            key={n.id}
            onClick={() => { markNotificationsRead([n.id]); navigate(n.href); }}
            className="flex w-full items-start gap-2.5 rounded-md px-3 py-2.5 text-left hover:bg-subtle"
          >
            <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-accent')} />
            <span className="min-w-0 flex-1">
              <span className={cn('block text-sm', n.read ? 'text-ink-2' : 'text-ink font-medium')}>{n.text}</span>
              <span className="meta capitalize">{n.kind.replace('-', ' ')} · {relTime(n.at)}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="border-t border-line px-4 py-2 text-2xs text-ink-3">Internal notifications only. Nothing is sent outside the team.</div>
    </Popover>
  );
}

function UserMenu() {
  const db = useDb();
  const me = useMe();
  const { setUser, presentation, setPresentation, reset, meta, workspace } = useStore();
  const { pref, setPref } = useTheme();
  const setGuide = useUI((s) => s.setGuide);
  const isDemo = workspace === 'demo';
  const canSwitch = isDemo || meta?.authMode === 'dev';
  const themes: { id: ThemePref; label: string; icon: ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun /> }, { id: 'dark', label: 'Dark', icon: <Moon /> }, { id: 'system', label: 'Match system', icon: <Monitor /> },
  ];
  return (
    <Menu trigger={
      <button className="ml-1 flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 hover:bg-subtle" aria-label={`Account menu — ${me.name}`}>
        <Avatar name={me.name} size={26} />
        <span className="hidden xl:block whitespace-nowrap text-left leading-tight">
          <span className="block text-[13px] font-medium text-ink">{me.name}</span>
          <span className="block text-[11px] text-ink-3">{me.title || ROLES.find((r) => r.id === me.role)?.label}</span>
        </span>
      </button>
    }>
      {canSwitch ? (
        <>
          <MenuLabel>{isDemo ? 'Demo persona' : 'Development sign-in'}</MenuLabel>
          {Object.values(db.users).filter((u) => u.active).map((u) => (
            <MenuItem key={u.id} icon={u.id === me.id ? <Check /> : <UserRound />} onSelect={() => setUser(u.id)} hint={ROLES.find((r) => r.id === u.role)?.label}>
              {u.name}
            </MenuItem>
          ))}
        </>
      ) : (
        <MenuLabel>{me.email} · {ROLES.find((r) => r.id === me.role)?.label}</MenuLabel>
      )}
      {(meta?.workspaces.length ?? 0) > 1 && (
        <>
          <MenuSep />
          <MenuItem icon={<FlaskRound />} onSelect={() => useStore.getState().setWorkspace(isDemo ? 'live' : 'demo')} hint={isDemo ? 'real records' : 'fictional'}>{isDemo ? 'Switch to live workspace' : 'Open demo workspace'}</MenuItem>
        </>
      )}
      <MenuSep />
      <MenuLabel>Appearance</MenuLabel>
      {themes.map((th) => <MenuItem key={th.id} icon={th.icon} onSelect={() => setPref(th.id)} hint={pref === th.id ? <Check className="h-3.5 w-3.5 text-accent" /> : undefined}>{th.label}</MenuItem>)}
      {isDemo && (
        <>
          <MenuSep />
          <MenuItem icon={<MonitorPlay />} onSelect={() => { setPresentation(!presentation); if (!presentation) setGuide(true); }}>
            {presentation ? 'Exit presentation mode' : 'Presentation mode'}
          </MenuItem>
          {!presentation && (
            <MenuItem icon={<RotateCcw />} danger onSelect={async () => {
              if (await confirmAction({ title: 'Reset demo data?', body: 'This restores the original demo dataset. Only the demo workspace is affected — live data is untouched.', confirmLabel: 'Reset demo data', tone: 'danger' })) reset();
            }}>Reset demo data</MenuItem>
          )}
        </>
      )}
      <MenuSep />
      {meta?.authMode === 'header'
        ? <MenuItem icon={<LogOut />} onSelect={() => { window.location.href = '/oauth2/sign_out'; }}>Sign out</MenuItem>
        : <MenuItem icon={<LogOut />} disabled>Sign-out handled by SSO in production</MenuItem>}
    </Menu>
  );
}

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

function useMedia(q: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}
