import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';
import { MedicineMaster, SellerMedicine } from '../../types';
import { logFlow } from '../../utils/flowLogger';
import { logUI } from '../../utils/uiLogger';

const InventoryManagement: React.FC = () => {
  const { profile } = useAuth();
  const [medicines, setMedicines] = useState<SellerMedicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pharmacyId, setPharmacyId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [masters, setMasters] = useState<MedicineMaster[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchInventory = async () => {
    if (!profile) return;
    try {
      setLoading(true);
      const pharmacies = await api.getPharmacies({ ownerId: profile.uid });
      if (pharmacies.length === 0) {
        setErrorMessage('No pharmacy found for this seller account.');
        setMedicines([]);
        return;
      }
      setErrorMessage('');
      const pId = pharmacies[0].id;
      setPharmacyId(pId);

      const inventory = await api.getInventory({ pharmacyId: pId });
      const medicineMasterData = await api.getMedicines({ includeAll: 'true' });
      setMasters(medicineMasterData as MedicineMaster[]);

      const enriched = await Promise.all(inventory.map(async (item: any) => {
        if (!item.medicineMasterId) {
          logFlow('INVENTORY_JOIN', {
            expected: ['medicineMasterId'],
            received: { itemId: item.id, medicineMasterId: item.medicineMasterId },
            success: false,
          });
        }
        const masterData = item.medicineMasterId
          ? await api.getMedicines({ id: item.medicineMasterId, includeAll: 'true' })
          : [];
        const resolvedMasterData = Array.isArray(masterData) ? masterData[0] : masterData;
        if (!resolvedMasterData) {
          logFlow('INVENTORY_JOIN', {
            expected: ['master data by medicineMasterId'],
            received: { itemId: item.id, medicineMasterId: item.medicineMasterId },
            success: false,
          });
        }
        return {
          ...item,
          masterData: resolvedMasterData
        };
      }));

      setMedicines(enriched);
      logFlow('INVENTORY_FETCH', {
        expected: ['pharmacy', 'inventory', 'medicine master'],
        received: { inventoryCount: enriched.length },
        success: true,
      });
    } catch (err: any) {
      logFlow('INVENTORY_FETCH', {
        expected: ['pharmacy', 'inventory', 'medicine master'],
        received: null,
        success: false,
        error: err,
      });
      setErrorMessage(err?.message || 'Error fetching inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [profile]);

  const handleCreateInventory = async () => {
    if (!profile?.uid) throw new Error('Seller profile not found');
    if (!pharmacyId) throw new Error('No pharmacy found');
    if (!selectedMasterId) {
      logFlow('CREATE_INVENTORY_FORM', {
        expected: ['medicineMasterId'],
        received: { medicineMasterId: selectedMasterId },
        success: false,
      });
      throw new Error('Please select a medicine from medicine master.');
    }
    const price = Number(newPrice);
    const stock = Number(newStock);
    if (!Number.isFinite(price) || !Number.isFinite(stock) || price <= 0 || stock < 0) {
      logFlow('CREATE_INVENTORY_FORM', {
        expected: ['price > 0', 'stock >= 0'],
        received: { price, stock },
        success: false,
      });
      throw new Error('Price must be > 0 and stock must be >= 0.');
    }
    await api.createInventoryEntry({
      pharmacyId,
      sellerId: profile.uid,
      medicineMasterId: selectedMasterId,
      price,
      stock,
      isVisible: true,
      isFeatured: false,
    });
    setSuccessMessage('Medicine submitted for admin approval.');
    logUI('CREATE_INVENTORY', { context: `Inventory created for ${selectedMasterId}`, success: true });
    setSelectedMasterId('');
    setNewPrice('');
    setNewStock('');
    await fetchInventory();
  };

  const handleEdit = async (item: any) => {
    const stock = Number(window.prompt('Update stock', String(item.stock)) || item.stock);
    const price = Number(window.prompt('Update price', String(item.price)) || item.price);
    try {
      logUI('EDIT_INVENTORY', { context: `Inventory ${item.id}`, success: true });
      const updated = await api.updateInventory(item.id, { stock, price });
      if (!updated) {
        throw new Error('Inventory update was not persisted.');
      }
      await fetchInventory();
    } catch (error) {
      setErrorMessage('Failed to update inventory item');
      logUI('EDIT_INVENTORY', { context: `Inventory ${item.id}`, success: false, reason: (error as Error)?.message || 'update failed' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this inventory item?')) return;
    try {
      logUI('DELETE_INVENTORY', { context: `Inventory ${id}`, success: true });
      const deleted = await api.deleteInventory(id);
      if (!deleted) {
        throw new Error('Inventory delete was not persisted.');
      }
      await fetchInventory();
    } catch (error) {
      setErrorMessage('Failed to delete inventory item');
      logUI('DELETE_INVENTORY', { context: `Inventory ${id}`, success: false, reason: (error as Error)?.message || 'delete failed' });
    }
  };

  const filtered = medicines.filter((m: any) =>
    (m.masterData?.brandName || m.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory Management</h1>
          <p className="text-slate-500 text-sm">Manage your medicine stock and pricing</p>
        </div>
        <span className="text-xs text-slate-500">Create inventory from medicine master only.</span>
      </div>

      {errorMessage && <div className="p-3 rounded-xl bg-amber-50 text-amber-700 text-sm font-medium">{errorMessage}</div>}
      {successMessage && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium">{successMessage}</div>}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 flex items-center gap-2"><Plus className="w-4 h-4" />Add Inventory Item</h3>
        {masters.length === 0 ? (
          <p className="text-sm text-amber-700">Medicine catalog is empty. Contact admin.</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (submitting) return;
              setSubmitting(true);
              setErrorMessage('');
              try {
                await handleCreateInventory();
              } catch (error: any) {
                setErrorMessage(error?.message || 'Failed to create inventory');
                logUI('CREATE_INVENTORY', { context: 'Inventory submit', success: false, reason: error?.message || 'submit failed' });
              } finally {
                setSubmitting(false);
              }
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <select
                value={selectedMasterId}
                onChange={(e) => {
                  setSelectedMasterId(e.target.value);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 md:col-span-2"
              >
                <option value="">Select medicine</option>
                {masters.map((master) => (
                  <option key={master.id} value={master.id}>
                    {master.brandName} ({master.genericName})
                  </option>
                ))}
              </select>
              <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} type="number" placeholder="Price" className="px-3 py-2 rounded-xl border border-slate-200" />
              <input value={newStock} onChange={(e) => setNewStock(e.target.value)} type="number" placeholder="Stock" className="px-3 py-2 rounded-xl border border-slate-200" />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-60"
              disabled={submitting || !selectedMasterId || masters.length === 0}
            >
              {submitting ? 'Saving…' : 'Save Inventory'}
            </button>
          </form>
        )}
        {!selectedMasterId && masters.length > 0 && (
          <p className="text-xs text-red-600">Please select a medicine to create inventory.</p>
        )}
        {selectedMasterId && (
          <div className="text-xs text-slate-600">
            {(() => {
              const selected = masters.find((master) => master.id === selectedMasterId);
              if (!selected) return null;
              return <span>Category: {selected.category} • Manufacturer: {selected.manufacturer} • Schedule: {selected.schedule}</span>;
            })()}
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search inventory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Medicine</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Stock</th>
                <th className="px-6 py-4 font-semibold">Price</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{item.masterData?.brandName || item.name}</p>
                    <p className="text-xs text-slate-500">{item.masterData?.genericName || '-'}</p>
                  </td>
                  <td className="px-6 py-4"><span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full">{item.masterData?.category || '-'}</span></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${item.stock < 20 ? 'text-red-600' : 'text-slate-900'}`}>{item.stock}</span>
                      {item.stock < 20 && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">₹{item.price}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${item.isVisible ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      {item.isVisible ? 'Visible' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleEdit(item)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryManagement;
