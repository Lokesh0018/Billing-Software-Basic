import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoadingBlock } from './components/ui';
import { useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { LoginPage } from './features/auth/LoginPage';
import { BillingPage } from './features/billing/BillingPage';
import { BillHistoryPage } from './features/history/BillHistoryPage';
import { ProductsPage } from './features/products/ProductsPage';
import { SettingsPage } from './features/settings/SettingsPage';

// Chart pages pull in Recharts; load them on demand so the billing screen starts fast.
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ReportsPage = lazy(() => import('./features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const page = (el: React.ReactNode) => <Suspense fallback={<LoadingBlock />}>{el}</Suspense>;

function ProtectedArea() {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return <LoadingBlock label="Checking session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return (
    <SettingsProvider>
      <Layout />
    </SettingsProvider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedArea />}>
        <Route index element={page(<DashboardPage />)} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="bills" element={<BillHistoryPage />} />
        <Route path="reports" element={page(<ReportsPage />)} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
