import React, { useEffect, useState } from 'react';
import { Ban, CheckCircle2, Loader2, Plus, Search } from 'lucide-react';
import { api } from '../../services/api';
import AddMedicineModal, { AddMedicineValues } from '../../components/medicine/AddMedicineModal';
import { logUI } from '../../utils/uiLogger';
import { checkExpectations, validateDataBinding } from '../../utils/flowLogger';
import { logDataFlow } from '../../utils/dataLogger';

type CatalogRow = {
  id: string;
  image: string;
  medicineName: string;
  sellerName: string;
  quantity: number;
  price: number;
  blocked: boolean;
};

const MedicineMasterCatalog: React.FC = () => {
  const [medicines, setMedicines] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadMedicines = async () => {
    setLoading(true);
    setError('');
    try {
      const [inventory, pharmacies, users] = await Promise.all([
        api.getInventory({}),
        api.getPharmacies({}),
        api.getUsers(),
      ]);
      const pharmacyById = pharmacies.reduce<Record<string, any>>((acc, pharmacy) => {
        acc[pharmacy.id] = pharmacy;
        return acc;
      }, {});
      const userById = users.reduce<Record<string, any>>((acc, user) => {
        acc[user.uid] = user;
        return acc;
      }, {});

      const normalizedRows: CatalogRow[] = inventory.map((item) => {
        const pharmacy = pharmacyById[item.pharmacyId] || null;
        const sellerId = item.sellerId || pharmacy?.ownerId || pharmacy?.sellerId || '';
        const sellerName =
          pharmacy?.name ||
          userById[sellerId]?.displayName ||
          userById[sellerId]?.email ||
          'Unknown Seller';
        const status = String((item as any).status || '').toLowerCase();
        const blockedByStatus = ['blocked', 'rejected', 'inactive', 'disabled'].includes(status);
        const blockedByVisibility = item.isVisible === false;
        return {
          id: item.id,
          image: item.image || '',
          medicineName: item.name || item.masterData?.brandName || item.masterData?.genericName || 'Medicine',
          sellerName,
          quantity: Number(item.stock || 0),
          price: Number(item.discountPrice || item.price || 0),
          blocked: blockedByStatus || blockedByVisibility,
        };
      });

      setMedicines(normalizedRows);
      checkExpectations({
        page: 'AdminCatalog',
        expected: ['inventory'],
        result: { inventory: normalizedRows },
      });
      logDataFlow('ADMIN_MEDICINE_MASTER', {
        source: 'FIRESTORE',
        requested: ['medicines', 'pharmacies', 'users'],
        received: normalizedRows,
        rendered: normalizedRows.length > 0,
        placeholder: normalizedRows.length === 0,
        requiredFields: ['id', 'medicineName', 'sellerName', 'quantity', 'price'],
        route: '/admin/catalog',
        filters: { search: search || '' },
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to load medicines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedicines();
  }, []);

  const createMedicine = async (values: AddMedicineValues) => {
    logUI('ACTION', {
      component: 'AdminCatalog',
      action: 'Add Medicine',
      expected: 'should create medicine master entry',
      status: 'working',
    });
    await api.createMedicine({
      brandName: values.name,
      genericName: values.genericName,
      category: values.category,
      dosageForm: values.dosageForm,
      strength: values.strength,
      manufacturer: values.manufacturer,
      description: values.description,
      status: 'approved',
      rxRequired: false,
      schedule: 'None',
    });
    await loadMedicines();
  };

  const toggleBlockState = async (id: string, blocked: boolean) => {
    setUpdatingId(id);
    setError('');
    try {
      logUI('ACTION', {
        component: 'AdminCatalog',
        action: blocked ? 'Block Medicine' : 'Unblock Medicine',
        expected: 'should call API + update UI',
        status: 'working',
      });
      const ok = await api.setMedicineCatalogBlockState(id, blocked);
      if (!ok) throw new Error('Failed to update medicine state');
      setFeedback({ type: 'success', message: blocked ? 'Medicine blocked' : 'Medicine unblocked' });
      await loadMedicines();
    } catch (err: any) {
      setError(err?.message || 'Failed to update medicine status');
      setFeedback({ type: 'error', message: err?.message || 'Failed to update medicine status' });
      logUI('ACTION', {
        component: 'AdminCatalog',
        action: blocked ? 'Block Medicine' : 'Unblock Medicine',
        expected: 'should call API + update UI',
        status: 'not_working',
        reason: err?.message || 'status update failed',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = medicines.filter((m) =>
    `${m.medicineName || ''} ${m.sellerName || ''}`.toLowerCase().includes(search.toLowerCase())
  );
  if (search.trim() === '') {
    validateDataBinding({
      area: 'AdminCatalog',
      dataCount: medicines.length,
      renderedCount: filtered.length,
      expectedKeys: ['id', 'medicineName', 'sellerName', 'quantity', 'price'],
      sample: medicines[0],
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Medicine Master Catalog</h1>
          <p className="text-slate-500 text-sm">Review and manage active seller medicines.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold">
          <Plus className="w-4 h-4" /> Add Medicine
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium">{error}</div>}
      {feedback && (
        <div
          className={`p-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
          {feedback.message}
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medicine or seller..." className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">
          No medicines available in the system yet.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3">Image</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((med) => (
                <tr key={med.id} className={`border-t border-slate-100 ${med.blocked ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3 align-middle">
                    <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
                      {med.image ? (
                        <img src={med.image} alt={med.medicineName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500">No Image</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <p className="font-semibold text-slate-900">{med.medicineName || 'Unnamed'}</p>
                    <p className="text-xs text-slate-500">
                      {med.blocked ? <span className="inline-block px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold">Blocked</span> : 'Active'}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-middle text-sm text-slate-500">{med.sellerName || 'Unknown Seller'}</td>
                  <td className="px-4 py-3 align-middle font-medium text-slate-700">{med.quantity}</td>
                  <td className="px-4 py-3 align-middle font-bold text-emerald-700">{med.price > 0 ? `₹${Number(med.price).toFixed(2)}` : 'N/A'}</td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <button
                        disabled={updatingId === med.id}
                        onClick={() => toggleBlockState(med.id, !med.blocked)}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50 ${
                          med.blocked ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                        }`}
                      >
                        {updatingId === med.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                        {updatingId === med.id ? 'Updating…' : med.blocked ? 'Unblock Medicine' : 'Block Medicine'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddMedicineModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={createMedicine}
        role="admin"
      />
    </div>
  );
};

export default MedicineMasterCatalog;
