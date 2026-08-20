import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { DataProvider } from '@/state/DataProvider';
import { applyColorScheme, useThemeStore } from '@/store/themeStore';

const LandingPage = lazy(() => import('@/modules/landing/LandingPage'));
const HomePage = lazy(() => import('@/modules/home/HomePage'));
const StateSummaryPage = lazy(() => import('@/modules/stateSummary/StateSummaryPage'));
const AssessmentStatesPage = lazy(
  () => import('@/modules/assessmentStates/AssessmentStatesPage'),
);
const FacilityScorecardPage = lazy(
  () => import('@/modules/facility/FacilityScorecardPage'),
);
const InvestmentPlanPage = lazy(
  () => import('@/modules/investment/InvestmentPlanPage'),
);
const ExplorerPage = lazy(() => import('@/modules/explorer/ExplorerPage'));
const ReportBuilderPage = lazy(() => import('@/modules/reports/ReportBuilderPage'));

function page(node: React.ReactNode) {
  return <Suspense fallback={<PageSkeleton />}>{node}</Suspense>;
}

export default function App() {
  const scheme = useThemeStore((s) => s.scheme);

  useEffect(() => {
    applyColorScheme(scheme);
  }, [scheme]);

  return (
    <ErrorBoundary>
      {/* DataProvider sits *inside* the router, not above it: it route-scopes
          the explorer cube (see the note there) and so has to be able to read
          the current location. */}
      <BrowserRouter>
        <DataProvider>
          <Routes>
            {/*
              The landing page is deliberately outside AppShell: it is the front
              door, with no navigation rail, no filter bar and no data of its own.
              Everything past it lives under the shell, and `/dashboard` — the
              module launcher that used to be the index route — is the hinge
              between the two. Both directions are one click: the hero CTA in,
              the sidebar wordmark out.
            */}
            <Route path="/" element={page(<LandingPage />)} />
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={page(<HomePage />)} />
              <Route path="/states" element={page(<StateSummaryPage />)} />
              <Route path="/states/:stateId" element={page(<StateSummaryPage />)} />
              <Route path="/assessment" element={page(<AssessmentStatesPage />)} />
              <Route
                path="/assessment/:stateId"
                element={page(<AssessmentStatesPage />)}
              />
              <Route
                path="/assessment/:stateId/:lgaId"
                element={page(<AssessmentStatesPage />)}
              />
              <Route path="/facilities" element={page(<FacilityScorecardPage />)} />
              <Route path="/facilities/:uuid" element={page(<FacilityScorecardPage />)} />
              <Route path="/investment" element={page(<InvestmentPlanPage />)} />
              <Route path="/explore" element={page(<ExplorerPage />)} />
              <Route path="/reports" element={page(<ReportBuilderPage />)} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </DataProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
