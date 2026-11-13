import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { useTheme } from './lib/theme';
import { useStore } from './lib/store';
import { AppShell } from './components/layout/AppShell';
import { AskHost, TipProvider } from './components/ui/overlays';
import { BrandMark } from './components/layout/Brand';
import { Button } from './components/ui/Button';
import { Skeleton, EmptyState } from './components/ui/primitives';
import { CommandCenter } from './pages/CommandCenter';
import { MatchStudio } from './pages/match/MatchStudio';
import { FacultyExplorer } from './pages/faculty/FacultyExplorer';
import { FacultyProfile } from './pages/faculty/FacultyProfile';
import { CompaniesPage } from './pages/companies/CompaniesPage';
import { CompanyProfile } from './pages/companies/CompanyProfile';
import { PipelinePage } from './pages/pipeline/PipelinePage';
import { OpportunityPage } from './pages/pipeline/OpportunityPage';
import { BriefPage } from './pages/pipeline/BriefPage';
import { ReviewQueue } from './pages/review/ReviewQueue';
import { IPPage } from './pages/IPPage';
import { SignalsPage } from './pages/SignalsPage';
import { DataHealthPage } from './pages/DataHealthPage';
import { ProcessPage } from './pages/ProcessPage';
// Heavier, less-visited screens load on demand (Recharts lives only in Analytics).
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const AdminPage = lazy(() => import('./pages/admin/AdminPage').then((m) => ({ default: m.AdminPage })));
const IanMatchmakingDemo = lazy(() => import('./pages/IanMatchmakingDemo').then((m) => ({ default: m.IanMatchmakingDemo })));
import { BootstrapScreen, ErrorBoundary, NoAccessScreen } from './components/layout/AuthScreens';

export function App() {
  const { status, load, error } = useStore();
  const theme = useTheme((s) => s.resolved);
  useEffect(() => { load(); }, [load]);

  return (
    <MotionConfig reducedMotion="user">
    <TipProvider>
      <BrowserRouter>
        {status === 'loading' && <BootSkeleton />}
        {status === 'error' && (
          <div className="flex h-screen items-center justify-center">
            <EmptyState icon={<AlertTriangle />} title="The app couldn’t load its data" action={<Button variant="primary" onClick={load}>Try again</Button>}>
              {error}. Make sure the dev server is running (<code>npm run dev</code>).
            </EmptyState>
          </div>
        )}
        {status === 'bootstrap' && <BootstrapScreen />}
        {(status === 'not-signed-in' || status === 'not-provisioned') && <NoAccessScreen reason={status} />}
        {status === 'ready' && (
          <ErrorBoundary>
          <Suspense fallback={<div className="p-8"><Skeleton className="h-6 w-56" /><Skeleton className="mt-4 h-64" /></div>}>
          <Routes>
            <Route path="/opportunities/:id/brief" element={<BriefPage />} />
            <Route element={<AppShell />}>
              <Route index element={<CommandCenter />} />
              <Route path="match/:searchId?" element={<MatchStudio />} />
              <Route path="matchmaking-demo" element={<IanMatchmakingDemo />} />
              <Route path="faculty" element={<FacultyExplorer />} />
              <Route path="faculty/:id" element={<FacultyProfile />} />
              <Route path="companies" element={<CompaniesPage />} />
              <Route path="companies/:id" element={<CompanyProfile />} />
              <Route path="opportunities" element={<PipelinePage />} />
              <Route path="opportunities/:id" element={<OpportunityPage />} />
              <Route path="review" element={<ReviewQueue />} />
              <Route path="ip" element={<IPPage />} />
              <Route path="signals" element={<SignalsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="data" element={<DataHealthPage />} />
              <Route path="process" element={<ProcessPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="*" element={<EmptyState className="mt-24" title="Page not found" action={<Link to="/" className="link text-sm">Back to Command Center</Link>}>This address doesn’t match a page in Research Partnerships.</EmptyState>} />
            </Route>
          </Routes>
          </Suspense>
          </ErrorBoundary>
        )}
        <AskHost />
        <Toaster position="bottom-right" theme={theme} gap={8} toastOptions={{ className: 'font-sans !text-[13px] !rounded-md !border-line !bg-raised !text-ink !shadow-lg' }} />
      </BrowserRouter>
    </TipProvider>
    </MotionConfig>
  );
}

function BootSkeleton() {
  return (
    <div className="flex h-screen bg-canvas" aria-busy="true" aria-label="Loading workspace">
      <div className="hidden w-[236px] shrink-0 flex-col bg-rail p-3 md:flex">
        <div className="flex h-9 items-center gap-2.5 px-1"><BrandMark size={26} onDark /><div className="h-3 w-28 rounded bg-white/10" /></div>
        <div className="mt-6 space-y-2 px-1">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-6 rounded bg-white/[0.06]" style={{ width: `${70 + ((i * 37) % 30)}%` }} />)}</div>
      </div>
      <div className="flex-1">
        <div className="h-12 border-b border-line bg-surface" />
        <div className="space-y-4 p-8">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-[420px] max-w-full" />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-none" />)}</div>
          <Skeleton className="h-72" />
        </div>
      </div>
    </div>
  );
}
