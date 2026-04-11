import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Download,
  Wallet,
  CreditCard,
  History,
  AlertCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion } from 'motion/react';
import { SellerPayout } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';

const FINANCIAL_SUCCESS_STATUSES = new Set(['successful', 'completed', 'paid']);
const ORDER_SETTLED_STATUSES = new Set(['delivered', 'picked_up', 'completed']);
const FINANCIAL_EXCLUDED_STATUSES = new Set(['failed', 'cancelled', 'canceled', 'rejected', 'pending', 'pending_payment']);
const PAYOUT_PENDING_STATUSES = new Set(['pending', 'processing']);
const PAYOUT_PAID_STATUSES = new Set(['paid', 'completed', 'settled']);

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const toMonthKey = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonth = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  const parsed = new Date(year, (month || 1) - 1, 1);
  return parsed.toLocaleString(undefined, { month: 'short' });
};

const asSellerMatch = (candidate: unknown, sellerUid?: string | null) =>
  Boolean(sellerUid && String(candidate || '').trim() && String(candidate) === String(sellerUid));

const SellerPayouts: React.FC = () => {
  const { profile } = useAuth();
  const [payouts, setPayouts] = useState<SellerPayout[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'failed'>('all');
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [notice, setNotice] = useState('');
  const [wallet, setWallet] = useState({
    availableBalance: 0,
    totalEarningsNet: 0,
    pendingSettlement: 0,
    commissionPaid: 0,
    gstDeducted: 0,
  });
  const [chartData, setChartData] = useState<Array<{ name: string; amount: number }>>([]);

  const load = async () => {
    if (!profile) return;
    try {
      setLoading(true);
      const pharmacies = await api.getPharmacies({ ownerId: profile.uid });
      const pharmacyIds = new Set(pharmacies.map((pharmacy) => pharmacy.id));

      const [orders, payments, sellerPayouts, returns] = await Promise.all([
        api.getOrders(),
        api.getPayments(),
        api.getPayouts({ ownerId: profile.uid }),
        api.getReturns(),
      ]);

      const sellerOrders = orders.filter((order: any) =>
        pharmacyIds.has(order.pharmacyId) ||
        asSellerMatch(order?.sellerId, profile.uid) ||
        (order.items || []).some((item: any) => asSellerMatch(item?.sellerId, profile.uid)),
      );
      const paymentByOrderId = payments.reduce<Record<string, any>>((acc, payment: any) => {
        const orderId = String(payment.orderId || '');
        if (!orderId) return acc;
        acc[orderId] = payment;
        return acc;
      }, {});

      const financiallyValidOrders = sellerOrders.filter((order: any) => {
        const status = String(order.status || '').toLowerCase();
        const orderPaymentStatus = String(order.paymentStatus || '').toLowerCase();
        const paymentRecord = paymentByOrderId[String(order.id)];
        const paymentRecordStatus = String(paymentRecord?.paymentStatus || paymentRecord?.status || '').toLowerCase();
        const resolvedPaymentStatus = paymentRecordStatus || orderPaymentStatus;

        if (FINANCIAL_EXCLUDED_STATUSES.has(status)) return false;
        if (resolvedPaymentStatus && FINANCIAL_EXCLUDED_STATUSES.has(resolvedPaymentStatus)) return false;

        if (FINANCIAL_SUCCESS_STATUSES.has(resolvedPaymentStatus)) return true;
        if (!resolvedPaymentStatus) return ORDER_SETTLED_STATUSES.has(status);
        return ORDER_SETTLED_STATUSES.has(status);
      });
      const financiallyValidOrderById = financiallyValidOrders.reduce<Record<string, any>>((acc, order: any) => {
        acc[String(order.id)] = order;
        return acc;
      }, {});

      const refundStatuses = new Set(['approved', 'processed', 'completed', 'refunded']);
      const sellerReturns = returns.filter((entry: any) => {
        if (!refundStatuses.has(String(entry.status || '').toLowerCase())) return false;
        const linkedOrder = financiallyValidOrderById[String(entry.orderId || '')];
        return Boolean(linkedOrder);
      });

      const returnDeduction = sellerReturns.reduce((sum: number, entry: any) => {
        const explicitAmount = Number(entry.amount || entry.refundAmount || entry.totalAmount || 0);
        if (explicitAmount > 0) return sum + explicitAmount;
        const linkedOrder = financiallyValidOrderById[String(entry.orderId || '')];
        const itemLevel = Array.isArray(entry.items)
          ? entry.items.reduce((itemSum: number, item: any) => itemSum + (Number(item.quantity || 0) * Number(item.unitPrice || item.price || 0)), 0)
          : 0;
        const fallback = entry.reason === 'wrong_item' || entry.reason === 'expired' ? Number(linkedOrder?.totalAmount || 0) : 0;
        return sum + (itemLevel > 0 ? itemLevel : fallback);
      }, 0);

      const grossEarnings = financiallyValidOrders.reduce((sum: number, order: any) => sum + Number(order.totalAmount || 0), 0);
      const derivedCommission = grossEarnings * 0.1;
      const derivedGst = derivedCommission * 0.18;
      const totalNetEarnings = Math.max(0, grossEarnings - derivedCommission - derivedGst - returnDeduction);

      const normalizedPayouts = [...sellerPayouts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setPayouts(normalizedPayouts);

      const paidAmount = normalizedPayouts
        .filter((payout) => PAYOUT_PAID_STATUSES.has(String(payout.status).toLowerCase()))
        .reduce((sum, payout) => sum + Number(payout.netAmount || 0), 0);
      const pendingAmount = normalizedPayouts
        .filter((payout) => PAYOUT_PENDING_STATUSES.has(String(payout.status).toLowerCase()))
        .reduce((sum, payout) => sum + Number(payout.netAmount || 0), 0);
      const commissionPaid = normalizedPayouts.reduce((sum, payout) => sum + Number(payout.commission || 0), 0) || derivedCommission;
      const gstDeducted = normalizedPayouts.reduce((sum, payout) => sum + Number(payout.gst || 0), 0) || derivedGst;

      const availableBalance = Math.max(0, totalNetEarnings - paidAmount - pendingAmount);

      setWallet({
        availableBalance,
        totalEarningsNet: totalNetEarnings,
        pendingSettlement: pendingAmount,
        commissionPaid,
        gstDeducted,
      });

      const monthlyMap = new Map<string, number>();
      for (let i = 5; i >= 0; i -= 1) {
        const monthDate = startOfMonth(new Date(new Date().getFullYear(), new Date().getMonth() - i, 1));
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap.set(monthKey, 0);
      }

      financiallyValidOrders.forEach((order: any) => {
        const monthKey = toMonthKey(order.createdAt);
        if (!monthKey || !monthlyMap.has(monthKey)) return;
        const gross = Number(order.totalAmount || 0);
        const net = gross - (gross * 0.1) - (gross * 0.1 * 0.18);
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + net);
      });

      sellerReturns.forEach((entry: any) => {
        const monthKey = toMonthKey(entry.createdAt);
        if (!monthKey || !monthlyMap.has(monthKey)) return;
        const explicitAmount = Number(entry.amount || entry.refundAmount || entry.totalAmount || 0);
        const linkedOrder = financiallyValidOrderById[String(entry.orderId || '')];
        const itemLevel = Array.isArray(entry.items)
          ? entry.items.reduce((itemSum: number, item: any) => itemSum + (Number(item.quantity || 0) * Number(item.unitPrice || item.price || 0)), 0)
          : 0;
        const fallback = entry.reason === 'wrong_item' || entry.reason === 'expired' ? Number(linkedOrder?.totalAmount || 0) : 0;
        const deduction = explicitAmount > 0 ? explicitAmount : itemLevel > 0 ? itemLevel : fallback;
        monthlyMap.set(monthKey, Math.max(0, (monthlyMap.get(monthKey) || 0) - deduction));
      });

      setChartData(Array.from(monthlyMap.entries()).map(([key, amount]) => ({ name: formatMonth(key), amount: Math.max(0, Number(amount.toFixed(2)) ) })));
    } catch (error) {
      console.error('Failed to load payouts', error);
      setNotice('Failed to load payouts data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [profile?.uid]);

  const filteredPayouts = payouts.filter((payout) => {
    if (filter === 'all') return true;
    const status = String(payout.status || '').toLowerCase();
    if (filter === 'pending') return PAYOUT_PENDING_STATUSES.has(status);
    if (filter === 'paid') return PAYOUT_PAID_STATUSES.has(status);
    if (filter === 'failed') return status === 'failed';
    return true;
  });

  const handleRequestPayout = async () => {
    if (!profile || requesting) return;
    const amount = Number(wallet.availableBalance || 0);
    if (amount <= 0) {
      setNotice('No available balance to request payout.');
      return;
    }

    try {
      setRequesting(true);
      setNotice('');
      const pharmacies = await api.getPharmacies({ ownerId: profile.uid });
      const primaryPharmacy = pharmacies[0];
      if (!primaryPharmacy?.id) {
        setNotice('No linked pharmacy found for payout request.');
        return;
      }

      const commission = Number((amount * 0.1).toFixed(2));
      const gst = Number((commission * 0.18).toFixed(2));
      const gross = Number((amount + commission + gst).toFixed(2));
      const now = new Date().toISOString();
      await api.createPayout({
        pharmacyId: primaryPharmacy.id,
        amount: gross,
        commission,
        gst,
        netAmount: Number(amount.toFixed(2)),
        status: 'pending',
        bankAccount: 'on_file',
        periodStart: now,
        periodEnd: now,
      });

      setNotice('Payout request submitted successfully.');
      await load();
    } catch (error) {
      console.error('Failed to request payout', error);
      setNotice('Unable to submit payout request right now.');
    } finally {
      setRequesting(false);
    }
  };

  const handleDownloadGstSummary = () => {
    const gstRows = payouts.map((payout) => ({
      id: payout.id,
      periodStart: payout.periodStart,
      periodEnd: payout.periodEnd,
      commission: Number(payout.commission || 0).toFixed(2),
      gst: Number(payout.gst || 0).toFixed(2),
      status: payout.status,
      createdAt: payout.createdAt,
    }));

    const header = 'Payout ID,Period Start,Period End,Commission,GST,Status,Created At';
    const lines = gstRows.map((row) => `${row.id},${row.periodStart},${row.periodEnd},${row.commission},${row.gst},${row.status},${row.createdAt}`);
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gst-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const nextSettlementDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toLocaleDateString();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const safeChart = chartData.length ? chartData : [{ name: 'No Data', amount: 0 }];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payouts & Billing</h1>
          <p className="text-slate-500 text-sm">Manage your earnings, settlements, and bank details</p>
        </div>
        <button onClick={handleDownloadGstSummary} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 rounded-2xl text-sm font-bold text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
          <Download className="w-5 h-5" />
          Download GST Summary
        </button>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium">{notice}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl shadow-slate-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
            <Wallet className="w-32 h-32" />
          </div>
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                <CreditCard className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/30">
                Active Wallet
              </span>
            </div>
            <div>
              <p className="text-slate-400 text-xs font-medium mb-1 uppercase tracking-wider">Available Balance</p>
              <h3 className="text-4xl font-bold">₹{wallet.availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleRequestPayout}
                disabled={requesting || wallet.availableBalance <= 0}
                className="flex-1 py-2.5 bg-white text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {requesting ? 'Requesting...' : 'Request Payout'}
              </button>
              <button className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors" aria-label="Payout history shortcut">
                <History className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Live</span>
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium mb-1 uppercase tracking-wider">Total Earnings (Net)</p>
            <h3 className="text-3xl font-bold text-slate-900">₹{wallet.totalEarningsNet.toLocaleString(undefined, { maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
            <span>Commission Paid</span>
            <span className="text-slate-600">₹{wallet.commissionPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Next: {nextSettlementDate}</span>
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium mb-1 uppercase tracking-wider">Pending Settlement</p>
            <h3 className="text-3xl font-bold text-slate-900">₹{wallet.pendingSettlement.toLocaleString(undefined, { maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
            <span>GST Deducted</span>
            <span className="text-slate-600">₹{wallet.gstDeducted.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-900">Earnings Overview</h3>
            <span className="text-xs font-bold bg-slate-50 rounded-lg px-3 py-1.5">Last 6 Months</span>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={safeChart}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorEarnings)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Payout History</h3>
            <div className="flex gap-1">
              {(['all', 'pending', 'paid'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2 py-1 text-[9px] font-bold uppercase rounded-md transition-colors ${filter === f ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[400px]">
            <div className="divide-y divide-slate-50">
              {filteredPayouts.length === 0 && (
                <div className="p-6 text-sm text-slate-500">No payout records found for this filter.</div>
              )}
              {filteredPayouts.map((payout) => (
                <div key={payout.id} className="p-4 hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${payout.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : payout.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                        {payout.status === 'paid' ? <CheckCircle2 className="w-4 h-4" /> : payout.status === 'failed' ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">₹{Number(payout.netAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        <p className="text-[10px] text-slate-500">{new Date(payout.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase">
                    <span>{new Date(payout.periodStart).toLocaleDateString()} - {new Date(payout.periodEnd).toLocaleDateString()}</span>
                    <span className={payout.status === 'paid' ? 'text-emerald-600' : payout.status === 'failed' ? 'text-red-600' : 'text-amber-600'}>{payout.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 text-xs font-bold text-slate-500 border-t border-slate-100">Showing {filteredPayouts.length} settlements</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              Settlement Bank Account
            </h3>
            <span className="text-xs font-bold text-slate-500">On file</span>
          </div>
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Primary Settlement Account</p>
              <p className="text-xs text-slate-500">Account: **** **** on file</p>
            </div>
            <div className="text-right">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md">Verified</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Tax Information (GST)
            </h3>
            <span className="text-xs font-bold text-slate-500">Auto</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">GST Deducted</p>
              <p className="text-xs font-bold text-slate-900">₹{wallet.gstDeducted.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Commission Base</p>
              <p className="text-xs font-bold text-slate-900">₹{wallet.commissionPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
              GST summary is generated from your live payout records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerPayouts;
