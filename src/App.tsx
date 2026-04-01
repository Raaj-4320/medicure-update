import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { LocationProvider } from './LocationContext';
import { ensureSeedData } from './utils/ensureSeedData';
import { appLogger } from './utils/observability';
import { AppErrorBoundary } from './components/AppErrorBoundary';

// Layouts
import MainLayout from './components/layout/MainLayout';

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
import SellerCatalog from './pages/seller/SellerCatalog';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import SellerVerification from './pages/admin/SellerVerification';
import MedicineMasterCatalog from './pages/admin/MedicineMasterCatalog';
import LogisticsManagement from './pages/admin/LogisticsManagement';
import ManufacturerManagement from './pages/admin/ManufacturerManagement';

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
  const location = useLocation();

  useEffect(() => {
    ensureSeedData();
  }, []);

  useEffect(() => {
    appLogger.log({
      category: 'PAGE_LOAD_ROUTE',
      event: 'route_changed',
      status: 'success',
      page: 'AppRoutes',
      route: location.pathname,
      scope: 'router',
      message: 'Route rendered.',
      meta: { role: profile?.role || 'guest' },
    });
  }, [location.pathname, profile?.role]);

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
        <Route path="checkout" element={<AppErrorBoundary page="CheckoutPage"><CheckoutPage /></AppErrorBoundary>} />
        <Route path="orders" element={<AppErrorBoundary page="OrderHistory"><OrderHistory /></AppErrorBoundary>} />
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
        <Route path="inventory" element={<AppErrorBoundary page="InventoryManagement"><InventoryManagement /></AppErrorBoundary>} />
        <Route path="orders" element={<AppErrorBoundary page="SellerOrders"><SellerOrders /></AppErrorBoundary>} />
        <Route path="profile" element={<PharmacyProfile />} />
        <Route path="catalog" element={<AppErrorBoundary page="SellerCatalog"><SellerCatalog /></AppErrorBoundary>} />
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
        <Route index element={<AppErrorBoundary page="AdminDashboard"><AdminDashboard /></AppErrorBoundary>} />
        <Route path="users" element={<UserManagement />} />
        <Route path="verifications" element={<SellerVerification />} />
        <Route path="catalog" element={<AppErrorBoundary page="MedicineMasterCatalog"><MedicineMasterCatalog /></AppErrorBoundary>} />
        <Route path="logistics" element={<LogisticsManagement />} />
        <Route path="manufacturers" element={<ManufacturerManagement />} />
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
