import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';
import { PublicLayout } from './components/layout/PublicLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { RequireAdmin, RequireAuth } from './components/layout/Guards';
import { FullPageLoader } from './components/ui/States';
import { LogoMark } from './components/ui/Logo';
import { Toaster } from './components/ui/Toast';
import { AgeGate } from './components/AgeGate';
import HomePage from './pages/HomePage';
import ContentPage from './pages/ContentPage';
import NotFoundPage from './pages/NotFoundPage';
import ExitPage from './pages/ExitPage';

// Secondary public pages are split out to keep the first load small.
const SearchPage = lazy(() => import('./pages/SearchPage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const LikedPage = lazy(() => import('./pages/LikedPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const InfoPage = lazy(() => import('./pages/InfoPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const LoginPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/AuthPages').then((m) => ({ default: m.SignupPage })));

// Admin code is split out so public visitors never download it.
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const UploadPage = lazy(() => import('./pages/admin/UploadPage'));
const ManageContentPage = lazy(() => import('./pages/admin/ManageContentPage'));
const EditContentPage = lazy(() => import('./pages/admin/EditContentPage'));
const TagsPage = lazy(() => import('./pages/admin/TagsPage'));
const AdsPage = lazy(() => import('./pages/admin/AdsPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const RemovalRequestsPage = lazy(() => import('./pages/admin/RemovalRequestsPage'));
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage'));

function SetupRequired() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <LogoMark className="h-14 w-14" />
      <h1 className="text-3xl font-extrabold">OnlyFap needs Supabase</h1>
      <p className="text-sm text-muted">
        Copy <code>.env.example</code> to <code>.env</code>, fill in <code>VITE_SUPABASE_URL</code> and{' '}
        <code>VITE_SUPABASE_ANON_KEY</code>, then restart the dev server. On Cloudflare Pages, add them as environment variables and redeploy.
      </p>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupRequired />;
  return (
    <AuthProvider>
      <BrowserRouter>
        <AgeGate>
          <Suspense fallback={<FullPageLoader />}>
            <Routes>
              <Route path="exit" element={<ExitPage />} />
              <Route element={<PublicLayout />}>
                <Route index element={<HomePage />} />
                <Route path="feed" element={<FeedPage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="content/:id" element={<ContentPage />} />
                <Route path="liked" element={<LikedPage />} />
                <Route path="report" element={<ReportPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="signup" element={<SignupPage />} />
                <Route path="account" element={<RequireAuth><AccountPage /></RequireAuth>} />
                <Route path="about" element={<InfoPage />} />
                <Route path="legal/:slug" element={<LegalPage />} />
                {/* old URLs from the previous build */}
                <Route path="terms" element={<Navigate to="/legal/terms" replace />} />
                <Route path="privacy" element={<Navigate to="/legal/privacy" replace />} />
                <Route path="contact" element={<Navigate to="/legal/contact" replace />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
              <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
                <Route index element={<DashboardPage />} />
                <Route path="upload" element={<UploadPage />} />
                <Route path="content" element={<ManageContentPage />} />
                <Route path="content/:id/edit" element={<EditContentPage />} />
                <Route path="tags" element={<TagsPage />} />
                <Route path="ads" element={<AdsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="removal-requests" element={<RemovalRequestsPage />} />
                <Route path="removal-requests/:id" element={<RemovalRequestsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </Suspense>
        </AgeGate>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  );
}
