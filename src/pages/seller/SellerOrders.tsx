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
  RefreshCw,
  AlertCircle,
  Eye,
  ShieldAlert
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';
import { logFlow } from '../../utils/flowLogger';
import { logUI } from '../../utils/uiLogger';
import { resolveDisplayName } from '../../utils/displayName';

export default function SellerOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [subscriptionError, setSubscriptionError] = useState('');
  const [hasPharmacy, setHasPharmacy] = useState(true);
  const [prescriptionByOrderId, setPrescriptionByOrderId] = useState<Record<string, any>>({});

  const fetchOrders = async () => {
    try {
      setSubscriptionError('');
      logFlow('SELLER_ORDERS_FETCH_START', {
        expected: ['pharmacy lookup by ownerId', 'orders by pharmacyId'],
        received: { ownerId: profile?.uid || null },
        success: true,
      });
      let pharmacies = await api.getPharmacies({ ownerId: profile?.uid });
      let myPharmacy = pharmacies[0];
      if (!myPharmacy && profile?.uid) {
        await api.createPharmacy({
          id: profile.uid,
          ownerId: profile.uid,
          sellerId: profile.uid,
          name: `${profile.displayName || 'Seller'} Pharmacy`,
          email: profile.email || '',
          contactNumber: profile.phoneNumber || '',
          status: 'pending',
          verificationStatus: 'pending',
          description: '',
          address: {},
          operatingHours: '09:00-21:00',
        });
        pharmacies = await api.getPharmacies({ ownerId: profile.uid });
        myPharmacy = pharmacies[0];
      }
      if (!myPharmacy) {
        setHasPharmacy(false);
        setOrders([]);
        return;
      }
      setHasPharmacy(true);
      const data = await api.getOrders({ sellerId: profile?.uid || '', pharmacyId: myPharmacy.id });
      setOrders(data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      const prescriptions = await api.getPrescriptions({ pharmacyId: myPharmacy.id });
      const byOrderId = prescriptions.reduce<Record<string, any>>((acc, rx: any) => {
        const status = String(rx.status || 'under_review').toLowerCase();
        const normalizedStatus = status === 'pending' ? 'under_review' : status;
        const orderId = String(rx.orderId || '');
        if (orderId) acc[orderId] = { ...rx, status: normalizedStatus };
        return acc;
      }, {});
      data.forEach((order: any) => {
        if (order?.prescriptionId && !byOrderId[order.id]) {
          const linked = prescriptions.find((rx: any) => rx.id === order.prescriptionId);
          if (linked) {
            const status = String(linked.status || 'under_review').toLowerCase();
            byOrderId[order.id] = { ...linked, status: status === 'pending' ? 'under_review' : status };
          }
        }
      });
      setPrescriptionByOrderId(byOrderId);
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
      let pharmacies = await api.getPharmacies({ ownerId: profile?.uid });
      let myPharmacy = pharmacies[0];
      if (!myPharmacy && profile?.uid) {
        await api.createPharmacy({
          id: profile.uid,
          ownerId: profile.uid,
          sellerId: profile.uid,
          name: `${profile.displayName || 'Seller'} Pharmacy`,
          email: profile.email || '',
          contactNumber: profile.phoneNumber || '',
          status: 'pending',
          verificationStatus: 'pending',
          description: '',
          address: {},
          operatingHours: '09:00-21:00',
        });
        pharmacies = await api.getPharmacies({ ownerId: profile.uid });
        myPharmacy = pharmacies[0];
      }
      if (myPharmacy?.id) {
        unsubscribe = api.subscribeToOrders(
          { pharmacyId: myPharmacy.id },
          (liveOrders: any[]) => {
            const onlyMine = liveOrders.filter((order) =>
              (order.sellerId && order.sellerId === profile?.uid) ||
              (order.items || []).some((item: any) => item.sellerId === profile?.uid),
            );
            setOrders(onlyMine);
          },
          (error) => {
            setSubscriptionError(error?.message || 'Live order updates failed. Showing latest cached list.');
          },
        );
      }
    };
    init();
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [profile]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    const order = orders.find((entry) => entry.id === orderId);
    const rx = prescriptionByOrderId[orderId];
    const requiresPrescription = Boolean(order?.requiresPrescription || order?.prescriptionId || order?.prescriptionUrl);
    const blockedStatus = requiresPrescription && (!rx || rx.status !== 'approved');
    if (blockedStatus && (newStatus === 'approved' || newStatus === 'dispatched')) {
      const reason = !rx
        ? 'Prescription approval required before accepting this order.'
        : rx.status === 'rejected'
          ? 'Prescription was rejected. Order cannot proceed.'
          : 'Prescription is still under review. Approve it from Prescription Management first.';
      setErrorMessage(reason);
      return;
    }
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
      case 'approved': return 'bg-blue-100 text-blue-700';
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

  const getPrescriptionMeta = (order: any) => {
    const requiresPrescription = Boolean(order.requiresPrescription || order.prescriptionId || order.prescriptionUrl);
    const rx = prescriptionByOrderId[order.id] || null;
    const rxStatus = String(rx?.status || '').toLowerCase();
    if (!requiresPrescription) {
      return {
        requiresPrescription: false,
        state: 'not_required' as const,
        label: 'Not Required',
        chip: 'bg-slate-100 text-slate-600 border border-slate-200',
        blocked: false,
        reason: '',
      };
    }
    if (!rx) {
      return {
        requiresPrescription: true,
        state: 'missing' as const,
        label: 'Missing',
        chip: 'bg-red-50 text-red-700 border border-red-100',
        blocked: true,
        reason: 'Prescription missing. Cannot process this order.',
      };
    }
    if (rxStatus === 'approved') {
      return {
        requiresPrescription: true,
        state: 'approved' as const,
        label: 'Approved',
        chip: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
        blocked: false,
        reason: '',
      };
    }
    if (rxStatus === 'rejected') {
      return {
        requiresPrescription: true,
        state: 'rejected' as const,
        label: 'Rejected',
        chip: 'bg-red-50 text-red-700 border border-red-100',
        blocked: true,
        reason: 'Prescription rejected. Order cannot be dispatched.',
      };
    }
    return {
      requiresPrescription: true,
      state: 'under_review' as const,
      label: 'Pending Review',
      chip: 'bg-amber-50 text-amber-700 border border-amber-100',
      blocked: true,
      reason: 'Prescription approval required before accepting this order.',
    };
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
      {subscriptionError && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-700 text-sm font-medium">
          {subscriptionError}
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
                {(() => {
                  const rxMeta = getPrescriptionMeta(order);
                  const rx = prescriptionByOrderId[order.id];
                  const blockAccept = order.status === 'pending' && rxMeta.blocked;
                  const blockDispatch = order.status === 'approved' && rxMeta.blocked;
                  return (
                    <>
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
                    {rxMeta.requiresPrescription && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-slate-50 text-slate-600 border border-slate-200">
                          Prescription Required
                        </span>
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${rxMeta.chip}`}>
                          {rxMeta.label}
                        </span>
                        {order.prescriptionUrl && (
                          <button
                            onClick={() => window.open(order.prescriptionUrl, '_blank', 'noopener,noreferrer')}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase border border-slate-200 text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                        )}
                        {(rx?.id || order.prescriptionId) && (
                          <button
                            onClick={() => window.open('/seller/prescriptions', '_self')}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase border border-emerald-200 text-emerald-700 hover:bg-emerald-50 inline-flex items-center gap-1"
                          >
                            <ShieldAlert className="w-3 h-3" /> Review
                          </button>
                        )}
                      </div>
                    )}
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
                          onClick={() => updateStatus(order.id, 'approved')}
                          disabled={updatingId === order.id || blockAccept}
                          className={`px-6 py-2 text-sm font-bold rounded-xl transition-all ${
                            blockAccept
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100'
                          }`}
                        >
                          Approve Order
                        </button>
                      </>
                    )}
                    {order.status === 'approved' && (
                      <button 
                        onClick={() => updateStatus(order.id, 'dispatched')}
                        disabled={updatingId === order.id || blockDispatch}
                        className={`px-6 py-2 text-sm font-bold rounded-xl transition-all ${
                          blockDispatch
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        Dispatch Order
                      </button>
                    )}
                  </div>
                </div>

                {rxMeta.blocked && (order.status === 'pending' || order.status === 'approved') && (
                  <div className="mb-4 flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    <AlertCircle className="w-4 h-4" />
                    {rxMeta.reason}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Items</h4>
                    <div className="space-y-2">
                      {(order.items || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-slate-600">{item.medicineName || item.medicineId || item.medicineMasterId || 'Medicine'} x {item.quantity}</span>
                          <span className="font-bold text-slate-900">₹{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</span>
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
                      <p className="font-bold text-slate-900">
                        {resolveDisplayName({
                          name: order.customerName,
                          email: order.customerEmail,
                          id: order.customerId,
                          fallback: 'Customer',
                        })}
                      </p>
                      <p className="text-slate-500">Payment Method: {(order.paymentMethod || 'upi').replace('_', ' ').toUpperCase()}</p>
                      <p className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getPaymentColor(order.paymentStatus || 'pending')}`}>
                        Payment: {(order.paymentStatus || 'pending').replace('_', ' ').toUpperCase()}
                      </p>
                      {order.transactionReference && <p className="text-slate-500">Txn Ref: {order.transactionReference}</p>}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prescription</h4>
                    {rxMeta.requiresPrescription ? (
                      <div className={`flex items-center gap-2 text-sm font-bold ${
                        rxMeta.state === 'approved' ? 'text-emerald-600' : rxMeta.state === 'rejected' || rxMeta.state === 'missing' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        <CheckCircle2 className="w-4 h-4" />
                        Prescription {rxMeta.label}
                      </div>
                    ) : (
                      <div className="text-slate-400 text-sm italic">Not Required</div>
                    )}
                  </div>
                </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
