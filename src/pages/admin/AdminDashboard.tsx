import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Store, 
  Clock,
  Loader2,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { api } from '../../services/api';
import { Link } from 'react-router-dom';
import { appLogger } from '../../utils/observability';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalPharmacies: 0,
    totalMedicines: 0,
    totalOrders: 0,
    pendingVerifications: 0,
    expiringSoon: 0,
    fraudAlerts: 0,
    pendingPrescriptions: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    appLogger.log({
      category: 'PAGE_LOAD_ROUTE',
      event: 'admin_dashboard_load_started',
      status: 'start',
      page: 'AdminDashboard',
      route: '/admin',
      message: 'Admin dashboard mounted.',
    });
    const fetchStats = async () => {
      try {
        appLogger.log({
          category: 'ORDER_FLOW',
          event: 'admin_orders_aggregate_query_started',
          status: 'start',
          page: 'AdminDashboard',
          message: 'Admin aggregate/list query started.',
        });
        const [users, pharmacies, medicines, orders] = await Promise.all([
          api.getUsers(),
          api.getPharmacies(),
          api.getMedicines(),
          api.getOrders(),
        ]);

        setStats({
          totalUsers: users.length,
          totalPharmacies: pharmacies.length,
          totalMedicines: medicines.length,
          totalOrders: orders.length,
          pendingVerifications: pharmacies.filter((p: any) => p.verificationStatus === 'pending').length,
          expiringSoon: 0,
          fraudAlerts: 0,
          pendingPrescriptions: orders.filter((o: any) => o.prescriptionUrl).length
        });
        appLogger.log({
          category: 'FIREBASE_QUERY',
          event: 'admin_orders_aggregate_query_success',
          status: 'success',
          page: 'AdminDashboard',
          message: 'Admin aggregate/list query succeeded.',
          meta: { orderCount: orders.length, userCount: users.length, pharmacyCount: pharmacies.length },
        });
        if (orders.length === 0 && pharmacies.length > 0) {
          appLogger.log({
            category: 'SYSTEM_WARNING',
            event: 'admin_metrics_without_order_visibility',
            status: 'warning',
            page: 'AdminDashboard',
            message: 'Admin has platform metrics but no visible orders.',
            meta: { pharmacies: pharmacies.length, users: users.length },
          });
        }
      } catch (error) {
        appLogger.log({
          category: 'FIREBASE_QUERY',
          event: 'admin_orders_aggregate_query_failure',
          status: 'failure',
          page: 'AdminDashboard',
          message: 'Admin aggregate/list query failed.',
          error: appLogger.errorSummary(error),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Command Center</h1>
          <p className="text-slate-500 text-sm">System-wide overview and governance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600">
            <Clock className="w-4 h-4" />
            Last Sync: Just now
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-100">
            <Activity className="w-4 h-4" />
            System Health: 99.9%
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users className="w-6 h-6" /></div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+12%</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Total Users</p>
          <h3 className="text-2xl font-bold text-slate-900">{stats.totalUsers}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Store className="w-6 h-6" /></div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+5%</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Verified Pharmacies</p>
          <h3 className="text-2xl font-bold text-slate-900">{stats.totalPharmacies}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><ShieldCheck className="w-6 h-6" /></div>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Action Required</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Pending Verifications</p>
          <h3 className="text-2xl font-bold text-slate-900">{stats.pendingVerifications}</h3>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Activity className="w-6 h-6" /></div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">Live</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Total Orders</p>
          <h3 className="text-2xl font-bold text-slate-900">{stats.totalOrders}</h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-2">Core Admin Actions</h3>
        <p className="text-sm text-slate-600 mb-4">Use the sidebar to verify sellers and manage medicine catalog for the demo flow.</p>
        <div className="flex gap-3">
          <Link to="/admin/verifications" className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold">Open Verifications</Link>
          <Link to="/admin/catalog" className="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-sm font-semibold">Open Catalog</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
