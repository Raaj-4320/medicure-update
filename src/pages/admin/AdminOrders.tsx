import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Eye, X } from 'lucide-react';
import { api } from '../../services/api';

const toDisplayName = (name?: string, email?: string, id?: string) => name || email || id || 'Unknown';

const AdminOrders: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [usersById, setUsersById] = useState<Record<string, any>>({});
  const [pharmaciesById, setPharmaciesById] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [allOrders, users, pharmacies] = await Promise.all([api.getOrders(), api.getUsers(), api.getPharmacies()]);
        setOrders(allOrders);
        setUsersById(
          users.reduce<Record<string, any>>((acc, user: any) => {
            acc[String(user.uid || user.id)] = user;
            return acc;
          }, {}),
        );
        setPharmaciesById(
          pharmacies.reduce<Record<string, any>>((acc, pharmacy: any) => {
            acc[String(pharmacy.id)] = pharmacy;
            return acc;
          }, {}),
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order: any) => {
      const customer = usersById[String(order.customerId)];
      const pharmacy = pharmaciesById[String(order.pharmacyId)];
      const medicines = (order.items || []).map((item: any) => String(item.medicineName || item.medicineId || '')).join(' ').toLowerCase();
      return (
        String(order.id || '').toLowerCase().includes(q) ||
        String(order.status || '').toLowerCase().includes(q) ||
        String(order.paymentStatus || '').toLowerCase().includes(q) ||
        toDisplayName(customer?.displayName, customer?.email, order.customerId).toLowerCase().includes(q) ||
        toDisplayName(pharmacy?.name, pharmacy?.email, order.pharmacyId).toLowerCase().includes(q) ||
        medicines.includes(q)
      );
    });
  }, [orders, pharmaciesById, searchQuery, usersById]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-500 text-sm">Full system order visibility for admin.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search id/customer/store/status..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Prescription</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">No orders found.</td>
                </tr>
              ) : (
                filteredOrders.map((order: any) => {
                  const customer = usersById[String(order.customerId)];
                  const pharmacy = pharmaciesById[String(order.pharmacyId)];
                  const rxStatus = order.prescriptionId ? (order.requiresPrescription ? 'Required' : 'Linked') : 'None';
                  return (
                    <tr key={order.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900">#{String(order.id).slice(-8)}</td>
                      <td className="px-4 py-3 text-slate-600">{order.createdAt ? new Date(order.createdAt).toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{toDisplayName(customer?.displayName, customer?.email, order.customerId)}</td>
                      <td className="px-4 py-3 text-slate-700">{toDisplayName(pharmacy?.name, pharmacy?.email, order.pharmacyId)}</td>
                      <td className="px-4 py-3 text-slate-700">{order.status || 'pending'}</td>
                      <td className="px-4 py-3 text-slate-700">{order.paymentStatus || 'unknown'}</td>
                      <td className="px-4 py-3 text-slate-700">{rxStatus}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">₹{Number(order.totalAmount || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5" /> Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Order Details #{String(selectedOrder.id).slice(-8)}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-slate-500 hover:text-slate-900"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <p><span className="font-semibold text-slate-800">Status:</span> {selectedOrder.status || 'pending'}</p>
                <p><span className="font-semibold text-slate-800">Payment Status:</span> {selectedOrder.paymentStatus || 'unknown'}</p>
                <p><span className="font-semibold text-slate-800">Payment Method:</span> {selectedOrder.paymentMethod || 'unknown'}</p>
                <p><span className="font-semibold text-slate-800">Transaction Ref:</span> {selectedOrder.transactionReference || '-'}</p>
                <p><span className="font-semibold text-slate-800">Customer ID:</span> {selectedOrder.customerId || '-'}</p>
                <p><span className="font-semibold text-slate-800">Pharmacy ID:</span> {selectedOrder.pharmacyId || '-'}</p>
                <p><span className="font-semibold text-slate-800">Prescription ID:</span> {selectedOrder.prescriptionId || '-'}</p>
                <p>
                  <span className="font-semibold text-slate-800">Prescription URL:</span>{' '}
                  {selectedOrder.prescriptionUrl ? (
                    <a className="text-emerald-600 hover:underline" href={selectedOrder.prescriptionUrl} target="_blank" rel="noreferrer">View</a>
                  ) : '—'}
                </p>
              </div>
              <div>
                <p className="font-semibold text-slate-800 mb-2">Items</p>
                <div className="space-y-1">
                  {(selectedOrder.items || []).length > 0 ? (selectedOrder.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between border border-slate-100 rounded-lg px-3 py-2">
                      <span>{item.medicineName || item.medicineId || 'Medicine'} × {Number(item.quantity || 0)}</span>
                      <span className="font-semibold">₹{Number(item.price || 0).toFixed(2)}</span>
                    </div>
                  )) : <p className="text-slate-500">No item details.</p>}
                </div>
              </div>
              <div>
                <p className="font-semibold text-slate-800 mb-1">Delivery Address</p>
                <p className="text-slate-700">
                  {[
                    selectedOrder.deliveryAddress?.addressLine,
                    selectedOrder.deliveryAddress?.locality,
                    selectedOrder.deliveryAddress?.area,
                    selectedOrder.deliveryAddress?.city,
                    selectedOrder.deliveryAddress?.state,
                    selectedOrder.deliveryAddress?.pincode,
                  ].filter(Boolean).join(', ') || 'Address not available'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 font-bold text-slate-900">Total: ₹{Number(selectedOrder.totalAmount || 0).toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
