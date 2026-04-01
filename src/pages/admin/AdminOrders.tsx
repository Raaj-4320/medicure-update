import React, { useEffect, useState } from 'react';
import { ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { appLogger } from '../../utils/observability';
import OrderDetailsModal from '../../components/OrderDetailsModal';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});
  const [pharmacyNameMap, setPharmacyNameMap] = useState<Record<string, string>>({});


  const hydrateNames = async (orderList: any[]) => {
    const [users, pharmacies] = await Promise.all([api.getUsers(), api.getPharmacies()]);
    const customerIds = new Set(orderList.map((o: any) => String(o.customerId || '')).filter(Boolean));
    const pharmacyIds = new Set(orderList.map((o: any) => String(o.pharmacyId || '')).filter(Boolean));

    const nextUserMap: Record<string, string> = {};
    users.forEach((user: any) => {
      const id = String(user?.uid || user?.id || '');
      if (id && customerIds.has(id)) {
        nextUserMap[id] = user.displayName || user.name || user.fullName || id;
      }
    });

    const nextPharmacyMap: Record<string, string> = {};
    pharmacies.forEach((pharmacy: any) => {
      const id = String(pharmacy?.id || '');
      if (id && pharmacyIds.has(id)) {
        nextPharmacyMap[id] = pharmacy.name || pharmacy.storeName || pharmacy.shopName || id;
      }
    });

    setUserNameMap(nextUserMap);
    setPharmacyNameMap(nextPharmacyMap);
  };

  const fetchOrders = async () => {
    try {
      const data = await api.getOrders({});
      const sorted = data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(sorted);
      await hydrateNames(sorted);
    } catch (error) {
      appLogger.log({
        category: 'FIREBASE_QUERY',
        event: 'admin_get_orders_failure',
        status: 'failure',
        page: 'AdminOrders',
        message: 'Admin orders query failed.',
        error: appLogger.errorSummary(error),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-500">Monitor all orders across the platform</p>
        </div>
        <button onClick={() => { setLoading(true); fetchOrders(); }} className="px-4 py-2 border border-slate-200 rounded-xl bg-white flex items-center gap-2 text-sm font-semibold">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {loading && orders.length === 0 ? (
        <div className="py-20 flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
          <p className="text-slate-500">Loading orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No orders found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-900">#{order.id}</h3>
                  <p className="text-sm text-slate-500">{new Date(order.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-1">Customer: {userNameMap[String(order.customerId || '')] || order.customerId || '—'} • Pharmacy: {pharmacyNameMap[String(order.pharmacyId || '')] || order.pharmacyId || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600">₹{Number(order.totalAmount || 0).toFixed(2)}</p>
                  <p className="text-xs uppercase text-slate-500">{String(order.status || 'pending')}</p>
                  <button onClick={() => setSelectedOrder(order)} className="mt-3 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <OrderDetailsModal
        isOpen={Boolean(selectedOrder)}
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title="Admin Order Details"
        userNameMap={userNameMap}
        pharmacyNameMap={pharmacyNameMap}
      />
    </div>
  );
}
