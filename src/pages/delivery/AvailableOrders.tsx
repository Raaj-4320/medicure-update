import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  DollarSign, 
  ChevronRight, 
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { logUI } from '../../utils/uiLogger';
import { isPharmacyOperational } from '../../services/api';
import { logDataFlow } from '../../utils/dataLogger';

const AvailableOrders: React.FC = () => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptedOrderId, setAcceptedOrderId] = useState<string | null>(null);

  const fetchAvailableOrders = async () => {
    try {
      const readyOrders = await api.getOrders({ status: 'dispatched' });
      
      // 2. Get all active delivery assignments
      const assignments = await api.getDeliveryAssignments();
      const assignedOrderIds = assignments.map((a: any) => a.orderId);

      // 3. Filter orders that are not yet assigned
      const available = readyOrders.filter((o: any) => !assignedOrderIds.includes(o.id));
      setOrders(available);
      logDataFlow('DELIVERY_ORDERS', {
        source: 'FIRESTORE',
        requested: ['orders:dispatched'],
        received: available,
        rendered: available.length > 0,
        placeholder: available.length === 0,
        requiredFields: ['id', 'pharmacyId', 'status'],
        userId: profile?.uid,
        route: '/delivery/available-orders',
        filters: { status: 'dispatched' },
      });
    } catch (error) {
      console.error('Failed to fetch available orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvailableOrders();
    const unsubscribe = api.subscribeToOrders({ status: 'dispatched' }, () => {
      fetchAvailableOrders();
    });
    return () => unsubscribe();
  }, []);

  const handleAccept = async (orderId: string) => {
    setAcceptedOrderId(orderId);
    try {
      logUI('DELIVERY_ACCEPT', { context: `Accept order ${orderId}`, success: true });
      const [order] = await api.getOrders({ id: orderId });
      if (!order || order.status !== 'dispatched') {
        throw new Error('Order is not eligible for delivery acceptance.');
      }
      const pharmacies = await api.getPharmacies({ id: order.pharmacyId });
      const pharmacy = pharmacies[0];
      if (!pharmacy || !isPharmacyOperational(pharmacy as any)) {
        throw new Error('Delivery blocked: pharmacy is not operational.');
      }
      // 1. Create delivery assignment
      await api.createDeliveryAssignment({
        orderId,
        deliveryStaffId: profile?.uid,
        status: 'assigned'
      });

      // 2. Update order status to on_the_way (accepted)
      await api.updateOrder(orderId, { status: 'on_the_way' });

      setTimeout(() => {
        setOrders(orders.filter(o => o.id !== orderId));
        setAcceptedOrderId(null);
      }, 2000);
    } catch (error) {
      logUI('DELIVERY_ACCEPT', { context: `Accept order ${orderId}`, success: false, reason: (error as Error)?.message || 'accept failed' });
      console.error('Failed to accept order:', error);
      setAcceptedOrderId(null);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold text-slate-900">Available Orders</h2>
        <div className="flex gap-2">
          <button 
            onClick={() => { setLoading(true); fetchAvailableOrders(); }}
            className="p-2 bg-white rounded-xl border border-black/5 text-slate-600"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
            <p className="text-slate-500">Searching for orders...</p>
          </div>
        ) : (
          <AnimatePresence>
            {orders.map((order: any) => (
              <motion.div 
                key={order.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, x: 20 }}
                className={`bg-white p-5 rounded-3xl shadow-sm border border-black/5 relative overflow-hidden ${acceptedOrderId === order.id ? 'pointer-events-none' : ''}`}
              >
                {acceptedOrderId === order.id && (
                  <div className="absolute inset-0 bg-emerald-500/90 flex flex-col items-center justify-center z-20 text-white">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 12 }}
                    >
                      <CheckCircle2 size={48} />
                    </motion.div>
                    <p className="font-bold mt-2">Order Accepted!</p>
                    <p className="text-xs text-white/80">Redirecting to pickup...</p>
                  </div>
                )}

                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                      <MapPin size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Order #{order.id}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Pickup: Pharmacy ID {order.pharmacyId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-600 tracking-tight">₹40.00</div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payout</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 py-4 border-y border-slate-50 mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                      <Navigation size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Distance</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">2.5 km</div>
                  </div>
                  <div className="text-center border-x border-slate-50 px-2">
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                      <Clock size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Time</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">15 mins</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                      <DollarSign size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Type</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">{order.paymentMethod === 'cash' ? 'Cash' : 'Prepaid'}</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setOrders(orders.filter(o => o.id !== order.id));
                      logUI('DELIVERY_REJECT', { context: `Reject order ${order.id}`, success: true });
                    }}
                    className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95"
                  >
                    <XCircle size={18} />
                    Reject
                  </button>
                  <button 
                    onClick={() => handleAccept(order.id)}
                    className="flex-[2] bg-slate-900 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-slate-200"
                  >
                    Accept Order
                    <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {!loading && orders.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Search size={32} />
            </div>
            <h3 className="font-bold text-slate-900">No orders nearby</h3>
            <p className="text-sm text-slate-500 mt-1">Try moving to a busier area or wait for new requests.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvailableOrders;
