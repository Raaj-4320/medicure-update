import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Store, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Database,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  DollarSign,
  Truck,
  FileText,
  Activity
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { api } from '../../services/api';
import { Link } from 'react-router-dom';
import { logError } from '../../utils/flowLogger';

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
  const [chartReady, setChartReady] = useState(false);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    setChartReady(true);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
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
        setRecentOrders(
          [...orders]
            .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, 8),
        );
      } catch (error) {
        console.error('Failed to fetch admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const salesData = [
    { name: 'Mon', sales: 4000, revenue: 45000 },
    { name: 'Tue', sales: 3000, revenue: 52000 },
    { name: 'Wed', sales: 2000, revenue: 48000 },
    { name: 'Thu', sales: 2780, revenue: 61000 },
    { name: 'Fri', sales: 1890, revenue: 55000 },
    { name: 'Sat', sales: 2390, revenue: 67000 },
    { name: 'Sun', sales: 3490, revenue: 72000 },
  ];

  const categoryData = [
    { name: 'Analgesics', value: 400 },
    { name: 'Antibiotics', value: 300 },
    { name: 'Cardio', value: 300 },
    { name: 'Respiratory', value: 200 },
  ];

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  const MOCK_AUDIT_LOGS = [
    { id: '1', adminName: 'Raj Golakiya', action: 'Verified Pharmacy', targetType: 'Pharmacy', targetId: 'PH001', timestamp: new Date().toISOString() },
    { id: '2', adminName: 'System', action: 'Flagged Order', targetType: 'Order', targetId: 'ORD005', timestamp: new Date().toISOString() },
  ];

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
            <div className="p-2 bg-red-50 text-red-600 rounded-lg"><ShieldAlert className="w-6 h-6" /></div>
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">Critical</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Fraud Alerts</p>
          <h3 className="text-2xl font-bold text-slate-900">{stats.fraudAlerts}</h3>
        </div>
      </div>


      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Recent Orders Monitoring</h3>
          <span className="text-xs text-slate-500">Live from Firestore orders</span>
        </div>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-slate-500">No recent orders to monitor yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs uppercase text-slate-500 border-b border-slate-100">
                  <th className="py-2 font-semibold">Order</th>
                  <th className="py-2 font-semibold">Pharmacy</th>
                  <th className="py-2 font-semibold">Customer</th>
                  <th className="py-2 font-semibold">Payment</th>
                  <th className="py-2 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="text-sm">
                    <td className="py-2 font-semibold text-slate-900">#{order.id}</td>
                    <td className="py-2 text-slate-600">{order.pharmacyId || '-'}</td>
                    <td className="py-2 text-slate-600">{order.customerId || '-'}</td>
                    <td className="py-2 text-slate-600">
                      {(order.paymentStatus || 'pending').toUpperCase()}
                      {order.paymentMethod ? ` • ${String(order.paymentMethod).replace('_', ' ').toUpperCase()}` : ''}
                    </td>
                    <td className="py-2">
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold uppercase">
                        {String(order.status || 'pending').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 text-slate-500">
                      {order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Module Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { name: 'Compliance', path: '/admin/compliance', icon: ShieldCheck, color: 'bg-blue-50 text-blue-600' },
          { name: 'Safety', path: '/admin/safety', icon: ShieldAlert, color: 'bg-red-50 text-red-600' },
          { name: 'Financials', path: '/admin/financials', icon: DollarSign, color: 'bg-emerald-50 text-emerald-600' },
          { name: 'Logistics', path: '/admin/logistics', icon: Truck, color: 'bg-orange-50 text-orange-600' },
          { name: 'Prescriptions', path: '/admin/prescriptions', icon: FileText, color: 'bg-purple-50 text-purple-600' }
        ].map((module) => (
          <Link 
            key={module.name} 
            to={module.path}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all group"
          >
            <div className={`w-10 h-10 ${module.color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
              <module.icon className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">{module.name}</h4>
            <p className="text-[10px] text-slate-500">Manage module settings</p>
          </Link>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900">Revenue Trend</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                Revenue
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-slate-400">
                <div className="w-2 h-2 bg-slate-300 rounded-full" />
                Sales
              </div>
            </div>
          </div>
          <div className="h-[300px]">
            {!chartReady || salesData.length === 0 ? (
              (() => {
                logError('CHART', {
                  type: 'UI',
                  detail: !chartReady ? 'Revenue chart skipped: invalid dimensions' : 'Revenue chart skipped: no data',
                });
                return <div className="h-full flex items-center justify-center text-slate-500 text-sm">No chart data available.</div>;
              })()
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Medicine Categories</h3>
          <div className="h-[300px]">
            {!chartReady || categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">No chart data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {categoryData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index]}}></div>
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Recent Audit Logs</h3>
          <Link to="/admin/compliance" className="text-emerald-600 text-sm font-semibold hover:underline">View All Logs</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Admin</th>
                <th className="px-6 py-4 font-semibold">Action</th>
                <th className="px-6 py-4 font-semibold">Target</th>
                <th className="px-6 py-4 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MOCK_AUDIT_LOGS.slice(0, 5).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {log.adminName.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-slate-900">{log.adminName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{log.action}</td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-500">{log.targetType}: {log.targetId}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
