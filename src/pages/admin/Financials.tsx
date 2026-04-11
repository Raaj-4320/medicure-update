import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Search,
  Loader2,
  ArrowUpRight,
  Download,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { motion, AnimatePresence } from 'motion/react';
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
  Cell,
} from 'recharts';

const Financials: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'payouts' | 'reconciliation'>('overview');
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [overview, setOverview] = useState({
    totalRevenue: 0,
    totalCommission: 0,
    pendingPayoutAmount: 0,
    pendingPayoutCount: 0,
    gstCollected: 0,
    totalOrders: 0,
    paidAmount: 0,
    returnCount: 0,
  });
  const [revenueData, setRevenueData] = useState<Array<{ name: string; revenue: number; commission: number }>>([]);
  const [paymentStatusData, setPaymentStatusData] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [reconciliationRows, setReconciliationRows] = useState<any[]>([]);

  const parseDate = (value: unknown): Date | null => {
    if (typeof value !== 'string' || !value.trim()) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const monthKey = (value: unknown): string => {
    const date = parseDate(value);
    if (!date) return 'Unknown';
    return date.toLocaleString(undefined, { month: 'short' });
  };

  const normalizePayouts = (payouts: any[]) =>
    payouts.map((p: any) => ({
      id: p.id,
      orderId: p.orderId || '-',
      pharmacyId: p.pharmacyId,
      sellerId: p.sellerId || p.pharmacyId || '-',
      totalAmount: Number(p.amount || 0),
      commissionAmount: Number(p.commission || 0),
      sellerPayout: Number(p.netAmount || 0),
      gstAmount: Number(p.gst || 0),
      status: p.status === 'paid' ? 'paid' : p.status === 'failed' ? 'failed' : 'pending',
      createdAt: p.createdAt,
    }));

  const loadFinancials = async () => {
    try {
      setLoading(true);
      const [payouts, orders, payments, returns] = await Promise.all([
        api.getPayouts(),
        api.getOrders(),
        api.getPayments(),
        api.getReturns(),
      ]);

      const normalizedPayouts = normalizePayouts(payouts);
      setRecords(normalizedPayouts);

      const totalRevenue = orders.reduce((sum: number, order: any) => sum + Number(order.totalAmount || 0), 0);
      const totalCommission = normalizedPayouts.reduce((sum: number, payout: any) => sum + Number(payout.commissionAmount || 0), 0);
      const pendingPayoutAmount = normalizedPayouts
        .filter((payout: any) => payout.status !== 'paid')
        .reduce((sum: number, payout: any) => sum + Number(payout.sellerPayout || 0), 0);
      const pendingPayoutCount = normalizedPayouts.filter((payout: any) => payout.status !== 'paid').length;
      const gstCollected = normalizedPayouts.reduce((sum: number, payout: any) => sum + Number(payout.gstAmount || 0), 0);
      const paidAmount = payments
        .filter((payment: any) => {
          const state = String(payment.paymentStatus || payment.status || '').toLowerCase();
          return state === 'successful' || state === 'completed' || state === 'paid';
        })
        .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);

      setOverview({
        totalRevenue,
        totalCommission,
        pendingPayoutAmount,
        pendingPayoutCount,
        gstCollected,
        totalOrders: orders.length,
        paidAmount,
        returnCount: returns.length,
      });

      const revenueByMonth = orders.reduce<Record<string, number>>((acc, order: any) => {
        const key = monthKey(order.createdAt);
        acc[key] = (acc[key] || 0) + Number(order.totalAmount || 0);
        return acc;
      }, {});
      const commissionByMonth = normalizedPayouts.reduce<Record<string, number>>((acc, payout: any) => {
        const key = monthKey(payout.createdAt);
        acc[key] = (acc[key] || 0) + Number(payout.commissionAmount || 0);
        return acc;
      }, {});
      const monthKeys = Array.from(new Set([...Object.keys(revenueByMonth), ...Object.keys(commissionByMonth)]));
      setRevenueData(
        monthKeys.map((key) => ({
          name: key,
          revenue: Number(revenueByMonth[key] || 0),
          commission: Number(commissionByMonth[key] || 0),
        })),
      );

      const statusBreakdown = payments.reduce<Record<string, number>>((acc, payment: any) => {
        const state = String(payment.paymentStatus || payment.status || 'unknown').toLowerCase();
        acc[state] = (acc[state] || 0) + Number(payment.amount || 0);
        return acc;
      }, {});
      const palette = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6366f1'];
      const breakdownRows = Object.entries(statusBreakdown).map(([name, value], index) => ({
        name,
        value: Number(value),
        color: palette[index % palette.length],
      }));
      setPaymentStatusData(breakdownRows);

      const latestPaymentByOrder = payments.reduce<Record<string, any>>((acc, payment: any) => {
        const orderId = String(payment.orderId || '');
        if (!orderId) return acc;
        const existing = acc[orderId];
        if (!existing) {
          acc[orderId] = payment;
          return acc;
        }
        const existingTime = parseDate(existing.updatedAt || existing.createdAt)?.getTime() || 0;
        const nextTime = parseDate(payment.updatedAt || payment.createdAt)?.getTime() || 0;
        if (nextTime >= existingTime) acc[orderId] = payment;
        return acc;
      }, {});

      const reconRows = orders
        .map((order: any) => {
          const payment = latestPaymentByOrder[String(order.id)] || null;
          const sysAmt = Number(order.totalAmount || 0);
          const gateAmt = Number(payment?.amount || 0);
          const diff = gateAmt - sysAmt;
          const state = String(payment?.paymentStatus || payment?.status || 'missing').toLowerCase();
          const needsReview = !payment || state === 'failed' || state === 'pending' || state === 'processing' || diff !== 0;
          if (!needsReview) return null;
          return {
            id: payment?.paymentId || payment?.id || String(order.id),
            gateway: payment?.paymentMethod || payment?.method || 'unknown',
            sysAmt,
            gateAmt,
            diff,
            state,
          };
        })
        .filter(Boolean)
        .slice(0, 20);
      setReconciliationRows(reconRows);
    } catch (error) {
      console.error('Failed to load financial records', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinancials();
  }, []);

  const handleReconcile = async (id: string, status: 'reconciled' | 'failed') => {
    try {
      await api.updatePayout(id, { status: status === 'reconciled' ? 'paid' : 'failed' });
      const payouts = await api.getPayouts();
      setRecords(normalizePayouts(payouts));
    } catch (error) {
      console.error('Failed to reconcile payout', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const safeRevenueData = revenueData.length ? revenueData : [{ name: 'No Data', revenue: 0, commission: 0 }];
  const safePaymentStatus = paymentStatusData.length ? paymentStatusData : [{ name: 'no_data', value: 0, color: '#cbd5e1' }];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financial Management</h1>
          <p className="text-slate-500 text-sm">Track revenue, manage seller commissions, and handle payouts</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'payouts', label: 'Payouts', icon: DollarSign },
            { id: 'reconciliation', label: 'Reconciliation', icon: CreditCard },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab.id ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Revenue</p>
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-slate-900">₹{overview.totalRevenue.toLocaleString()}</h3>
                  <span className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    <ArrowUpRight className="w-3 h-3 mr-0.5" /> {overview.totalOrders} Orders
                  </span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Commission</p>
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-slate-900">₹{overview.totalCommission.toLocaleString()}</h3>
                  <span className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    <ArrowUpRight className="w-3 h-3 mr-0.5" /> Paid ₹{overview.paidAmount.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pending Payouts</p>
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-slate-900">₹{overview.pendingPayoutAmount.toLocaleString()}</h3>
                  <span className="flex items-center text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                    {overview.pendingPayoutCount} Pending
                  </span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">GST Collected</p>
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold text-slate-900">₹{overview.gstCollected.toLocaleString()}</h3>
                  <span className="flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    <ArrowUpRight className="w-3 h-3 mr-0.5" /> Returns {overview.returnCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-900">Revenue & Commission Trend</h3>
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={safeRevenueData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                      <Area type="monotone" dataKey="revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                      <Area type="monotone" dataKey="commission" stroke="#6366f1" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-6">Payment Status Value</h3>
                <div className="h-[250px] mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={safePaymentStatus} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} width={100} />
                      <Tooltip cursor={{ fill: 'transparent' }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                        {safePaymentStatus.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  {safePaymentStatus.map((row) => (
                    <div key={row.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: row.color }} />
                        <span className="text-xs text-slate-600">{row.name}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-900">₹{Number(row.value).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'payouts' && (
          <motion.div key="payouts" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Seller Payout Records</h3>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all">
                <Download className="w-3 h-3" /> Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Order ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Seller</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Commission</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Payout</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">GST</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">{record.orderId}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{record.sellerId}</td>
                      <td className="px-6 py-4 text-sm text-slate-900">₹{record.totalAmount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">₹{record.commissionAmount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-600">₹{record.sellerPayout.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">₹{record.gstAmount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          record.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                          record.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'reconciliation' && (
          <motion.div key="reconciliation" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <h4 className="font-bold text-orange-900">Live Reconciliation Queue</h4>
                <p className="text-sm text-orange-700">Rows below are derived from current order/payment mismatches and pending payment states.</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Manual Reconciliation Queue</h3>
                <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
                  <Search className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Transaction ID</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Gateway</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">System Amount</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Gateway Amount</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Difference</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {reconciliationRows.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-600">{tx.id}</td>
                        <td className="px-6 py-4 text-sm text-slate-900">{tx.gateway}</td>
                        <td className="px-6 py-4 text-sm text-slate-900">₹{tx.sysAmt.toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-slate-900">₹{tx.gateAmt.toLocaleString()}</td>
                        <td className={`px-6 py-4 text-sm font-bold ${tx.diff < 0 ? 'text-red-600' : tx.diff > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                          {tx.diff === 0 ? '-' : `₹${Math.abs(tx.diff)}`}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">{tx.state || 'review'}</span>
                        </td>
                      </tr>
                    ))}
                    {reconciliationRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-6 text-sm text-slate-500 text-center">No reconciliation issues detected from live records.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Financials;
