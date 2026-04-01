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
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';
import { motion } from 'motion/react';
import { appLogger } from '../../utils/observability';
import OrderDetailsModal from '../../components/OrderDetailsModal';

export default function OrderHistory() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const fetchOrders = async () => {
    try {
      appLogger.log({
        category: 'ORDER_FLOW',
        event: 'customer_get_orders_started',
        status: 'start',
        page: 'OrderHistory',
        route: '/orders',
        message: 'Customer orders query started.',
        ids: { customerId: profile?.uid },
      });
      const data = await api.getOrders({ customerId: profile?.uid });
      appLogger.log({
        category: 'FIREBASE_QUERY',
        event: 'customer_get_orders_success',
        status: 'success',
        page: 'OrderHistory',
        message: 'Customer orders query succeeded.',
        ids: { customerId: profile?.uid },
        meta: { resultCount: data.length },
      });
      setOrders(data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      appLogger.log({
        category: 'FIREBASE_QUERY',
        event: 'customer_get_orders_failure',
        status: 'failure',
        page: 'OrderHistory',
        message: 'Customer orders query failed.',
        ids: { customerId: profile?.uid },
        error: appLogger.errorSummary(error),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    appLogger.log({
      category: 'PAGE_LOAD_ROUTE',
      event: 'customer_orders_page_loaded',
      status: 'start',
      page: 'OrderHistory',
      route: '/orders',
      message: 'Customer order history page mounted.',
    });
    fetchOrders();
    const unsubscribe = api.subscribeToOrders({ customerId: profile?.uid }, (liveOrders: any[]) => {
      setOrders(liveOrders);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profile]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-amber-500" />;
      case 'confirmed': return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
      case 'packed': return <Package className="w-5 h-5 text-purple-500" />;
      case 'ready': return <Package className="w-5 h-5 text-emerald-500" />;
      case 'on_the_way': return <Truck className="w-5 h-5 text-emerald-600 animate-bounce" />;
      case 'delivered': return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'cancelled': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusText = (status: string) => {
    return status.replace(/_/g, ' ').toUpperCase();
  };

  const getPaymentBadge = (status: string) => {
    if (status === 'successful') return 'bg-emerald-50 text-emerald-700';
    if (status === 'failed') return 'bg-red-50 text-red-700';
    if (status === 'pending' || status === 'processing' || status === 'initiated') return 'bg-amber-50 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  };

  const orderItems = (order: any) => (Array.isArray(order?.items) ? order.items : []);
  const visibleOrderCount = Array.isArray(orders) ? orders.length : 0;

  useEffect(() => {
    appLogger.log({
      category: 'ORDER_FLOW',
      event: 'customer_orders_render_state',
      status: 'success',
      page: 'OrderHistory',
      message: 'Customer orders render state updated.',
      ids: { customerId: profile?.uid },
      meta: { visibleOrderCount, loading },
    });
    const malformed = orders.filter((order) => !Array.isArray(order?.items) || typeof order?.totalAmount !== 'number');
    if (malformed.length > 0) {
      appLogger.log({
        category: 'SYSTEM_WARNING',
        event: 'customer_orders_malformed_shape',
        status: 'warning',
        page: 'OrderHistory',
        message: 'Some customer order records are malformed.',
        meta: { malformedCount: malformed.length },
      });
    }
  }, [visibleOrderCount, loading, profile?.uid]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Orders</h1>
          <p className="text-slate-500">Track and manage your medicine orders</p>
        </div>
        <button 
          onClick={() => { setLoading(true); fetchOrders(); }}
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
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-1">No orders found</h3>
          <p className="text-slate-500">You haven't placed any orders yet.</p>
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
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600">₹{Number(order.totalAmount || 0).toFixed(2)}</div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{getStatusText(order.status)}</span>
                  <div className={`mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block ${getPaymentBadge(order.paymentStatus || 'pending')}`}>
                    Payment: {(order.paymentStatus || 'pending').replace('_', ' ')}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex -space-x-2">
                  {orderItems(order).slice(0, 3).map((item: any, idx: number) => (
                    <div key={idx} className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                      {String(item.medicineId || 'NA').slice(0, 2).toUpperCase()}
                    </div>
                  ))}
                  {orderItems(order).length > 3 && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">
                      +{orderItems(order).length - 3}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                >
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

      <OrderDetailsModal
        isOpen={Boolean(selectedOrder)}
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title="Order Details"
      />
    </div>
  );
}
