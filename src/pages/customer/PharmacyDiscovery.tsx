import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  MapPin,
  Star,
  Truck,
  ChevronRight,
  Loader2,
  Store,
  Pill,
  X,
} from 'lucide-react';
import { api, getPharmacyAddressParts } from '../../services/api';
import { useLocation } from '../../LocationContext';
import { Pharmacy, SellerMedicine } from '../../types';
import { checkExpectations, validateDataBinding } from '../../utils/flowLogger';
import { logDataFlow } from '../../utils/dataLogger';

type LocationOption = {
  key: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  label: string;
  pharmacyCount: number;
};

const normalizeText = (value?: string) => (value || '').trim().toLowerCase();

const PharmacyDiscovery: React.FC = () => {
  const { location, setLocation } = useLocation();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [pharmacyMedicines, setPharmacyMedicines] = useState<Record<string, SellerMedicine[]>>({});
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const renderLocationPickerModal = () => {
    if (!isLocationModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl text-left">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Select Location</h3>
            <button onClick={() => setIsLocationModalOpen(false)} className="text-slate-500 hover:text-slate-900">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto space-y-2">
            {locationOptions.length > 0 ? (
              locationOptions.map((option) => (
                <button
                  key={option.key}
                  onClick={() => {
                    setLocation({
                      country: 'India',
                      state: option.state || 'Unknown',
                      city: option.city || '',
                      area: option.area || option.city || '',
                      locality: option.area || option.city || '',
                      pincode: option.pincode || '',
                      landmark: '',
                    });
                    setIsLocationModalOpen(false);
                  }}
                  className="w-full text-left px-3 py-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                >
                  <p className="text-sm font-semibold text-slate-900">{option.label} ({option.pharmacyCount} {option.pharmacyCount === 1 ? 'pharmacy' : 'pharmacies'})</p>
                  <p className="text-xs text-slate-500">{[option.city, option.pincode].filter(Boolean).join(' • ')}</p>
                </button>
              ))
            ) : (
              <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">No pharmacy locations available yet.</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const fetchPharmacies = async () => {
      try {
        const [allPharmacies, inventory] = await Promise.all([api.getPharmaciesForCustomer(), api.getInventory({})]);

        const optionsMap = allPharmacies.reduce<Record<string, LocationOption>>((acc, pharmacy) => {
          const addressParts = getPharmacyAddressParts(pharmacy as any);
          const area = (addressParts.localArea || pharmacy.address?.area || pharmacy.address?.locality || addressParts.addressLine || '').trim();
          const city = (addressParts.city || pharmacy.address?.city || '').trim();
          const state = (addressParts.state || pharmacy.address?.state || '').trim();
          const pincode = (addressParts.pincode || pharmacy.address?.pincode || (pharmacy.address as any)?.zip || '').trim();
          if (!area && !city && !pincode) return acc;

          const key = `${normalizeText(area)}|${normalizeText(city)}|${normalizeText(state)}|${normalizeText(pincode)}`;
          if (!key.replace(/\|/g, '')) return acc;

          if (!acc[key]) {
            acc[key] = {
              key,
              area,
              city,
              state,
              pincode,
              label: [area, city].filter(Boolean).join(', ') || pincode,
              pharmacyCount: 0,
            };
          }
          acc[key].pharmacyCount += 1;
          return acc;
        }, {});

        setLocationOptions(
          Object.values(optionsMap).sort((a, b) => {
            if (b.pharmacyCount !== a.pharmacyCount) return b.pharmacyCount - a.pharmacyCount;
            return a.label.localeCompare(b.label);
          }),
        );

        const inventoryByPharmacy = inventory.reduce<Record<string, SellerMedicine[]>>((acc, item) => {
          if (item.isVisible === false) return acc;
          const pharmacyId = item.pharmacyId;
          if (!pharmacyId) return acc;
          if (!acc[pharmacyId]) acc[pharmacyId] = [];
          acc[pharmacyId].push(item);
          return acc;
        }, {});

        const filteredByLocation = allPharmacies.filter((pharmacy) => {
          if (!location) return true;
          const addressParts = getPharmacyAddressParts(pharmacy as any);
          const city = normalizeText(addressParts.city || pharmacy.address?.city || '');
          const area = normalizeText(addressParts.localArea || pharmacy.address?.area || pharmacy.address?.locality || addressParts.addressLine);
          const pincode = normalizeText(addressParts.pincode || pharmacy.address?.pincode || (pharmacy.address as any)?.zip || '');
          const selectedCity = normalizeText(location?.city);
          const selectedArea = normalizeText(location?.area || location?.locality);
          const selectedPincode = normalizeText(location?.pincode);

          if (!selectedCity && !selectedArea && !selectedPincode) return true;
          if (selectedArea && area) return area === selectedArea;
          if (!selectedArea && selectedCity && city) return city === selectedCity;
          if (selectedPincode && pincode) return pincode === selectedPincode;

          return city.includes(selectedCity) || selectedCity.includes(city) || area.includes(selectedArea) || selectedArea.includes(area);
        });

        const resolvedByLocation = filteredByLocation.length > 0 ? filteredByLocation : allPharmacies;
        setPharmacies(resolvedByLocation);
        setPharmacyMedicines(inventoryByPharmacy);

        checkExpectations({ page: 'Customer', expected: ['pharmacies'], result: { pharmacies: allPharmacies } });
        logDataFlow('CUSTOMER_PHARMACIES', {
          source: 'FIRESTORE',
          requested: ['pharmacies'],
          received: filteredByLocation,
          rendered: resolvedByLocation.length > 0,
          placeholder: resolvedByLocation.length === 0,
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

  const filteredList = pharmacies.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
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
        <p className="text-slate-500 max-w-md mb-8">Please choose your delivery location to discover nearby pharmacies.</p>
        <button
          onClick={() => setIsLocationModalOpen(true)}
          className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-100"
        >
          Choose Location
        </button>
        {renderLocationPickerModal()}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Discover Pharmacies</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-slate-500 text-sm">
              Delivering to <span className="font-semibold text-emerald-600">{location.area}, {location.city}</span>
            </p>
            <button
              onClick={() => setIsLocationModalOpen(true)}
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-0.5 hover:bg-emerald-100 transition-colors"
            >
              Change
            </button>
          </div>
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
          {filteredList.map((pharmacy) => {
            const addressParts = getPharmacyAddressParts(pharmacy as any);
            return (
              <Link
                key={pharmacy.id}
                to={`/pharmacy/${pharmacy.id}`}
                className="group bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">{pharmacy.name || 'Profile Incomplete'}</h3>
                    <div className="px-2 py-1 bg-slate-50 rounded-lg flex items-center gap-1 text-xs font-bold text-slate-900 shrink-0">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      {pharmacy.rating.toFixed(1)}
                    </div>
                  </div>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-1">{pharmacy.description}</p>
                  <p className="text-xs text-slate-500 mb-3">{addressParts.localArea || pharmacy.address?.area || 'Area not set'}, {addressParts.city || pharmacy.address?.city || 'City not set'}</p>
                  {pharmacy.deliveryAvailable && (
                    <div className="inline-flex mb-4 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg items-center gap-1 text-[10px] font-bold uppercase tracking-wider border border-emerald-100">
                      <Truck className="w-3 h-3" />
                      Fast Delivery
                    </div>
                  )}

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
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <Store className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-900">No pharmacies available yet.</h3>
          <p className="text-slate-500">Please check back later once sellers complete setup.</p>
        </div>
      )}
      {renderLocationPickerModal()}
    </div>
  );
};

export default PharmacyDiscovery;
