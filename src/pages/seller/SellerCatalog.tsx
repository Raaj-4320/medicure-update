import React, { useEffect, useState } from 'react';
import { Edit2, Search, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';
import { logFlow } from '../../utils/flowLogger';

const SellerCatalog: React.FC = () => {
  const { profile } = useAuth();
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const loadData = async () => {
    if (!profile?.uid) return;
    const pharmacies = await api.getPharmacies({ ownerId: profile.uid });
    const pharmacy = pharmacies[0];
    if (!pharmacy) {
      setErrorMessage('No pharmacy found');
      setInventory([]);
      return;
    }
    setErrorMessage('');

    const [items, masters] = await Promise.all([
      api.getInventory({ pharmacyId: pharmacy.id }),
      api.getMedicines({ includeAll: 'true' }),
    ]);

    const joinedInventory = items.map((inv: any) => ({
      ...inv,
      masterData: masters.find((m: any) => m.id === inv.medicineMasterId) || null
    }));
    joinedInventory.forEach((item: any) => {
      if (!item.medicineMasterId || !item.masterData) {
        logFlow('INVENTORY_JOIN', {
          expected: ['medicineMasterId', 'masterData'],
          received: { itemId: item.id, medicineMasterId: item.medicineMasterId, hasMaster: Boolean(item.masterData) },
          success: false,
        });
      }
    });
    setInventory(joinedInventory);
    logFlow('CATALOG_LOAD', {
      expected: ['inventory joined with medicine_master'],
      received: { inventoryCount: joinedInventory.length },
      success: true,
    });
  };

  useEffect(() => {
    logFlow('CATALOG_ACTIONS_ENABLED', {
      expected: ['catalog edit and delete actions available'],
      received: { mode: 'live_actions' },
      success: true,
    });
    loadData().catch((e) => setErrorMessage(e?.message || 'Failed to load catalog'));
  }, [profile]);

  const filtered = inventory.filter((item: any) => `${item.masterData?.brandName || ''} ${item.masterData?.genericName || ''}`.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleEdit = async (item: any) => {
    const stock = Number(window.prompt('Update stock', String(item.stock)) || item.stock);
    const price = Number(window.prompt('Update price', String(item.price)) || item.price);
    try {
      setActionBusyId(item.id);
      const updated = await api.updateInventory(item.id, { stock, price });
      if (!updated) {
        throw new Error('Inventory update was not persisted.');
      }
      await loadData();
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to update product');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this product from your inventory?')) return;
    try {
      setActionBusyId(id);
      const deleted = await api.deleteInventory(id);
      if (!deleted) {
        throw new Error('Inventory delete was not persisted.');
      }
      await loadData();
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to delete product');
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Medicine Catalog</h1>
          <p className="text-slate-500 text-sm">Manage your store's medicine listings and pricing</p>
        </div>
        <p className="text-xs text-slate-500">Listings are created from Inventory only.</p>
      </div>

      {errorMessage && <div className="p-3 rounded-xl bg-amber-50 text-amber-700 text-sm font-medium">{errorMessage}</div>}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by brand or generic name..." className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((item: any) => (
          <motion.div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="relative h-40 bg-slate-50 p-4 flex items-center justify-center">
              <img src={item.masterData?.image || undefined} alt={item.masterData?.brandName} className="max-h-full max-w-full object-contain" />
              <div className="absolute top-3 right-3 px-2 py-1 text-[10px] font-bold rounded bg-white/90 text-slate-600">
                LIVE
              </div>
            </div>
            <div className="p-5 space-y-3">
              <h3 className="font-bold text-slate-900">{item.masterData?.brandName}</h3>
              <p className="text-xs text-slate-500 italic">{item.masterData?.genericName}</p>
              <div className="flex items-center justify-between text-sm"><span>₹{item.price}</span><span>Stock: {item.stock}</span></div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(item)}
                  disabled={actionBusyId === item.id}
                  className="p-2 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={actionBusyId === item.id}
                  className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SellerCatalog;
