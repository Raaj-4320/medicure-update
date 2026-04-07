import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Star, 
  Clock, 
  Truck, 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus,
  Info,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { api } from '../../services/api';
import { Pharmacy, SellerMedicine } from '../../types';
import { parseStoredCart } from '../../utils/safeCart';

const PharmacyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [medicines, setMedicines] = useState<SellerMedicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        // 1. Fetch Pharmacy
        const pData = await api.getPharmacies({ id });
        if (Array.isArray(pData) && pData.length > 0) {
          setPharmacy(pData[0]);
        } else if (!Array.isArray(pData)) {
          setPharmacy(pData);
        }

        // 2. Fetch seller-owned medicines directly
        const sellerMedicines = await api.getInventory({ pharmacyId: id });
        setMedicines(sellerMedicines);
      } catch (err) {
        console.error('Error fetching pharmacy details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const filteredMeds = medicines.filter(m => 
    (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [cart, setCart] = useState<any[]>(() => {
    const saved = localStorage.getItem('cart');
    return parseStoredCart(saved, 'PharmacyDetail');
  });

  const addToCart = (med: SellerMedicine) => {
    if (cart.length > 0 && cart[0]?.pharmacyId && cart[0].pharmacyId !== med.pharmacyId) {
      const shouldReplace = window.confirm('Your cart contains items from another pharmacy. Replace cart with this pharmacy items?');
      if (!shouldReplace) return;
      const replacementCart = [{
        id: med.id,
        medicineId: med.id,
        sellerMedicineId: med.id,
        medicineName: med.name,
        brandName: med.name,
        price: med.discountPrice || med.price,
        quantity: 1,
        pharmacyId: med.pharmacyId,
        sellerId: med.sellerId,
        rxRequired: med.rxRequired,
        image: med.image,
      }];
      setCart(replacementCart);
      localStorage.setItem('cart', JSON.stringify(replacementCart));
      return;
    }
    const newCart = [...cart];
    const existingIndex = newCart.findIndex(item => item.id === med.id);
    
    if (existingIndex !== -1) {
      newCart[existingIndex].quantity += 1;
    } else {
      newCart.push({
        id: med.id,
        medicineId: med.id,
        sellerMedicineId: med.id,
        medicineName: med.name,
        brandName: med.name,
        price: med.discountPrice || med.price,
        quantity: 1,
        pharmacyId: med.pharmacyId,
        sellerId: med.sellerId,
        rxRequired: med.rxRequired,
        image: med.image,
      });
    }
    
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    // Optional: show toast or feedback
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>;
  if (!pharmacy) return <div>Pharmacy not found</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Discovery
        </button>
        
        {cart.length > 0 && (
          <button 
            onClick={() => navigate('/cart')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 animate-in fade-in slide-in-from-right-4"
          >
            <ShoppingBag className="w-4 h-4" />
            View Cart ({cart.reduce((acc, item) => acc + item.quantity, 0)})
          </button>
        )}
      </div>

      {/* Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-64 relative">
          <img src={pharmacy.image || undefined} alt={pharmacy.name || 'Profile Incomplete'} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <div className="absolute bottom-6 left-8 text-white">
            <h1 className="text-3xl font-bold mb-2">{pharmacy.name || 'Profile Incomplete'}</h1>
            <div className="flex items-center gap-4 text-sm font-medium">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                {pharmacy.rating.toFixed(1)} ({pharmacy.reviewCount} reviews)
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {pharmacy.operatingHours}
              </div>
              <div className="flex items-center gap-1">
                <Truck className="w-4 h-4" />
                ₹{pharmacy.deliveryFee} Delivery Fee
              </div>
            </div>
          </div>
        </div>
        <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">About Pharmacy</h3>
            <p className="text-slate-600 leading-relaxed">{pharmacy.description}</p>
          </div>
          <div className="flex flex-col gap-2 min-w-[200px]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Min. Order</span>
              <span className="font-bold text-slate-900">₹{pharmacy.minOrderValue}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Delivery Time</span>
              <span className="font-bold text-emerald-600">30-45 mins</span>
            </div>
          </div>
        </div>
      </div>

      {/* Medicines List */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-slate-900">Available Medicines</h2>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text"
              placeholder="Search medicines in this store..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMeds.map((med) => (
            <div key={med.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex gap-4 hover:border-emerald-200 transition-all">
              <div className="w-24 h-24 bg-slate-50 rounded-xl overflow-hidden flex-shrink-0">
                <img src={med.image || undefined} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h4 className="font-bold text-slate-900 truncate">{med.name}</h4>
                    <p className="text-xs text-slate-500 italic">{med.description || '-'}</p>
                  </div>
                  {med.rxRequired && (
                    <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded uppercase flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Rx
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{med.category || 'General'}</span>
                </div>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-slate-900">₹{med.discountPrice || med.price}</span>
                    {med.discountPrice && (
                      <span className="text-xs text-slate-400 line-through">₹{med.price}</span>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => addToCart(med)}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PharmacyDetail;
