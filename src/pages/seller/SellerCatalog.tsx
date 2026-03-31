import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';
import { logFlow, logRouteState } from '../../utils/flowLogger';
import SellerAccessState from '../../components/seller/SellerAccessState';

const SellerCatalog: React.FC = () => {
  const { profile } = useAuth();
  const [inventory, setInventory] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [accessState, setAccessState] = useState<'ok' | 'missing' | 'pending' | 'rejected'>('ok');

  const loadData = async () => {
    if (!profile?.uid) return;
    const pharmacies = await api.getPharmacies({ ownerId: profile.uid });
    const pharmacy = pharmacies[0];
    if (!pharmacy) {
      setErrorMessage('No pharmacy found');
      setInventory([]);
      setAccessState('missing');
      logRouteState({ route: '/seller/catalog', state: 'blocked', reason: 'NO_PHARMACY' });
      return;
    }
    const pharmacyStatus = pharmacy.status || pharmacy.verificationStatus || 'pending';
    if (pharmacyStatus !== 'verified') {
      setInventory([]);
      setAccessState(pharmacyStatus === 'rejected' ? 'rejected' : 'pending');
      logRouteState({ route: '/seller/catalog', state: 'blocked', reason: `PHARMACY_${String(pharmacyStatus).toUpperCase()}` });
      return;
    }
    setAccessState('ok');
    logRouteState({ route: '/seller/catalog', state: 'ok', detail: { pharmacyId: pharmacy.id } });
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
    logFlow('CATALOG_READ_ONLY', {
      expected: ['catalog view only'],
      received: { mode: 'read_only' },
      success: true,
    });
    loadData().catch((e) => setErrorMessage(e?.message || 'Failed to load catalog'));
  }, [profile]);

  const filtered = inventory.filter((item: any) => `${item.masterData?.brandName || ''} ${item.masterData?.genericName || ''}`.toLowerCase().includes(searchQuery.toLowerCase()));
  if (accessState !== 'ok') return <SellerAccessState mode={accessState} />;

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
                READ ONLY
              </div>
            </div>
            <div className="p-5 space-y-3">
              <h3 className="font-bold text-slate-900">{item.masterData?.brandName}</h3>
              <p className="text-xs text-slate-500 italic">{item.masterData?.genericName}</p>
              <div className="flex items-center justify-between text-sm"><span>₹{item.price}</span><span>Stock: {item.stock}</span></div>
              <p className="text-[11px] text-slate-500">Manage listing actions from Inventory page.</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SellerCatalog;
