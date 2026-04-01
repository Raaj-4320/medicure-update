import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { LocationProvider } from './LocationContext';
import { ensureSeedData } from './utils/ensureSeedData';

// Layouts
import MainLayout from './components/layout/MainLayout';
import { logUI } from './utils/uiLogger';

// Pages
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Customer Pages
import CustomerDashboard from './pages/customer/CustomerDashboard';
import PharmacyDiscovery from './pages/customer/PharmacyDiscovery';
import PharmacyDetail from './pages/customer/PharmacyDetail';
import CartPage from './pages/customer/CartPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import OrderHistory from './pages/customer/OrderHistory';

// Seller Pages
import SellerDashboard from './pages/seller/SellerDashboard';
import InventoryManagement from './pages/seller/InventoryManagement';
import SellerOrders from './pages/seller/SellerOrders';
import PharmacyProfile from './pages/seller/PharmacyProfile';
import PrescriptionManagement from './pages/seller/PrescriptionManagement';
import SellerCatalog from './pages/seller/SellerCatalog';
import ReturnsReplacements from './pages/seller/ReturnsReplacements';
import SellerAnalytics from './pages/seller/SellerAnalytics';
import SellerNotifications from './pages/seller/SellerNotifications';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import SellerVerification from './pages/admin/SellerVerification';
import MedicineMasterCatalog from './pages/admin/MedicineMasterCatalog';
import SupplyChainAnalytics from './pages/admin/SupplyChainAnalytics';
import LogisticsManagement from './pages/admin/LogisticsManagement';
import ManufacturerManagement from './pages/admin/ManufacturerManagement';
import ComplianceRisk from './pages/admin/ComplianceRisk';
import SafetyControl from './pages/admin/SafetyControl';
import Financials from './pages/admin/Financials';
import PrescriptionVerification from './pages/admin/PrescriptionVerification';

// Delivery Pages
import DeliveryLayout from './components/layout/DeliveryLayout';
import DeliveryDashboard from './pages/delivery/DeliveryDashboard';
import AvailableOrders from './pages/delivery/AvailableOrders';
import MyDeliveries from './pages/delivery/MyDeliveries';
import Earnings from './pages/delivery/Earnings';
import Wallet from './pages/delivery/Wallet';
import DeliveryNotifications from './pages/delivery/DeliveryNotifications';
import DeliveryProfile from './pages/delivery/DeliveryProfile';
import DeliverySupport from './pages/delivery/DeliverySupport';

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}> = ({ children, allowedRoles, redirectTo }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  // ❌ Not logged in → redirect based on route
  if (!user) {
    return <Navigate to={redirectTo || "/login"} />;
  }

  // ❌ Role mismatch
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};



const AppRoutes = () => {
  const { profile } = useAuth();
  useLocation();
  const [hasFatalRouteError, setHasFatalRouteError] = React.useState(false);

  useEffect(() => {
    ensureSeedData();
  }, []);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (!event.message) return;
      setHasFatalRouteError(true);
      logUI('ROUTE_CRASH', {
        component: 'AppRoutes',
        action: 'Unhandled runtime error',
        expected: 'route should render without crash',
        success: false,
        reason: event.message,
      });
    };
    window.addEventListener('error', onError);
    return () => window.removeEventListener('error', onError);
  }, []);

  if (hasFatalRouteError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white border border-red-200 rounded-2xl p-8 text-center max-w-md">
          <h2 className="text-lg font-bold text-slate-900 mb-2">This section hit an unexpected error.</h2>
          <p className="text-slate-600 mb-4">Please refresh or go back.</p>
          <button onClick={() => { setHasFatalRouteError(false); window.location.reload(); }} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold">
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const getDashboardRedirect = () => {
    if (!profile) return <LandingPage />;
    switch (profile.role) {
      case 'admin': return <Navigate to="/admin" />;
      case 'seller': return <Navigate to="/seller" />;
      case 'customer': return <Navigate to="/dashboard" />;
      case 'delivery': return <Navigate to="/delivery" />;
      case 'pharmacist': return <Navigate to="/pharmacist" />;
      default: return <LandingPage />;
    }
  };

  return (
    <Routes>
      <Route path="/" element={getDashboardRedirect()} />
      <Route path="/login" element={<LoginPage role="customer" />} />
      <Route path="/register" element={<RegisterPage role="customer" />} />

      <Route path="/seller/login" element={<LoginPage role="seller" />} />
      <Route path="/seller/register" element={<RegisterPage role="seller" />} />

      <Route path="/admin/login" element={<LoginPage role="admin" />} />
      <Route path="/delivery/login" element={<LoginPage role="delivery" />} />
      <Route path="/delivery/register" element={<RegisterPage role="delivery" />} />

      {/* Customer Routes */}
      <Route path="/" element={<ProtectedRoute allowedRoles={['customer']}><MainLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<CustomerDashboard />} />
        <Route path="discover" element={<PharmacyDiscovery />} />
        <Route path="pharmacy/:id" element={<PharmacyDetail />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="orders" element={<OrderHistory />} />
      </Route>

      {/* Seller Routes */}
      <Route
  path="/seller"
  element={
    <ProtectedRoute allowedRoles={['seller']} redirectTo="/seller/login">
      <MainLayout />
    </ProtectedRoute>
  }
>
        <Route index element={<SellerDashboard />} />
        <Route path="inventory" element={<InventoryManagement />} />
        <Route path="orders" element={<SellerOrders />} />
        <Route path="profile" element={<PharmacyProfile />} />
        <Route path="prescriptions" element={<PrescriptionManagement />} />
        <Route path="catalog" element={<SellerCatalog />} />
        <Route path="returns" element={<ReturnsReplacements />} />
        <Route path="analytics" element={<SellerAnalytics />} />
        <Route path="notifications" element={<SellerNotifications />} />
      </Route>

      {/* Admin Routes */}
      <Route
  path="/admin"
  element={
    <ProtectedRoute allowedRoles={['admin']} redirectTo="/admin/login">
      <MainLayout />
    </ProtectedRoute>
  }
>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="verifications" element={<SellerVerification />} />
        <Route path="catalog" element={<MedicineMasterCatalog />} />
        <Route path="analytics" element={<SupplyChainAnalytics />} />
        <Route path="logistics" element={<LogisticsManagement />} />
        <Route path="manufacturers" element={<ManufacturerManagement />} />
        <Route path="compliance" element={<ComplianceRisk />} />
        <Route path="safety" element={<SafetyControl />} />
        <Route path="financials" element={<Financials />} />
        <Route path="prescriptions" element={<PrescriptionVerification />} />
      </Route>

      {/* Delivery Routes */}
      <Route
  path="/delivery"
  element={
    <ProtectedRoute allowedRoles={['delivery']} redirectTo="/delivery/login">
      <DeliveryLayout />
    </ProtectedRoute>
  }
>
        <Route index element={<DeliveryDashboard />} />
        <Route path="available" element={<AvailableOrders />} />
        <Route path="my-deliveries" element={<MyDeliveries />} />
        <Route path="earnings" element={<Earnings />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="notifications" element={<DeliveryNotifications />} />
        <Route path="profile" element={<DeliveryProfile />} />
        <Route path="support" element={<DeliverySupport />} />
      </Route>
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <Router>
          <AppRoutes />
        </Router>
      </LocationProvider>
    </AuthProvider>
  );
}
