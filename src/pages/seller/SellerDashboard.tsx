import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ClipboardList, 
  TrendingUp, 
  AlertTriangle, 
  Clock,
  CheckCircle,
  ArrowUpRight,
  Loader2,
  Plus,
  RefreshCw,
  FileText,
  ShieldCheck,
  Bell,
  ChevronRight,
  Activity,
  Calendar,
  DollarSign
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { useAuth } from '../../AuthContext';
import { Order, Prescription, Notification } from '../../types';
import { api, getPharmacyCompletenessSnapshot, isPharmacyProfileComplete } from '../../services/api';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { checkExpectations, logFlow } from '../../utils/flowLogger';
import { logUI } from '../../utils/uiLogger';
import { logDataFlow } from '../../utils/dataLogger';

const SellerDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    todayOrders: 0,
    pendingPrescriptions: 0,
    lowStock: 0,
    outForDelivery: 0,
    monthlyRevenue: 0,
    settlementDue: 0
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [pendingPrescriptions, setPendingPrescriptions] = useState<Prescription[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPharmacy, setHasPharmacy] = useState(true);
  const [pharmacyStatus, setPharmacyStatus] = useState<'pending' | 'verified' | 'rejected'>('pending');
  const [onboardingName, setOnboardingName] = useState('');
  const [onboardingPhone, setOnboardingPhone] = useState('');
  const [onboardingOwnerName, setOnboardingOwnerName] = useState('');
  const [onboardingLicense, setOnboardingLicense] = useState('');
  const [onboardingAddress, setOnboardingAddress] = useState('');
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);
  const [chartData, setChartData] = useState<{ name: string; sales: number }[]>([]);
  const [bestSellers, setBestSellers] = useState<{ name: string; sales: number; color: string }[]>([]);
  const [profileComplete, setProfileComplete] = useState(true);
  const [hasInventoryItems, setHasInventoryItems] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        logFlow('DASHBOARD_LOAD_START', {
          expected: ['pharmacy lookup by ownerId', 'orders/inventory by pharmacyId'],
          received: { ownerId: profile.uid },
          success: true,
        });
        const pharmacies = await api.getPharmacies({ ownerId: profile.uid });
        const myPharmacy = pharmacies[0];
        if (!myPharmacy) {
          logFlow('DASHBOARD_LOAD', {
            expected: ['seller pharmacy exists'],
            received: { userId: profile.uid, hasPharmacy: false },
            success: false,
            error: 'No pharmacy found',
          });
          setHasPharmacy(false);
          setStats({
            todayOrders: 0,
            pendingPrescriptions: 0,
            lowStock: 0,
            outForDelivery: 0,
            monthlyRevenue: 0,
            settlementDue: 0,
          });
          setRecentOrders([]);
          setPendingPrescriptions([]);
          setNotifications([]);
          return;
        }
        setHasPharmacy(true);
        const isComplete = isPharmacyProfileComplete(myPharmacy as any);
        setProfileComplete(isComplete);
        if (!isComplete) {
          const completenessDebug = getPharmacyCompletenessSnapshot(myPharmacy as any);
          console.info('[SELLER_PROFILE_COMPLETENESS_OPTIONAL]', {
            expected: completenessDebug.expected,
            resolved: completenessDebug.resolved,
            missing: completenessDebug.missing,
            actual: myPharmacy,
          });
          logFlow('SELLER_PROFILE_REMINDER', {
            expected: ['name', 'address', 'phone', 'license', 'ownerName'],
            received: { pharmacyId: myPharmacy.id, complete: false, missing: completenessDebug.missing },
            status: 'partial',
            partialType: 'DATA_MISSING',
            suggestion: 'Profile is incomplete. Seller can continue and update details anytime from Profile.',
          });
        }
        setPharmacyStatus((myPharmacy.status || myPharmacy.verificationStatus || 'pending') as 'pending' | 'verified' | 'rejected');

        const [sellerOrders, inventoryByPharmacy, inventoryBySeller, prescriptions, sellerNotifications] = await Promise.all([
          api.getOrders({ pharmacyId: myPharmacy.id }),
          api.getInventory({ pharmacyId: myPharmacy.id }),
          api.getInventory({ sellerId: profile.uid }),
          api.getPrescriptions({ pharmacyId: myPharmacy.id }),
          api.getNotifications({ userId: profile.uid }),
        ]);
        const inventoryMap = new Map<string, any>();
        [...(Array.isArray(inventoryByPharmacy) ? inventoryByPharmacy : []), ...(Array.isArray(inventoryBySeller) ? inventoryBySeller : [])].forEach((item: any) => {
          if (item?.id) inventoryMap.set(item.id, item);
        });
        const inventory = Array.from(inventoryMap.values());
        logFlow('DASHBOARD_LOAD', {
          expected: ['orders', 'inventory', 'prescriptions', 'notifications'],
          received: {
            orders: sellerOrders.length,
            inventory: inventory.length,
            prescriptions: prescriptions.length,
            notifications: sellerNotifications.length,
          },
          success: true,
        });
        checkExpectations({
          page: 'SellerDashboard',
          expected: ['pharmacy', 'orders', 'inventory'],
          result: {
            pharmacy: myPharmacy,
            orders: sellerOrders,
            inventory,
          },
        });
        logDataFlow('SELLER_DASHBOARD', {
          source: 'FIRESTORE',
          requested: ['orders', 'inventory'],
          received: [...sellerOrders, ...inventory],
          rendered: sellerOrders.length > 0 || inventory.length > 0,
          placeholder: sellerOrders.length === 0 && inventory.length === 0,
          userId: profile.uid,
          route: '/seller/dashboard',
          filters: { pharmacyId: myPharmacy.id },
        });
        
        const totalRevenue = sellerOrders.reduce((acc: number, o: any) => acc + o.totalAmount, 0);
        const lowStockCount = inventory.filter((i: any) => Number(i.stock) < 20).length;
        const outForDelivery = sellerOrders.filter((o: any) => ['dispatched', 'on_the_way', 'picked_up'].includes(o.status)).length;
        
        setStats({
          todayOrders: sellerOrders.filter((o: any) => o.createdAt.startsWith(new Date().toISOString().split('T')[0])).length,
          pendingPrescriptions: prescriptions.filter((p: any) => p.status === 'pending').length,
          lowStock: lowStockCount,
          outForDelivery,
          monthlyRevenue: totalRevenue,
          settlementDue: Math.round(totalRevenue * 0.15)
        });

        setRecentOrders(sellerOrders.slice(0, 5));
        setHasInventoryItems(inventory.length > 0);
        if (inventory.length === 0) {
          logFlow('BUSINESS_STATE', {
            expected: ['inventory > 0 for active store'],
            received: { state: 'EMPTY_STORE', pharmacyId: myPharmacy.id },
            status: 'partial',
            partialType: 'DATA_MISSING',
          });
        }
        setPendingPrescriptions(prescriptions.filter((p: any) => p.status === 'pending'));
        setNotifications(sellerNotifications);
        const colorPalette = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
        setBestSellers(
          inventory
            .filter((item: any) => item?.masterData?.brandName)
            .sort((a: any, b: any) => Number(b.stock || 0) - Number(a.stock || 0))
            .slice(0, 4)
            .map((item: any, idx: number) => ({
              name: item.masterData.brandName,
              sales: Number(item.stock || 0),
              color: colorPalette[idx % colorPalette.length],
            })),
        );
        const byDay = new Map<string, number>();
        sellerOrders.forEach((order: any) => {
          const day = new Date(order.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
          byDay.set(day, (byDay.get(day) || 0) + Number(order.totalAmount || 0));
        });
        setChartData(Array.from(byDay.entries()).map(([name, sales]) => ({ name, sales })));
      } catch (error) {
        console.error('Failed to fetch seller data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const handleProfileRefresh = () => fetchData();
    window.addEventListener('seller-profile-updated', handleProfileRefresh as EventListener);
    return () => {
      window.removeEventListener('seller-profile-updated', handleProfileRefresh as EventListener);
    };
  }, [profile]);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  if (!hasPharmacy) {
    const createOnboardingPharmacy = async () => {
      if (!profile?.uid) return;
      setOnboardingSubmitting(true);
      try {
        logUI('CREATE_PHARMACY_CLICK', { context: 'Seller onboarding create pharmacy', success: true });
        await api.createPharmacy({
          id: profile.uid,
          ownerId: profile.uid,
          sellerId: profile.uid,
          name: onboardingName || `${profile.displayName || 'Seller'} Pharmacy`,
          verificationDetails: {
            ownerName: onboardingOwnerName,
            licenseNumber: onboardingLicense,
          },
          contactNumber: onboardingPhone,
          email: profile.email,
          status: 'pending',
          verificationStatus: 'pending',
          address: { addressLine: onboardingAddress },
          description: '',
          operatingHours: '09:00-21:00',
        });
        window.location.reload();
      } finally {
        setOnboardingSubmitting(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Complete your pharmacy onboarding</h2>
          <p className="text-slate-600 mb-6">Your seller account is active, but your pharmacy profile is missing. Submit basic details to create it instantly.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <input value={onboardingName} onChange={(e) => setOnboardingName(e.target.value)} placeholder="Pharmacy Name" className="px-3 py-2 rounded-xl border border-slate-200" />
            <input value={onboardingPhone} onChange={(e) => setOnboardingPhone(e.target.value)} placeholder="Contact Number" className="px-3 py-2 rounded-xl border border-slate-200" />
            <input value={onboardingOwnerName} onChange={(e) => setOnboardingOwnerName(e.target.value)} placeholder="Owner Name" className="px-3 py-2 rounded-xl border border-slate-200" />
            <input value={onboardingLicense} onChange={(e) => setOnboardingLicense(e.target.value)} placeholder="License Number" className="px-3 py-2 rounded-xl border border-slate-200" />
            <input value={onboardingAddress} onChange={(e) => setOnboardingAddress(e.target.value)} placeholder="Address" className="px-3 py-2 rounded-xl border border-slate-200 md:col-span-2" />
          </div>
          <div className="flex items-center gap-3">
            <button disabled={onboardingSubmitting} onClick={createOnboardingPharmacy} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60">
              {onboardingSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              Create Pharmacy
            </button>
            <Link to="/seller/profile" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors">
              Open Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }
  if (pharmacyStatus !== 'verified') {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-8">
        <h2 className="text-xl font-bold text-amber-700 mb-2">Your pharmacy is under admin review</h2>
        <p className="text-slate-600">Complete verification is required before seller operations become available.</p>
      </div>
    );
  }
  if (!hasInventoryItems) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-8">
        <h2 className="text-xl font-bold text-amber-700 mb-2">No medicines listed yet</h2>
        <p className="text-slate-600 mb-4">Add medicine inventory to activate your store. Order-related actions remain disabled until inventory is available.</p>
        <Link to="/seller/inventory" className="inline-flex px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold">
          Add Medicine
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {!profileComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-amber-800 text-sm">
            Your store profile is incomplete. You can continue using the seller panel and update profile details anytime.
          </p>
          <Link to="/seller/profile" className="inline-flex mt-2 text-sm font-semibold text-emerald-700 hover:underline">
            Update Store Profile
          </Link>
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Store Dashboard</h1>
          <p className="text-slate-500 text-sm">Welcome back, {profile?.displayName || 'Seller'}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              logUI('BUTTON_CLICK', {
                context: 'Sync Inventory',
                success: false,
                reason: 'No handler attached',
              })
            }
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Inventory
          </button>
          <Link to="/seller/inventory" className="flex items-center gap-2 px-4 py-2 bg-emerald-600 rounded-xl text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200">
            <Plus className="w-4 h-4" />
            Manage Inventory
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Today's Orders", value: stats.todayOrders, icon: ClipboardList, color: 'blue' },
          { label: "Pending Rx", value: stats.pendingPrescriptions, icon: FileText, color: 'amber' },
          { label: "Low Stock", value: stats.lowStock, icon: AlertTriangle, color: 'red' },
          { label: "Out for Delivery", value: stats.outForDelivery, icon: Package, color: 'indigo' },
          { label: "Monthly Revenue", value: `₹${(stats.monthlyRevenue / 1000).toFixed(1)}k`, icon: TrendingUp, color: 'emerald' },
          { label: "Settlement Due", value: `₹${(stats.settlementDue / 1000).toFixed(1)}k`, icon: DollarSign, color: 'slate' },
        ].map((kpi, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className={`p-2 bg-${kpi.color}-50 text-${kpi.color}-600 rounded-lg w-fit mb-3`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <p className="text-slate-500 text-xs font-medium mb-1">{kpi.label}</p>
            <h3 className="text-xl font-bold text-slate-900">{kpi.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          {/* Revenue Trend */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Revenue Trend
              </h3>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button className="px-3 py-1 text-xs font-bold bg-white rounded-md shadow-sm">Weekly</button>
                <button className="px-3 py-1 text-xs font-bold text-slate-500">Monthly</button>
              </div>
            </div>
            <div className="h-[300px]">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">No revenue data available yet.</div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Recent Orders</h3>
              <Link to="/seller/orders" className="text-emerald-600 text-sm font-semibold hover:underline">View All</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Order ID</th>
                    <th className="px-6 py-4 font-semibold">Customer</th>
                    <th className="px-6 py-4 font-semibold">Amount</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td className="px-6 py-6 text-sm text-slate-500" colSpan={4}>No orders yet.</td>
                    </tr>
                  ) : recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">#{order.id.slice(-6)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{order.customerId}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">₹{order.totalAmount}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          order.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {order.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-8">
          {/* Quick Actions */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">Quick Actions</h3>
            {bestSellers.length === 0 && (
              <div className="mb-3 rounded-lg bg-amber-50 text-amber-700 text-xs p-2">
                No medicines listed yet. Add Medicine to make your store visible.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'View Catalog', icon: Package, link: '/seller/catalog', color: 'emerald' },
                { label: 'Update Stock', icon: RefreshCw, link: '/seller/inventory', color: 'blue' },
                { label: 'View Orders', icon: ClipboardList, link: '/seller/orders', color: 'amber' },
                { label: 'Notifications', icon: Bell, link: '/seller/notifications', color: 'purple' },
              ].map((action, i) => (
                <Link 
                  key={i}
                  to={action.link}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/30 transition-all group"
                >
                  <div className={`p-2 bg-${action.color}-50 text-${action.color}-600 rounded-lg mb-2 group-hover:scale-110 transition-transform`}>
                    <action.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-600">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Prescription Review Queue */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Rx Review Queue</h3>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">
                {pendingPrescriptions.length} Pending
              </span>
            </div>
            <div className="space-y-3">
              {pendingPrescriptions.slice(0, 3).map((rx) => (
                <div key={rx.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                      <img src={rx.imageUrl} alt="Rx" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Rx #{rx.id.slice(-6)}</p>
                      <p className="text-[10px] text-slate-500">{new Date(rx.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <Link to="/seller/prescriptions" className="p-1.5 hover:bg-white rounded-lg transition-colors">
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </Link>
                </div>
              ))}
              <Link to="/seller/prescriptions" className="block text-center text-xs font-bold text-emerald-600 hover:underline mt-2">
                Open Review Center
              </Link>
            </div>
          </div>

          {/* Best Selling Medicines */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6">Best Sellers</h3>
            <div className="h-[200px]">
              {bestSellers.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">No top medicines data available yet.</div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bestSellers} layout="vertical" margin={{ left: -20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} width={80} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="sales" radius={[0, 4, 4, 0]} barSize={12}>
                    {bestSellers.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Notifications/Announcements */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-emerald-600" />
              Announcements
            </h3>
            <div className="space-y-4">
              {notifications.slice(0, 3).map((notif) => (
                <div key={notif.id} className="flex gap-3">
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${notif.isRead ? 'bg-slate-200' : 'bg-emerald-500'}`} />
                  <div>
                    <p className="text-xs font-bold text-slate-800 leading-tight">{notif.title}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{notif.message}</p>
                    <p className="text-[9px] text-slate-400 mt-1">{new Date(notif.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboard;
