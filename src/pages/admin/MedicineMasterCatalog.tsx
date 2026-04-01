import React, { useEffect, useState } from 'react';
import { CheckCircle, Edit2, Loader2, Plus, Search, Trash2, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import AddMedicineModal, { AddMedicineValues } from '../../components/medicine/AddMedicineModal';
import { logUI } from '../../utils/uiLogger';
import { checkExpectations, validateDataBinding } from '../../utils/flowLogger';
import { logDataFlow } from '../../utils/dataLogger';

const MedicineMasterCatalog: React.FC = () => {
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadMedicines = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getMedicines({ includeAll: 'true' });
      setMedicines(data);
      checkExpectations({
        page: 'AdminCatalog',
        expected: ['medicine_master'],
        result: { medicine_master: data },
      });
      logDataFlow('ADMIN_MEDICINE_MASTER', {
        source: 'FIRESTORE',
        requested: ['medicine_master'],
        received: data,
        rendered: data.length > 0,
        placeholder: data.length === 0,
        requiredFields: ['id', 'brandName'],
        route: '/admin/medicine-master',
        filters: { includeAll: true, search: search || '' },
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

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setUpdatingId(id);
    setError('');
    try {
      logUI('ACTION', {
        component: 'AdminCatalog',
        action: status === 'approved' ? 'Approve Medicine' : 'Reject Medicine',
        expected: 'should call API + update UI',
        status: 'working',
      });
      const updated = await api.updateMedicine(id, { status });
      if (!updated) {
        throw new Error('Medicine status update was not persisted.');
      }
      await loadMedicines();
    } catch (err: any) {
      setError(err?.message || 'Failed to update medicine status');
      logUI('ACTION', {
        component: 'AdminCatalog',
        action: status === 'approved' ? 'Approve Medicine' : 'Reject Medicine',
        expected: 'should call API + update UI',
        status: 'not_working',
        reason: err?.message || 'status update failed',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const editMedicine = async (medicine: any) => {
    const brandName = window.prompt('Medicine name', medicine.name || medicine.brandName || '') || medicine.name || medicine.brandName;
    const genericName = window.prompt('Generic name', medicine.genericName || '') || medicine.genericName;
    const category = window.prompt('Category', medicine.category || '') || medicine.category;
    const priceInput = window.prompt('Price', String(medicine.price ?? ''));
    const price = priceInput === null || priceInput === '' ? medicine.price : Number(priceInput);
    setUpdatingId(medicine.id);
    setError('');
    try {
      const updated = await api.updateMedicine(medicine.id, { brandName, genericName, category, price });
      if (!updated) {
        throw new Error('Medicine update was not persisted.');
      }
      await loadMedicines();
    } catch (err: any) {
      setError(err?.message || 'Failed to edit medicine');
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteMedicine = async (medicineId: string) => {
    if (!window.confirm('Delete this medicine from catalog?')) return;
    setUpdatingId(medicineId);
    setError('');
    try {
      const deleted = await api.deleteMedicine(medicineId);
      if (!deleted) {
        throw new Error('Medicine delete was not persisted.');
      }
      await loadMedicines();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete medicine');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = medicines.filter((m) =>
    `${m.name || m.brandName || ''} ${m.genericName || ''}`.toLowerCase().includes(search.toLowerCase())
  );
  if (search.trim() === '') {
    validateDataBinding({
      area: 'AdminCatalog',
      dataCount: medicines.length,
      renderedCount: filtered.length,
      expectedKeys: ['id', 'brandName', 'genericName'],
      sample: medicines[0],
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Medicine Master Catalog</h1>
          <p className="text-slate-500 text-sm">Review, add, and approve/reject medicines.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold">
          <Plus className="w-4 h-4" /> Add Medicine
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium">{error}</div>}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search medicine..." className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">No medicines found.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((med) => (
                <tr key={med.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-900">{med.name || med.brandName}</p>
                    <p className="text-xs text-slate-500">{med.genericName}</p>
                  </td>
                  <td className="px-4 py-3">{med.category || '-'}</td>
                  <td className="px-4 py-3">₹{med.price ?? '-'}</td>
                  <td className="px-4 py-3 capitalize">{med.status || 'approved'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button disabled={updatingId === med.id || med.status === 'approved'} onClick={() => updateStatus(med.id, 'approved')} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"><CheckCircle className="w-4 h-4" /></button>
                      <button disabled={updatingId === med.id || med.status === 'rejected'} onClick={() => updateStatus(med.id, 'rejected')} className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"><XCircle className="w-4 h-4" /></button>
                      <button disabled={updatingId === med.id} onClick={() => editMedicine(med)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50"><Edit2 className="w-4 h-4" /></button>
                      <button disabled={updatingId === med.id} onClick={() => deleteMedicine(med.id)} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
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
