import { lazy, Suspense, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { MockSchemesProvider } from '@/components/mock-schemes-toggle';
import { PageAccentSync } from '@/components/page-color-picker';
import { useTranslation } from 'react-i18next';

const CentralData      = lazy(() => import('@/pages/central-data'));
const StateFacts       = lazy(() => import('@/pages/state-facts'));
const Rankings         = lazy(() => import('@/pages/rankings'));
const Reports          = lazy(() => import('@/pages/reports'));
const Schemes          = lazy(() => import('@/pages/schemes'));
const SchemeDetail     = lazy(() => import('@/pages/scheme-detail'));
const DevelopmentIndex = lazy(() => import('@/pages/development-index'));
const Funding          = lazy(() => import('@/pages/funding'));
const MinisterProfile  = lazy(() => import('@/pages/minister-profile'));
const About            = lazy(() => import('@/pages/about'));
const TermsOfUse       = lazy(() => import('@/pages/terms'));
const Disclaimer       = lazy(() => import('@/pages/disclaimer'));
const ReportIssue      = lazy(() => import('@/pages/report-issue'));
const AdminIssues      = lazy(() => import('@/pages/admin-issues'));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/minister/:slug" component={MinisterProfile} />
        <Route path="/" component={CentralData} />
        <Route path="/schemes" component={Schemes} />
        <Route path="/central-schemes" component={Schemes} />
        <Route path="/schemes/:slug" component={SchemeDetail} />
        <Route path="/development-index" component={DevelopmentIndex} />
        <Route path="/reports" component={Reports} />
        <Route path="/state-facts" component={StateFacts} />
        <Route path="/rankings" component={Rankings} />
        <Route path="/central-data" component={CentralData} />
        <Route path="/funding" component={Funding} />
        <Route path="/about" component={About} />
        <Route path="/terms" component={TermsOfUse} />
        <Route path="/disclaimer" component={Disclaimer} />
        <Route path="/report-issue" component={ReportIssue} />
        <Route path="/admin/issues" component={AdminIssues} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function HtmlLangSync() {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <MockSchemesProvider>
            <HtmlLangSync />
            <PageAccentSync />
            <Header />
            <main id="main-content" tabIndex={-1} className="min-w-0 outline-none">
              <Router />
            </main>
            <Footer />
          </MockSchemesProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
