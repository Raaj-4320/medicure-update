import React, { useState, useEffect } from 'react';
import {
  Package,
  Clock,
  ChevronRight,
  CheckCircle2,
  Truck,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';
import { motion } from 'motion/react';
import { logFlow } from '../../utils/flowLogger';

export default function OrderHistory() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const normalizeOrderRows = (rows: any[] = []) => {
    const normalized = [...rows]
      .map((row, index) => {
        const safeRow = row && typeof row === 'object' ? row : {};
        return {
          ...safeRow,
          id: String(safeRow?.id || `order-${index}`),
          status: String(safeRow?.status || 'pending'),
          items: Array.isArray(safeRow?.items) ? safeRow.items : [],
          totalAmount: Number.isFinite(Number(safeRow?.totalAmount)) ? Number(safeRow?.totalAmount) : 0,
          createdAt: typeof safeRow?.createdAt === 'string' && safeRow.createdAt ? safeRow.createdAt : new Date(0).toISOString(),
          paymentStatus: String(safeRow?.paymentStatus || 'pending'),
          transactionReference: safeRow?.transactionReference ? String(safeRow.transactionReference) : '',
          pharmacyName: safeRow?.pharmacyName ? String(safeRow.pharmacyName) : 'Pharmacy',
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    logFlow('ORDERS_NORMALIZE', {
      expected: ['safe order rows for render'],
      received: { inputCount: Array.isArray(rows) ? rows.length : 0, outputCount: normalized.length },
      success: true,
    });

    return normalized;
  };

  const fetchOrders = async (options?: { userId?: string; source?: 'initial' | 'refresh' }) => {
    const userId = options?.userId;
    if (!userId) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setErrorMessage('');
      logFlow('ORDERS_FETCH', {
        step: 'START',
        expected: ['orders list for customer'],
        received: { userId, source: options?.source || 'refresh' },
        success: true,
      });

      const data = await api.getOrders({ customerId: userId });
      const normalized = normalizeOrderRows(Array.isArray(data) ? data : []);
      setOrders(normalized);

      logFlow('ORDERS_FETCH', {
        expected: ['orders list for customer'],
        received: { userId, count: normalized.length, source: options?.source || 'refresh', mode: 'one-time' },
        success: true,
      });
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setErrorMessage('Failed to load orders right now. Please refresh.');
      logFlow('ORDERS_FETCH', {
        expected: ['orders list for customer'],
        received: { userId, source: options?.source || 'refresh' },
        success: false,
        error,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;
    setLoading(true);

    const userId = profile?.uid;

    fetchOrders({ userId, source: 'initial' });

    logFlow('ORDERS_SUBSCRIBE', {
      step: 'START',
      expected: ['unsubscribe callback from subscribeToOrders'],
      received: { userId, mode: 'realtime' },
      success: true,
    });

    const subscriptionResult = api.subscribeToOrders({ customerId: userId }, (liveOrders: any[]) => {
      if (!isActive) return;
      const normalized = normalizeOrderRows(Array.isArray(liveOrders) ? liveOrders : []);
      setOrders(normalized);
      setLoading(false);
      logFlow('ORDERS_SUBSCRIBE', {
        expected: ['live orders updates'],
        received: { userId, count: normalized.length, mode: 'realtime' },
        success: true,
      });
    });

    const unsubscribe = typeof subscriptionResult === 'function' ? subscriptionResult : null;

    if (!unsubscribe) {
      logFlow('ORDERS_SUBSCRIBE', {
        expected: ['function unsubscribe'],
        received: { userId, returnedType: typeof subscriptionResult },
        success: false,
        error: 'subscribeToOrders did not return a function',
      });
    }

    return () => {
      isActive = false;
      logFlow('ORDERS_SUBSCRIBE', {
        expected: ['cleanup without errors'],
        received: { userId, cleanupType: typeof unsubscribe },
        success: true,
      });
      if (unsubscribe) unsubscribe();
    };
  }, [profile?.uid]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-amber-500" />;
      case 'confirmed': return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
      case 'packed': return <Package className="w-5 h-5 text-purple-500" />;
      case 'dispatched': return <Truck className="w-5 h-5 text-blue-500" />;
      case 'ready': return <Package className="w-5 h-5 text-emerald-500" />;
      case 'on_the_way': return <Truck className="w-5 h-5 text-emerald-600 animate-bounce" />;
      case 'delivered': return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'cancelled': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusText = (status: string) => String(status || 'pending').replace(/_/g, ' ').toUpperCase();

  const getPaymentBadge = (status: string) => {
    if (status === 'successful') return 'bg-emerald-50 text-emerald-700';
    if (status === 'failed') return 'bg-red-50 text-red-700';
    if (status === 'pending' || status === 'processing' || status === 'initiated') return 'bg-amber-50 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>
          <p className="text-slate-500">Track and manage your medicine orders</p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchOrders({ userId: profile?.uid, source: 'refresh' });
          }}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors"
        >
          <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
          <p className="text-slate-500">Loading your orders...</p>
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-red-200">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-1">Could not load orders</h3>
          <p className="text-slate-500">{errorMessage}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-1">No orders yet</h3>
          <p className="text-slate-500 mb-4">You haven&apos;t placed any orders yet.</p>
          <Link to="/discover" className="inline-flex px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700">
            Browse pharmacies
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 rounded-xl">
                    {getStatusIcon(order.status)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Order #{order.id}</h3>
                    <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                    <p className="text-xs text-slate-400">{order.pharmacyName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600">₹{Number(order.totalAmount || 0).toFixed(2)}</div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{getStatusText(order.status)}</span>
                  <div className={`mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block ${getPaymentBadge(order.paymentStatus || 'pending')}`}>
                    Payment: {String(order.paymentStatus || 'pending').replace('_', ' ')}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex -space-x-2">
                  {(Array.isArray(order.items) ? order.items : []).slice(0, 3).map((item: any, idx: number) => (
                    <div key={idx} className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                      {String(item?.medicineId || item?.medicineMasterId || '?').slice(0, 2).toUpperCase()}
                    </div>
                  ))}
                  {(Array.isArray(order.items) ? order.items.length : 0) > 3 && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                      +{(Array.isArray(order.items) ? order.items.length : 0) - 3}
                    </div>
                  )}
                </div>
                <button disabled title="Order details view will be added in the next iteration." className="text-slate-400 cursor-not-allowed text-sm font-bold flex items-center gap-1">
                  View Details
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {order.transactionReference && (
                <div className="mt-3 text-[11px] text-slate-500">
                  Transaction Ref: <span className="font-semibold text-slate-700">{order.transactionReference}</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
