import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Download, 
  Search, 
  Filter, 
  ArrowUpRight, 
  Wallet, 
  CreditCard, 
  History, 
  AlertCircle,
  ChevronRight,
  MoreVertical,
  Calendar,
  FileText
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { SellerPayout } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';

const SellerPayouts: React.FC = () => {
  const { profile } = useAuth();
  const [payouts, setPayouts] = useState<SellerPayout[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'failed'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!profile) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await api.getPayouts({ ownerId: profile.uid });
        setPayouts(data as SellerPayout[]);
      } catch (error) {
        console.error('Failed to load payouts', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [profile]);

  const chartData = [
    { name: 'Jan', amount: 45000 },
    { name: 'Feb', amount: 52000 },
    { name: 'Mar', amount: 48000 },
    { name: 'Apr', amount: 61000 },
    { name: 'May', amount: 55000 },
    { name: 'Jun', amount: 67000 },
  ];

  const filteredPayouts = payouts.filter(p => filter === 'all' || p.status === filter);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payouts & Billing</h1>
          <p className="text-slate-500 text-sm">Manage your earnings, settlements, and bank details</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-emerald-600 rounded-2xl text-sm font-bold text-white hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200">
          <Download className="w-5 h-5" />
          Download GST Summary
        </button>
      </div>

      {/* Wallet & Stats */}
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
              <h3 className="text-4xl font-bold">₹18,500.00</h3>
            </div>
            <div className="flex items-center gap-4">
              <button className="flex-1 py-2.5 bg-white text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors">
                Request Payout
              </button>
              <button className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
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
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">+12% vs last month</span>
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium mb-1 uppercase tracking-wider">Total Earnings (Net)</p>
            <h3 className="text-3xl font-bold text-slate-900">₹1,25,400</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
            <span>Commission Paid</span>
            <span className="text-slate-600">₹12,540</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Next: 31st March</span>
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium mb-1 uppercase tracking-wider">Pending Settlement</p>
            <h3 className="text-3xl font-bold text-slate-900">₹8,000</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
            <span>GST Deducted</span>
            <span className="text-slate-600">₹1,440</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Earnings Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-slate-900">Earnings Overview</h3>
            <select className="text-xs font-bold border-none bg-slate-50 rounded-lg px-3 py-1.5 focus:ring-0">
              <option>Last 6 Months</option>
              <option>This Year</option>
            </select>
          </div>
          <div className="h-[300px]">
            {!chartData.length ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">No data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
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
                  <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorEarnings)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payout History */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Payout History</h3>
            <div className="flex gap-1">
              {(['all', 'pending', 'paid'] as const).map(f => (
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
              {filteredPayouts.map((payout) => (
                <div key={payout.id} className="p-4 hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${payout.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                        {payout.status === 'paid' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">₹{payout.netAmount.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-500">{new Date(payout.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button className="p-1.5 hover:bg-white rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                      <Download className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase">
                    <span>{payout.periodStart} - {payout.periodEnd}</span>
                    <span className={payout.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}>{payout.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button className="p-4 text-xs font-bold text-emerald-600 hover:bg-emerald-50 transition-colors border-t border-slate-100">
            View All Settlements
          </button>
        </div>
      </div>

      {/* Bank Details & GST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              Settlement Bank Account
            </h3>
            <button className="text-xs font-bold text-emerald-600 hover:underline">Edit</button>
          </div>
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 flex items-center justify-center">
                <img src="https://upload.wikimedia.org/wikipedia/commons/c/cc/SBI-logo.svg" alt="SBI" className="w-8 h-8 object-contain" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">State Bank of India</p>
                <p className="text-xs text-slate-500">Account: **** **** 1234</p>
              </div>
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
            <button className="text-xs font-bold text-emerald-600 hover:underline">Update</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">GSTIN</p>
              <p className="text-xs font-bold text-slate-900">24AAAAA0000A1Z5</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">TCS Rate</p>
              <p className="text-xs font-bold text-slate-900">1.00%</p>
            </div>
          </div>
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
              Ensure your GST details are up-to-date to avoid delays in tax credit processing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerPayouts;
