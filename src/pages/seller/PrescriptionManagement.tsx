import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  User,
  Clock,
  Loader2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Prescription } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';
import { resolveDisplayName } from '../../utils/displayName';

type RxRow = {
  prescription: Prescription;
  order: any | null;
};

const normalizeRxStatus = (status?: string): 'under_review' | 'approved' | 'rejected' => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return 'approved';
  if (normalized === 'rejected') return 'rejected';
  return 'under_review';
};

const PrescriptionManagement: React.FC = () => {
  const { profile } = useAuth();
  const [rows, setRows] = useState<RxRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'under_review' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRx, setSelectedRx] = useState<RxRow | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadPrescriptions = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const pharmacies = await api.getPharmacies({ ownerId: profile.uid });
      const pharmacyIds = new Set(pharmacies.map((pharmacy) => pharmacy.id));
      if (pharmacyIds.size === 0) {
        setRows([]);
        setErrorMessage('No pharmacy found for this seller account.');
        return;
      }

      setErrorMessage('');
      const [orders, prescriptions] = await Promise.all([
        api.getOrders(),
        api.getPrescriptions(),
      ]);

      const sellerOrders = orders.filter((order: any) => pharmacyIds.has(order.pharmacyId));
      const orderById = sellerOrders.reduce<Record<string, any>>((acc, order: any) => {
        acc[String(order.id)] = order;
        return acc;
      }, {});

      const linked = prescriptions
        .map((prescription) => {
          const directOrder = prescription.orderId ? orderById[String(prescription.orderId)] : null;
          const fallbackOrder = sellerOrders.find((order: any) => order.prescriptionId === prescription.id) || null;
          const resolvedOrder = directOrder || fallbackOrder;
          if (!resolvedOrder) return null;
          return {
            prescription: {
              ...prescription,
              status: normalizeRxStatus(prescription.status),
            } as Prescription,
            order: resolvedOrder,
          };
        })
        .filter(Boolean) as RxRow[];

      setRows(linked.sort((a, b) => b.prescription.createdAt.localeCompare(a.prescription.createdAt)));
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to fetch prescriptions');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrescriptions();
  }, [profile?.uid]);

  const filteredRows = useMemo(() => rows.filter(({ prescription, order }) => {
    const status = normalizeRxStatus(prescription.status);
    const matchesFilter = filter === 'all' || status === filter;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return matchesFilter;
    const medicineNames = (order?.items || []).map((item: any) => String(item.medicineName || item.medicineId || '')).join(' ').toLowerCase();
    const matchesSearch =
      prescription.id.toLowerCase().includes(q) ||
      String(order?.id || '').toLowerCase().includes(q) ||
      String(order?.customerName || order?.customerId || '').toLowerCase().includes(q) ||
      medicineNames.includes(q);
    return matchesFilter && matchesSearch;
  }), [rows, filter, searchQuery]);

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setProcessingId(id);
    setErrorMessage('');
    try {
      await api.updatePrescription(id, {
        status,
        reviewedBy: profile?.uid || '',
        reviewedAt: new Date().toISOString(),
      });
      await loadPrescriptions();
      setIsReviewModalOpen(false);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to update prescription');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Prescription Management</h1>
          <p className="text-slate-500 text-sm">Review prescriptions linked to your customer orders</p>
        </div>
      </div>

      {errorMessage && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium">{errorMessage}</div>}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Rx, order, customer, medicine..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 outline-none text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {(['all', 'under_review', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filter === f
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900">No prescriptions found</h3>
          <p className="text-slate-500 text-sm mt-1">Prescriptions uploaded during checkout will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredRows.map((row) => {
            const { prescription: rx, order } = row;
            const status = normalizeRxStatus(rx.status);
            return (
              <motion.div key={rx.id} layout className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Prescription</p>
                    <p className="font-bold text-slate-900">#{rx.id.slice(-8)}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                    status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                    status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>{status.replace('_', ' ')}</span>
                </div>

                <div className="text-sm text-slate-600 space-y-1">
                  <p><span className="font-semibold text-slate-800">Order:</span> #{order?.id}</p>
                  <p><span className="font-semibold text-slate-800">Customer:</span> {resolveDisplayName({ name: order?.customerName, id: order?.customerId, fallback: order?.customerId || 'Customer' })}</p>
                  <p><span className="font-semibold text-slate-800">Uploaded:</span> {new Date(rx.createdAt).toLocaleString()}</p>
                  <p><span className="font-semibold text-slate-800">Medicines:</span> {(order?.items || []).slice(0, 2).map((item: any) => item.medicineName || 'Medicine').join(', ') || '—'}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      if (!rx.imageUrl) {
                        setErrorMessage('Prescription file URL is missing for this record.');
                        return;
                      }
                      window.open(rx.imageUrl, '_blank', 'noopener,noreferrer');
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 inline-flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Prescription
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRx(row);
                      setIsReviewModalOpen(true);
                    }}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700"
                  >
                    View Order
                  </button>
                  {status !== 'approved' && (
                    <button
                      disabled={processingId === rx.id}
                      onClick={() => updateStatus(rx.id, 'approved')}
                      className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                    >Approve</button>
                  )}
                  {status !== 'rejected' && (
                    <button
                      disabled={processingId === rx.id}
                      onClick={() => updateStatus(rx.id, 'rejected')}
                      className="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-bold disabled:opacity-50"
                    >Reject</button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {isReviewModalOpen && selectedRx && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Order Linked to Prescription</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-500 hover:text-slate-700"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="text-sm space-y-2 text-slate-600">
              <p><span className="font-semibold text-slate-800">Order ID:</span> #{selectedRx.order?.id}</p>
              <p><span className="font-semibold text-slate-800">Status:</span> {selectedRx.order?.status || 'pending'}</p>
              <p><span className="font-semibold text-slate-800">Payment:</span> {selectedRx.order?.paymentStatus || 'pending'}</p>
              <p><span className="font-semibold text-slate-800">Total:</span> ₹{Number(selectedRx.order?.totalAmount || 0).toFixed(2)}</p>
              <div>
                <p className="font-semibold text-slate-800 mb-1">Medicines</p>
                <ul className="space-y-1">
                  {(selectedRx.order?.items || []).map((item: any, idx: number) => (
                    <li key={idx} className="text-slate-600">• {item.medicineName || 'Medicine'} x {item.quantity}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setIsReviewModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionManagement;
