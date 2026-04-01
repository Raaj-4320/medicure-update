import React, { useEffect, useState } from 'react';
import { Search, Pill } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';
import { logFlow } from '../../utils/flowLogger';

const SellerCatalog: React.FC = () => {
  const { profile } = useAuth();
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!profile?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const pharmacies = await api.getPharmacies({ ownerId: profile.uid });
    const pharmacy = pharmacies[0];
    if (!pharmacy) {
      setErrorMessage('No pharmacy found');
      setInventory([]);
      setLoading(false);
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
    setLoading(false);
  };

  useEffect(() => {
    logFlow('CATALOG_READ_ONLY', {
      expected: ['catalog view only'],
      received: { mode: 'read_only' },
      success: true,
    });
    loadData().catch((e) => {
      setErrorMessage(e?.message || 'Failed to load catalog');
      setLoading(false);
    });
  }, [profile]);

  const filtered = inventory.filter((item: any) => `${item.masterData?.brandName || ''} ${item.masterData?.genericName || ''} ${item.masterData?.category || ''} ${item.masterData?.dosageForm || ''}`.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Pill className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-sm text-slate-500">Loading catalog...</p>
      </div>
    );
  }

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

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <Pill className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <h3 className="font-bold text-slate-900">No catalog items found</h3>
          <p className="text-sm text-slate-500 mt-1">Add inventory items first or change your search.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((item: any) => (
          <motion.div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="relative h-40 bg-slate-50 p-4 flex items-center justify-center">
              <img src={item.masterData?.image || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=400&q=80'} alt={item.masterData?.brandName || 'Medicine'} className="max-h-full max-w-full object-contain" />
              <div className="absolute top-3 right-3 px-2 py-1 text-[10px] font-bold rounded bg-white/90 text-slate-600">
                READ ONLY
              </div>
            </div>
            <div className="p-5 space-y-3">
              <h3 className="font-bold text-slate-900">{item.masterData?.brandName}</h3>
              <p className="text-xs text-slate-500 italic">{item.masterData?.genericName}</p>
              <div className="flex items-center justify-between text-sm"><span>₹{Number(item.price || 0).toFixed(2)}</span><span>Stock: {item.stock}</span></div>
              <p className="text-[11px] text-slate-500">{item.masterData?.category || '-'} • {item.masterData?.dosageForm || '-'} {item.masterData?.strength || ''}</p>
              <p className="text-[11px] text-slate-500">Rx: {item.masterData?.rxRequired ? 'Required' : 'Not required'} • {item.masterData?.manufacturer || 'N/A'}</p>
              <p className="text-[11px] text-slate-500">Manage listing actions from Inventory page.</p>
            </div>
          </motion.div>
        ))}
      </div>
      )}
    </div>
  );
};

export default SellerCatalog;
