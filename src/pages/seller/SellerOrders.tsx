import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Package, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';
import { logFlow } from '../../utils/flowLogger';
import { logUI } from '../../utils/uiLogger';

export default function SellerOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasPharmacy, setHasPharmacy] = useState(true);

  const fetchOrders = async () => {
    try {
      logFlow('SELLER_ORDERS_FETCH_START', {
        expected: ['pharmacy lookup by ownerId', 'orders by pharmacyId'],
        received: { ownerId: profile?.uid || null },
        success: true,
      });
      const pharmacies = await api.getPharmacies({ ownerId: profile?.uid });
      const myPharmacy = pharmacies[0];
      if (!myPharmacy) {
        setHasPharmacy(false);
        setOrders([]);
        logFlow('SELLER_ORDERS_FETCH', {
          expected: ['pharmacy for seller'],
          received: { ownerId: profile?.uid || null, hasPharmacy: false },
          success: false,
        });
        return;
      }
      setHasPharmacy(true);
      const data = await api.getOrders({ pharmacyId: myPharmacy.id });
      setOrders(data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      logFlow('SELLER_ORDERS_FETCH', {
        expected: ['orders for pharmacyId'],
        received: { pharmacyId: myPharmacy.id, count: data.length },
        success: true,
      });
    } catch (error) {
      logFlow('SELLER_ORDERS_FETCH', {
        expected: ['orders for pharmacyId'],
        received: null,
        success: false,
        error,
      });
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    const init = async () => {
      await fetchOrders();
      const pharmacies = await api.getPharmacies({ ownerId: profile?.uid });
      const myPharmacy = pharmacies[0];
      if (myPharmacy?.id) {
        unsubscribe = api.subscribeToOrders({ pharmacyId: myPharmacy.id }, (liveOrders: any[]) => {
          setOrders(liveOrders);
        });
      }
    };
    init();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [profile]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    setErrorMessage('');
    try {
      logUI('ORDER_STATUS_UPDATE', { context: `Seller ${newStatus} for ${orderId}`, success: true });
      await api.updateOrder(orderId, { status: newStatus });
      await fetchOrders();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to update order status');
      logUI('ORDER_STATUS_UPDATE', { context: `Seller ${newStatus} for ${orderId}`, success: false, reason: error?.message || 'Update failed' });
      console.error('Failed to update order status:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'confirmed': return 'bg-blue-100 text-blue-700';
      case 'packed': return 'bg-indigo-100 text-indigo-700';
      case 'dispatched': return 'bg-purple-100 text-purple-700';
      case 'delivered': return 'bg-slate-100 text-slate-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getPaymentColor = (status: string) => {
    if (status === 'successful') return 'text-emerald-700 bg-emerald-50';
    if (status === 'failed') return 'text-red-700 bg-red-50';
    if (status === 'pending' || status === 'processing' || status === 'initiated') return 'text-amber-700 bg-amber-50';
    return 'text-slate-700 bg-slate-50';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Management</h1>
          <p className="text-slate-500">Manage and track your pharmacy orders</p>
        </div>
        <button 
          onClick={() => { setLoading(true); fetchOrders(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {!hasPharmacy && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-700 text-sm font-medium">
          No pharmacy found for this seller account.
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
          <p className="text-slate-500">Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-1">No orders yet</h3>
          <p className="text-slate-500">New orders will appear here as they arrive.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">#{order.id}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {order.status === 'pending' && (
                      <>
                        <button 
                          onClick={() => updateStatus(order.id, 'cancelled')}
                          disabled={updatingId === order.id}
                          className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          Reject
                        </button>
                        <button 
                          onClick={() => updateStatus(order.id, 'confirmed')}
                          disabled={updatingId === order.id}
                          className="px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                        >
                          Confirm Order
                        </button>
                      </>
                    )}
                    {order.status === 'confirmed' && (
                      <button 
                        onClick={() => updateStatus(order.id, 'packed')}
                        disabled={updatingId === order.id}
                        className="px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all"
                      >
                        Mark Packed
                      </button>
                    )}
                    {order.status === 'packed' && (
                      <button 
                        onClick={() => updateStatus(order.id, 'dispatched')}
                        disabled={updatingId === order.id}
                        className="px-6 py-2 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-all"
                      >
                        Dispatch Order
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Items</h4>
                    <div className="space-y-2">
                      {order.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-slate-600">Medicine ID: {item.medicineId} x {item.quantity}</span>
                          <span className="font-bold text-slate-900">₹{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="pt-2 flex justify-between font-bold text-slate-900">
                        <span>Total Amount</span>
                        <span className="text-emerald-600">₹{order.totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer</h4>
                    <div className="text-sm">
                      <p className="font-bold text-slate-900">User ID: {order.customerId}</p>
                      <p className="text-slate-500">Payment Method: {(order.paymentMethod || 'upi').replace('_', ' ').toUpperCase()}</p>
                      <p className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getPaymentColor(order.paymentStatus || 'pending')}`}>
                        Payment: {(order.paymentStatus || 'pending').replace('_', ' ').toUpperCase()}
                      </p>
                      {order.transactionReference && <p className="text-slate-500">Txn Ref: {order.transactionReference}</p>}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prescription</h4>
                    {order.prescriptionUrl ? (
                      <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        Verified Prescription
                      </div>
                    ) : (
                      <div className="text-slate-400 text-sm italic">Not Required</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
