import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  MapPin, 
  ShieldCheck, 
  Truck, 
  Clock, 
  ChevronRight,
  ArrowRight,
  Activity,
  ShoppingBag,
  AlertCircle,
  Plus
} from 'lucide-react';
import { useLocation, LocationState } from '../../LocationContext';
import { useAuth } from '../../AuthContext';
import { api } from '../../services/api';
import { Pharmacy, SellerMedicine } from '../../types';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setLocation } = useLocation();
  const { user, profile } = useAuth();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [marketItems, setMarketItems] = useState<SellerMedicine[]>([]);
  const [pharmacyById, setPharmacyById] = useState<Record<string, Pharmacy>>({});
  const [marketLoading, setMarketLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [cartFeedback, setCartFeedback] = useState('');
  
  const [tempLocation, setTempLocation] = useState<LocationState>({
    country: 'India',
    state: 'Gujarat',
    city: 'Ahmedabad',
    area: 'Satellite',
    locality: 'Ramdevnagar',
    pincode: '380015',
    landmark: ''
  });

  const handleSetLocation = () => {
    setLocation(tempLocation);
    navigate('/discover');
  };

  useEffect(() => {
    const loadMarketplace = async () => {
      try {
        setMarketLoading(true);
        const [inventory, pharmacies] = await Promise.all([
          api.getInventory({}),
          api.getPharmacies({}),
        ]);
        const topItems = inventory
          .filter((item) => item.isVisible !== false && item.stock > 0 && (item as any).isActive !== false)
          .slice(0, 8);
        setMarketItems(topItems);
        setPharmacyById(
          pharmacies.reduce<Record<string, Pharmacy>>((acc, pharmacy) => {
            acc[pharmacy.id] = pharmacy;
            return acc;
          }, {})
        );
      } catch (error) {
        console.error('Failed to load marketplace preview:', error);
        setMarketItems([]);
        setPharmacyById({});
      } finally {
        setMarketLoading(false);
      }
    };
    loadMarketplace();
  }, []);

  const hasMarketItems = useMemo(() => marketItems.length > 0, [marketItems.length]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cart');
      const parsed = saved ? JSON.parse(saved) : [];
      const normalized = Array.isArray(parsed) ? parsed : [];
      const count = normalized.reduce((acc, item) => acc + (Number(item?.quantity) || 0), 0);
      setCartCount(count);
    } catch (error) {
      console.warn('Failed to parse cart for landing page badge', error);
      setCartCount(0);
    }
  }, []);

  const isLoggedInCustomer = Boolean(user && profile?.role === 'customer');

  const addToCart = (med: SellerMedicine) => {
    if (!isLoggedInCustomer) {
      window.alert('Please login to continue purchase.');
      navigate('/login', { state: { returnTo: '/' } });
      return;
    }

    let currentCart: any[] = [];
    try {
      const saved = localStorage.getItem('cart');
      const parsed = saved ? JSON.parse(saved) : [];
      currentCart = Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Failed to parse cart on landing add-to-cart; resetting', error);
      currentCart = [];
    }
    const cart: any[] = Array.isArray(currentCart) ? currentCart : [];

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
      localStorage.setItem('cart', JSON.stringify(replacementCart));
      setCartCount(1);
      setCartFeedback(`${med.name || 'Medicine'} added to cart`);
      return;
    }

    const newCart: any[] = [...cart];
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

    localStorage.setItem('cart', JSON.stringify(newCart));
    setCartCount(newCart.reduce((acc, item) => acc + (Number(item?.quantity) || 0), 0));
    setCartFeedback(`${med.name || 'Medicine'} added to cart`);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="h-20 border-b border-slate-100 flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-100">M</div>
          <span className="font-bold text-2xl text-slate-900 tracking-tight">MedSmart</span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/login" className="text-slate-600 font-semibold hover:text-emerald-600 transition-colors">Sign In</Link>
          <Link to="/register" className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-6 md:px-12 overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-bold mb-6">
              <Activity className="w-4 h-4" />
              Smart Location-Based Pharmacy Network
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-slate-900 leading-[1.1] mb-6">
              Medicines delivered to your <span className="text-emerald-600">doorstep</span>.
            </h1>
            <p className="text-xl text-slate-500 mb-10 max-w-lg leading-relaxed">
              Discover verified pharmacies near you based on your precise location. Upload prescriptions and get medicines in minutes.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button 
                onClick={() => setShowLocationModal(true)}
                className="w-full sm:w-auto px-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 flex items-center justify-center gap-2 text-lg"
              >
                <MapPin className="w-5 h-5" />
                Find Nearby Stores
              </button>
              <Link 
                to="/register"
                className="w-full sm:w-auto px-8 py-4 bg-white text-slate-900 font-bold rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 text-lg"
              >
                Join as Seller
                <ArrowRight className="w-5 h-5" />
              </Link>
              <button
                onClick={() => navigate('/discover')}
                className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-lg"
              >
                <ShoppingBag className="w-5 h-5" />
                Browse Medicines
              </button>
            </div>

            <div className="mt-12 flex items-center gap-8">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200 overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="" />
                  </div>
                ))}
              </div>
              <p className="text-sm text-slate-500 font-medium">
                <span className="text-slate-900 font-bold">10k+</span> Happy Customers
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="relative z-10 rounded-[40px] overflow-hidden shadow-2xl border-8 border-white">
              <img 
                src="https://picsum.photos/seed/pharmacy-hero/800/1000" 
                alt="Pharmacy" 
                className="w-full h-full object-cover aspect-[4/5]"
              />
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-100 rounded-full blur-3xl opacity-60"></div>
            <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-blue-100 rounded-full blur-3xl opacity-60"></div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-slate-50 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Why Choose MedSmart?</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">We've built a platform that prioritizes speed, security, and local serviceability.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Verified Stores', desc: 'Every pharmacy on our platform undergoes a rigorous verification process.', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { title: 'Fast Delivery', desc: 'Get your medicines delivered within 60 minutes from your local pharmacy.', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
              { title: '24/7 Support', desc: 'Our pharmacists are available around the clock for prescription reviews.', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' }
            ].map((f, i) => (
              <div key={i} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className={`w-14 h-14 ${f.bg} ${f.color} rounded-2xl flex items-center justify-center mb-6`}>
                  <f.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Marketplace Medicines</h2>
              <p className="text-slate-500 mt-1">Live items listed by sellers.</p>
              {cartFeedback && <p className="text-emerald-600 text-sm font-semibold mt-2">{cartFeedback}</p>}
            </div>
            <div className="flex items-center gap-4">
              {cartCount > 0 && (
                <button
                  onClick={() => navigate('/cart')}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold inline-flex items-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4" />
                  View Cart ({cartCount})
                </button>
              )}
              <Link to="/discover" className="text-emerald-600 font-semibold inline-flex items-center gap-2">
                Explore stores <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {marketLoading ? (
            <p className="text-slate-500">Loading marketplace…</p>
          ) : !hasMarketItems ? (
            <p className="text-slate-500">No seller medicines available yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {marketItems.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-2xl p-4 bg-white flex flex-col">
                  <div className="w-full aspect-square rounded-xl bg-slate-100 overflow-hidden mb-3">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">No image</div>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 line-clamp-1">{item.name || 'Medicine'}</h3>
                  <p className="text-sm text-slate-500">{item.category || 'General'}</p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description || 'No description available.'}</p>
                  {item.rxRequired && (
                    <p className="mt-2 text-[10px] font-bold uppercase text-red-600 inline-flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Prescription required
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    Seller: <span className="font-semibold text-slate-700">{pharmacyById[item.pharmacyId]?.name || 'Pharmacy'}</span>
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-bold text-emerald-700">₹{item.discountPrice || item.price}</span>
                    <span className="text-xs text-slate-500">{item.stock > 0 ? `Stock: ${item.stock}` : 'Out of stock'}</span>
                  </div>
                  <button
                    onClick={() => addToCart(item)}
                    className="mt-3 w-full px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 inline-flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add to Cart
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Location Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-slate-900">Set Delivery Location</h3>
                <button onClick={() => setShowLocationModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <ChevronRight className="w-6 h-6 rotate-90" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">State</label>
                    <select 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                      value={tempLocation.state}
                      onChange={(e) => setTempLocation({...tempLocation, state: e.target.value})}
                    >
                      <option>Gujarat</option>
                      <option>Maharashtra</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">City</label>
                    <select 
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                      value={tempLocation.city}
                      onChange={(e) => setTempLocation({...tempLocation, city: e.target.value})}
                    >
                      <option>Ahmedabad</option>
                      <option>Surat</option>
                      <option>Mumbai</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Area / Locality</label>
                  <input 
                    type="text"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. Satellite"
                    value={tempLocation.area}
                    onChange={(e) => setTempLocation({...tempLocation, area: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Pincode</label>
                  <input 
                    type="text"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g. 380015"
                    value={tempLocation.pincode}
                    onChange={(e) => setTempLocation({...tempLocation, pincode: e.target.value})}
                  />
                </div>
              </div>

              <button 
                onClick={handleSetLocation}
                className="w-full mt-8 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              >
                Confirm Location
              </button>
              <p className="mt-4 text-center text-xs text-slate-400">
                We use your location to show serviceable pharmacies only.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
