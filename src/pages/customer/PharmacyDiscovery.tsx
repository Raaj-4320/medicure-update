import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  Star, 
  Clock, 
  Truck, 
  ShoppingBag,
  Filter,
  ChevronRight,
  Loader2,
  Store
} from 'lucide-react';
import { api } from '../../services/api';
import { useLocation } from '../../LocationContext';
import { Pharmacy } from '../../types';
import { checkExpectations, validateDataBinding } from '../../utils/flowLogger';
import { logDataFlow } from '../../utils/dataLogger';

const PharmacyDiscovery: React.FC = () => {
  const { location, setLocation } = useLocation();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryCountByPharmacy, setInventoryCountByPharmacy] = useState<Record<string, number>>({});

  const handleQuickLocationUpdate = () => {
    const city = window.prompt('Enter city', location?.city || 'Bangalore');
    if (!city) return;
    const area = window.prompt('Enter area/locality', location?.area || 'Downtown');
    if (!area) return;
    setLocation({
      country: location?.country || 'India',
      state: location?.state || 'Karnataka',
      city,
      area,
      locality: location?.locality || area,
      pincode: location?.pincode || '560001',
      landmark: location?.landmark || '',
    });
  };

  useEffect(() => {
    const fetchPharmacies = async () => {
      if (!location) {
        setLoading(false);
        return;
      }

      try {
        const allPharmacies = await api.getPharmaciesForCustomer();
        setPharmacies(allPharmacies);
        const inventoryCounts = Object.fromEntries(
          await Promise.all(
            allPharmacies.map(async (pharmacy) => {
              const inventory = await api.getInventory({ pharmacyId: pharmacy.id });
              const medsAvailable = (Array.isArray(inventory) ? inventory : []).filter((item: any) => Number(item?.stock ?? 0) > 0 && item?.isVisible !== false).length;
              return [pharmacy.id, medsAvailable];
            }),
          ),
        );
        setInventoryCountByPharmacy(inventoryCounts);
        checkExpectations({
          page: 'Customer',
          expected: ['pharmacies'],
          result: { pharmacies: allPharmacies },
        });
        logDataFlow('CUSTOMER_PHARMACIES', {
          source: 'FIRESTORE',
          requested: ['pharmacies'],
          received: allPharmacies,
          rendered: allPharmacies.length > 0,
          placeholder: allPharmacies.length === 0,
          requiredFields: ['id', 'name'],
          route: '/customer/pharmacies',
          filters: { location: location?.city || 'unknown', query: searchQuery || '' },
        });
      } catch (err) {
        setPharmacies([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPharmacies();
  }, [location, searchQuery]);

  const filteredList = pharmacies.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  if (searchQuery.trim() === '') {
    validateDataBinding({
      area: 'CustomerPharmacyDiscovery',
      dataCount: pharmacies.length,
      renderedCount: filteredList.length,
      expectedKeys: ['id', 'name', 'address'],
      sample: pharmacies[0],
    });
  }

  if (!location) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-6">
          <MapPin className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Location Not Set</h2>
        <p className="text-slate-500 max-w-md mb-8">Please set your delivery location to discover pharmacies that serve your area.</p>
        <button
          onClick={handleQuickLocationUpdate}
          className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-100"
        >
          Set Location
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Discover Pharmacies</h1>
          <p className="text-slate-500 text-sm">Showing pharmacies delivering to <span className="font-semibold text-emerald-600">{location.area}, {location.city}</span></p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Search pharmacy name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
          <button
            disabled
            title="Additional filters are not available in this demo build yet."
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 cursor-not-allowed"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : filteredList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredList.map((pharmacy) => (
            <Link 
              key={pharmacy.id} 
              to={`/pharmacy/${pharmacy.id}`}
              className="group bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all"
            >
              <div className="h-48 relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500">
                <div className="absolute top-4 right-4 px-2 py-1 bg-white/90 backdrop-blur rounded-lg flex items-center gap-1 text-xs font-bold text-slate-900">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  {pharmacy.rating.toFixed(1)}
                </div>
                {pharmacy.deliveryAvailable && (
                  <div className="absolute bottom-4 left-4 px-2 py-1 bg-emerald-600 text-white rounded-lg flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                    <Truck className="w-3 h-3" />
                    Fast Delivery
                  </div>
                )}
              </div>
              
              <div className="p-5">
                <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-emerald-600 transition-colors">{pharmacy.name || 'Profile Incomplete'}</h3>
                <p className="text-sm text-slate-500 mb-4 line-clamp-1">{pharmacy.description}</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-slate-400 font-bold">Meds Available</span>
                      <span className="text-sm font-bold text-slate-900">{inventoryCountByPharmacy[pharmacy.id] ?? 0}</span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <Store className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-900">No pharmacies available yet.</h3>
          <p className="text-slate-500">Please check back later once sellers complete setup.</p>
        </div>
      )}
    </div>
  );
};

export default PharmacyDiscovery;
