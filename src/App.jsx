import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Quotes from './pages/Quotes';
import QuoteEditor from './pages/QuoteEditor';
import ModelPricing from './pages/ModelPricing';
import CompanyHeaders from './pages/CompanyHeaders';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import PlatformAdminGuard from '@/lib/PlatformAdminGuard';
import PlatformAdminLayout from './pages/admin/PlatformAdminLayout';
import PlatformTenantList from './pages/admin/PlatformTenantList';
import PlatformTenantDetail from './pages/admin/PlatformTenantDetail';
import PlatformTenantCreate from './pages/admin/PlatformTenantCreate';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  // Show loading spinner while checking auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Unauthenticated: only /login is reachable, everything else redirects there
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/Quotes" element={<LayoutWrapper currentPageName="Quotes"><Quotes /></LayoutWrapper>} />
      <Route path="/QuoteEditor" element={<LayoutWrapper currentPageName="QuoteEditor"><QuoteEditor /></LayoutWrapper>} />
      <Route path="/ModelPricing" element={<LayoutWrapper currentPageName="ModelPricing"><ModelPricing /></LayoutWrapper>} />
      <Route path="/CompanyHeaders" element={<LayoutWrapper currentPageName="CompanyHeaders"><CompanyHeaders /></LayoutWrapper>} />
      <Route path="/Profile" element={<LayoutWrapper currentPageName="Profile"><Profile /></LayoutWrapper>} />
      <Route path="/admin/tenants" element={
        <PlatformAdminGuard>
          <PlatformAdminLayout><PlatformTenantList /></PlatformAdminLayout>
        </PlatformAdminGuard>
      } />
      <Route path="/admin/tenants/new" element={
        <PlatformAdminGuard>
          <PlatformAdminLayout><PlatformTenantCreate /></PlatformAdminLayout>
        </PlatformAdminGuard>
      } />
      <Route path="/admin/tenants/:tenantId" element={
        <PlatformAdminGuard>
          <PlatformAdminLayout><PlatformTenantDetail /></PlatformAdminLayout>
        </PlatformAdminGuard>
      } />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App