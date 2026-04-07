import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';

const SellerCatalog: React.FC = () => {
  const { profile } = useAuth();
  const [medicines, setMedicines] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = async () => {
    if (!profile?.uid) return;
    const pharmacies = await api.getPharmacies({ ownerId: profile.uid });
    const pharmacy = pharmacies[0];
    if (!pharmacy) {
      setErrorMessage('No pharmacy found');
      setMedicines([]);
      return;
    }
    setErrorMessage('');
    const items = await api.getInventory({ pharmacyId: pharmacy.id, sellerId: profile.uid });
    setMedicines(items);
  };

  useEffect(() => {
    loadData().catch((e) => setErrorMessage(e?.message || 'Failed to load catalog'));
  }, [profile]);

  const filtered = medicines.filter((item: any) =>
    `${item.name || ''} ${item.description || ''} ${item.category || ''}`.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Medicine Catalog</h1>
          <p className="text-slate-500 text-sm">Read-only view of your direct seller medicines</p>
        </div>
        <p className="text-xs text-slate-500">Manage create/edit/delete from Inventory page.</p>
      </div>

      {errorMessage && <div className="p-3 rounded-xl bg-amber-50 text-amber-700 text-sm font-medium">{errorMessage}</div>}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by name/category/description..." className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((item: any) => (
          <motion.div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="relative h-40 bg-slate-50 p-4 flex items-center justify-center">
              {item.image ? <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-400">No image</span>}
              <div className="absolute top-3 right-3 px-2 py-1 text-[10px] font-bold rounded bg-white/90 text-slate-600">
                READ ONLY
              </div>
            </div>
            <div className="p-5 space-y-3">
              <h3 className="font-bold text-slate-900">{item.name || 'Medicine'}</h3>
              <p className="text-xs text-slate-500 line-clamp-2">{item.description || '-'}</p>
              <div className="text-[11px] text-slate-500">Category: {item.category || 'General'} • Rx: {item.rxRequired ? 'Yes' : 'No'}</div>
              <div className="flex items-center justify-between text-sm"><span>₹{item.price}</span><span>Stock: {item.stock}</span></div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SellerCatalog;
