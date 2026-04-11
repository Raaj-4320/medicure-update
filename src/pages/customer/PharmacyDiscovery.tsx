import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  MapPin, 
  Star, 
  Clock, 
  Truck, 
  ShoppingBag,
  ChevronRight,
  Loader2,
  Store,
  Pill
} from 'lucide-react';
import { api } from '../../services/api';
import { useLocation } from '../../LocationContext';
import { Pharmacy, SellerMedicine } from '../../types';
import { checkExpectations, validateDataBinding } from '../../utils/flowLogger';
import { logDataFlow } from '../../utils/dataLogger';

const PharmacyDiscovery: React.FC = () => {
  const { location, setLocation } = useLocation();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [pharmacyMedicines, setPharmacyMedicines] = useState<Record<string, SellerMedicine[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchPharmacies = async () => {
      if (!location) {
        setLoading(false);
        return;
      }

      try {
        const [allPharmacies, inventory] = await Promise.all([api.getPharmaciesForCustomer(), api.getInventory({})]);
        const inventoryByPharmacy = inventory.reduce<Record<string, SellerMedicine[]>>((acc, item) => {
          if (item.isVisible === false) return acc;
          const pharmacyId = item.pharmacyId;
          if (!pharmacyId) return acc;
          if (!acc[pharmacyId]) acc[pharmacyId] = [];
          acc[pharmacyId].push(item);
          return acc;
        }, {});
        const filteredByLocation = allPharmacies.filter((pharmacy) => {
          const city = (pharmacy.address?.city || '').toLowerCase();
          const area = (pharmacy.address?.area || '').toLowerCase();
          const pincode = (pharmacy.address?.pincode || '').toLowerCase();
          const selectedCity = (location?.city || '').toLowerCase();
          const selectedArea = (location?.area || '').toLowerCase();
          const selectedPincode = (location?.pincode || '').toLowerCase();
          if (!selectedCity && !selectedArea && !selectedPincode) return true;
          return city === selectedCity || area === selectedArea || pincode === selectedPincode;
        });
        console.info('[DISCOVER_COUNTS]', {
          pharmaciesFetched: allPharmacies.length,
          inventoryFetched: inventory.length,
          pharmaciesAfterLocationFilter: filteredByLocation.length,
        });
        filteredByLocation.forEach((pharmacy) => {
          console.info('[DISCOVER_PHARMACY_MEDICINE_COUNT]', {
            pharmacyId: pharmacy.id,
            pharmacyName: pharmacy.name,
            medicineCount: (inventoryByPharmacy[pharmacy.id] || []).length,
          });
        });
        setPharmacies(filteredByLocation);
        setPharmacyMedicines(inventoryByPharmacy);
        checkExpectations({
          page: 'Customer',
          expected: ['pharmacies'],
          result: { pharmacies: allPharmacies },
        });
        logDataFlow('CUSTOMER_PHARMACIES', {
          source: 'FIRESTORE',
          requested: ['pharmacies'],
          received: filteredByLocation,
          rendered: filteredByLocation.length > 0,
          placeholder: filteredByLocation.length === 0,
          requiredFields: ['id', 'name'],
          route: '/customer/pharmacies',
          filters: { location: location?.city || 'unknown', query: searchQuery || '' },
        });
      } catch (err) {
        console.error('Error discovering pharmacies:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPharmacies();
  }, [location]);

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
          onClick={() => {
            const city = window.prompt('Enter city', 'Ahmedabad') || '';
            const area = window.prompt('Enter area', 'Satellite') || '';
            const pincode = window.prompt('Enter pincode', '380015') || '';
            if (!city || !area || !pincode) return;
            setLocation({
              country: 'India',
              state: 'Gujarat',
              city,
              area,
              locality: area,
              pincode,
              landmark: '',
            });
          }}
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
              <div className="h-48 relative overflow-hidden">
                <img 
                  src={pharmacy.image || undefined} 
                  alt={pharmacy.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
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
                <p className="text-xs text-slate-500 mb-3">
                  {(pharmacy.address?.area || 'Area not set')}, {(pharmacy.address?.city || 'City not set')}
                </p>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Medicines</span>
                    <span className="text-[11px] font-semibold text-slate-500">{(pharmacyMedicines[pharmacy.id] || []).length}</span>
                  </div>
                  {(pharmacyMedicines[pharmacy.id] || []).length > 0 ? (
                    <div className="space-y-1.5">
                      {(pharmacyMedicines[pharmacy.id] || []).slice(0, 3).map((medicine) => (
                        <div key={medicine.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 line-clamp-1 flex items-center gap-1">
                            <Pill className="w-3 h-3 text-slate-400" />
                            {medicine.name || 'Medicine'}
                          </span>
                          <span className="font-semibold text-emerald-700">₹{Number(medicine.discountPrice || medicine.price || 0)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No listed medicines.</p>
                  )}
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-slate-400 font-bold">Min Order</span>
                      <span className="text-sm font-bold text-slate-900">₹{pharmacy.minOrderValue}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-slate-400 font-bold">Delivery</span>
                      <span className="text-sm font-bold text-slate-900">₹{pharmacy.deliveryFee}</span>
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
