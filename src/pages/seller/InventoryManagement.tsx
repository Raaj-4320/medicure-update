import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  ArrowUpRight,
  Pill,
  RefreshCw
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';
import { MedicineMaster, SellerMedicine } from '../../types';
import { logFlow, logRouteState } from '../../utils/flowLogger';
import { logUI } from '../../utils/uiLogger';
import SellerAccessState from '../../components/seller/SellerAccessState';

type EnrichedInventory = SellerMedicine & {
  masterData: MedicineMaster | null;
  updatedAt?: string;
  createdAt?: string;
};

const InventoryManagement: React.FC = () => {
  const { profile } = useAuth();
  const [medicines, setMedicines] = useState<EnrichedInventory[]>([]);
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
  const [accessState, setAccessState] = useState<'ok' | 'missing' | 'pending' | 'rejected'>('ok');

  const selectedMaster = useMemo(
    () => masters.find((master) => master.id === selectedMasterId) || null,
    [masters, selectedMasterId],
  );

  const fetchInventory = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErrorMessage('');
      logFlow('SELLER_INVENTORY_FETCH_START', {
        step: 'START',
        expected: ['pharmacy by ownerId', 'inventory by pharmacyId', 'medicine master join'],
        received: { ownerId: profile.uid },
        success: true,
      });

      const pharmacies = await api.getPharmacies({ ownerId: profile.uid });
      if (pharmacies.length === 0) {
        setErrorMessage('No pharmacy found for this seller account.');
        setMedicines([]);
        setAccessState('missing');
        logRouteState({ route: '/seller/inventory', state: 'blocked', reason: 'NO_PHARMACY' });
        return;
      }

      const pId = pharmacies[0].id;
      const pharmacyStatus = pharmacies[0].status || pharmacies[0].verificationStatus || 'pending';
      if (pharmacyStatus !== 'verified') {
        setMedicines([]);
        setAccessState(pharmacyStatus === 'rejected' ? 'rejected' : 'pending');
        logRouteState({ route: '/seller/inventory', state: 'blocked', reason: `PHARMACY_${String(pharmacyStatus).toUpperCase()}` });
        return;
      }

      setAccessState('ok');
      logRouteState({ route: '/seller/inventory', state: 'ok', detail: { pharmacyId: pId } });
      setPharmacyId(pId);

      const [inventoryResult, medicineMasterData] = await Promise.all([
        api.getInventory({ pharmacyId: pId }),
        api.getMedicines({ includeAll: 'true' }),
      ]);

      const inventory = Array.isArray(inventoryResult) ? inventoryResult : [];
      const masterList = Array.isArray(medicineMasterData) ? (medicineMasterData as MedicineMaster[]) : [];
      setMasters(masterList);

      const masterById = new Map(masterList.map((master) => [master.id, master]));
      const enriched: EnrichedInventory[] = inventory.map((item: any) => {
        const resolvedMasterData = item?.medicineMasterId ? masterById.get(item.medicineMasterId) || null : null;
        return {
          ...item,
          medicineMasterId: item?.medicineMasterId || item?.id,
          stock: Number(item?.stock ?? 0),
          price: Number(item?.price ?? 0),
          isVisible: Boolean(item?.isVisible ?? true),
          updatedAt: item?.updatedAt || item?.createdAt || '',
          createdAt: item?.createdAt || '',
          masterData: resolvedMasterData,
        };
      });

      const joinFailures = enriched.filter((item) => !item.masterData).length;
      logFlow('SELLER_INVENTORY_JOIN_RESULT', {
        expected: ['inventory entries joined with medicine master'],
        received: { inventoryCount: enriched.length, joinFailures },
        success: joinFailures === 0,
      });

      setMedicines(enriched);
      logFlow('SELLER_INVENTORY_FETCH_RESULT', {
        expected: ['inventory rendered for seller'],
        received: { inventoryCount: enriched.length, masterCount: masterList.length, pharmacyId: pId },
        success: true,
      });
    } catch (err: any) {
      logFlow('SELLER_INVENTORY_FETCH_RESULT', {
        expected: ['inventory rendered for seller'],
        received: null,
        success: false,
        error: err,
      });
      setErrorMessage(err?.message || 'Failed to load inventory.');
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
    if (!selectedMasterId) throw new Error('Please select a medicine from medicine master.');

    const price = Number(newPrice);
    const stock = Number(newStock);
    if (!Number.isFinite(price) || !Number.isFinite(stock) || price <= 0 || stock < 0) {
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

    setSuccessMessage('Inventory item added successfully.');
    logFlow('SELLER_INVENTORY_ADD_RESULT', {
      expected: ['new inventory item persisted'],
      received: { medicineMasterId: selectedMasterId, stock, price },
      success: true,
    });
    logUI('CREATE_INVENTORY', { context: `Inventory created for ${selectedMasterId}`, success: true });
    setSelectedMasterId('');
    setNewPrice('');
    setNewStock('');
    await fetchInventory();
  };

  const handleEdit = async (item: EnrichedInventory) => {
    const stock = Number(window.prompt('Update stock', String(item.stock)) || item.stock);
    const price = Number(window.prompt('Update price', String(item.price)) || item.price);
    try {
      logUI('EDIT_INVENTORY', { context: `Inventory ${item.id}`, success: true });
      await api.updateInventory(item.id, { stock, price });
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
      await api.deleteInventory(id);
      await fetchInventory();
    } catch (error) {
      setErrorMessage('Failed to delete inventory item');
      logUI('DELETE_INVENTORY', { context: `Inventory ${id}`, success: false, reason: (error as Error)?.message || 'delete failed' });
    }
  };

  const filtered = medicines.filter((item) => {
    const haystack = [
      item.masterData?.brandName,
      item.masterData?.genericName,
      item.masterData?.category,
      item.masterData?.dosageForm,
      item.masterData?.manufacturer,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(searchQuery.toLowerCase());
  });

  useEffect(() => {
    if (loading || accessState !== 'ok') return;
    logFlow('SELLER_INVENTORY_RENDER_STATE', {
      expected: ['inventory table or empty state'],
      received: { total: medicines.length, filtered: filtered.length, searchQuery },
      success: true,
    });
    if (medicines.length === 0) {
      logFlow('SELLER_INVENTORY_EMPTY_STATE', {
        expected: ['empty state card visible with add CTA'],
        received: { total: medicines.length },
        success: false,
      });
    }
  }, [loading, accessState, medicines.length, filtered.length, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-3" />
        <p className="text-slate-500 text-sm">Loading inventory...</p>
      </div>
    );
  }

  if (accessState !== 'ok') return <SellerAccessState mode={accessState} />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory Management</h1>
          <p className="text-slate-500 text-sm">Manage medicine stock, visibility, and pricing.</p>
        </div>
        <button
          onClick={fetchInventory}
          className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold flex items-center gap-2 hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-amber-50 text-amber-700 text-sm font-medium flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          <button onClick={fetchInventory} className="underline font-semibold">Retry</button>
        </div>
      )}
      {successMessage && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium">{successMessage}</div>}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 flex items-center gap-2"><Plus className="w-4 h-4" />Add Inventory Item</h3>
        {masters.length === 0 ? (
          <p className="text-sm text-amber-700">Medicine catalog is empty. Contact admin to add medicine master entries.</p>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (submitting) return;
              setSubmitting(true);
              setErrorMessage('');
              setSuccessMessage('');
              try {
                await handleCreateInventory();
              } catch (error: any) {
                setErrorMessage(error?.message || 'Failed to create inventory');
                logFlow('SELLER_INVENTORY_ADD_RESULT', {
                  expected: ['new inventory item persisted'],
                  received: { medicineMasterId: selectedMasterId },
                  success: false,
                  error,
                });
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
                onChange={(e) => setSelectedMasterId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 md:col-span-2"
              >
                <option value="">Select medicine</option>
                {masters.map((master) => (
                  <option key={master.id} value={master.id}>
                    {master.brandName} ({master.genericName}) • {master.category}
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

        {selectedMaster && (
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="font-semibold text-slate-700 mb-1">Selected medicine details</p>
            <p>
              {selectedMaster.brandName} • {selectedMaster.genericName} • {selectedMaster.category} • {selectedMaster.dosageForm} {selectedMaster.strength}
            </p>
            <p>
              Manufacturer: {selectedMaster.manufacturer || 'N/A'} • Rx: {selectedMaster.rxRequired ? 'Required' : 'Not required'}
            </p>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by medicine, generic, category, dosage..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 flex items-center gap-2" disabled>
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 flex items-center gap-2" disabled>
            <ArrowUpRight className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {medicines.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <Pill className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <h3 className="font-bold text-slate-900">No inventory yet</h3>
          <p className="text-sm text-slate-500 mt-1">Add your first medicine using the form above.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <h3 className="font-bold text-slate-900">No matches found</h3>
          <p className="text-sm text-slate-500 mt-1">Try a different search term.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Medicine</th>
                  <th className="px-6 py-4 font-semibold">Category / Form</th>
                  <th className="px-6 py-4 font-semibold">Stock</th>
                  <th className="px-6 py-4 font-semibold">Price</th>
                  <th className="px-6 py-4 font-semibold">Visibility</th>
                  <th className="px-6 py-4 font-semibold">Updated</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{item.masterData?.brandName || 'Unknown medicine'}</p>
                      <p className="text-xs text-slate-500">{item.masterData?.genericName || '-'} • {item.masterData?.manufacturer || 'Unknown manufacturer'}</p>
                      <p className="text-[11px] text-slate-400">Rx: {item.masterData?.rxRequired ? 'Required' : 'Not required'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full mr-2">{item.masterData?.category || '-'}</span>
                      <span className="text-xs text-slate-500">{item.masterData?.dosageForm || '-'} {item.masterData?.strength || ''}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${item.stock < 20 ? 'text-red-600' : 'text-slate-900'}`}>{item.stock}</span>
                        {item.stock < 20 && <AlertTriangle className="w-4 h-4 text-red-500" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">₹{Number(item.price || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${item.isVisible ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {item.isVisible ? 'Visible' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}</td>
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
      )}
    </div>
  );
};

export default InventoryManagement;
