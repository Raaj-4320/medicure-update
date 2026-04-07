import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Heart, Search, ShoppingBag, User } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { api } from '../../services/api';
import { Pharmacy, SellerMedicine } from '../../types';
import { parseStoredCart } from '../../utils/safeCart';

const ExploreProducts: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [items, setItems] = useState<SellerMedicine[]>([]);
  const [pharmacyById, setPharmacyById] = useState<Record<string, Pharmacy>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');

  const isLoggedInCustomer = Boolean(user && profile?.role === 'customer');
  const wishlistKey = useMemo(() => `explore_wishlist_${profile?.uid || 'guest'}`, [profile?.uid]);

  const requireLogin = () => {
    window.alert('Please login to continue.');
    navigate('/login', { state: { returnTo: '/exploreproducts' } });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [inventory, pharmacies] = await Promise.all([api.getInventory({}), api.getPharmacies({})]);
        const visible = inventory.filter((item) => item.isVisible !== false && (item as any).isActive !== false);
        setItems(visible);
        setPharmacyById(
          pharmacies.reduce<Record<string, Pharmacy>>((acc, pharmacy) => {
            acc[pharmacy.id] = pharmacy;
            return acc;
          }, {}),
        );
      } catch (error) {
        console.error('Failed to load explore products data', error);
        setItems([]);
        setPharmacyById({});
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const normalized = parseStoredCart(localStorage.getItem('cart'), 'ExploreProducts badge');
    setCartCount(normalized.reduce((acc, item) => acc + (Number(item?.quantity) || 0), 0));
  }, []);

  useEffect(() => {
    if (!isLoggedInCustomer) {
      setWishlist([]);
      return;
    }
    try {
      const saved = localStorage.getItem(wishlistKey);
      const parsed = saved ? JSON.parse(saved) : [];
      setWishlist(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.warn('Failed to parse explore wishlist', error);
      setWishlist([]);
    }
  }, [isLoggedInCustomer, wishlistKey]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const sellerName = pharmacyById[item.pharmacyId]?.name || '';
      return (
        (item.name || '').toLowerCase().includes(query) ||
        (item.category || '').toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query) ||
        sellerName.toLowerCase().includes(query)
      );
    });
  }, [items, pharmacyById, searchQuery]);

  const addToCart = (med: SellerMedicine) => {
    if (!isLoggedInCustomer) {
      requireLogin();
      return;
    }

    const cart = parseStoredCart(localStorage.getItem('cart'), 'ExploreProducts addToCart');
    const newCart = [...cart];

    if (newCart.length > 0 && newCart[0]?.pharmacyId && newCart[0].pharmacyId !== med.pharmacyId) {
      const shouldReplace = window.confirm('Your cart has items from another pharmacy. Replace cart?');
      if (!shouldReplace) return;
      const replacement = [{
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
      localStorage.setItem('cart', JSON.stringify(replacement));
      setCartCount(1);
      setFeedback(`${med.name || 'Medicine'} added to cart`);
      return;
    }

    const existingIndex = newCart.findIndex((item) => item.id === med.id);
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
    setFeedback(`${med.name || 'Medicine'} added to cart`);
  };

  const toggleWishlist = (medicineId: string) => {
    if (!isLoggedInCustomer) {
      requireLogin();
      return;
    }
    setWishlist((prev) => {
      const next = prev.includes(medicineId) ? prev.filter((id) => id !== medicineId) : [...prev, medicineId];
      localStorage.setItem(wishlistKey, JSON.stringify(next));
      return next;
    });
  };

  const openDetails = (id: string) => {
    if (!isLoggedInCustomer) {
      requireLogin();
      return;
    }
    navigate(`/exploreproducts/${id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="h-20 border-b border-slate-100 bg-white flex items-center justify-between px-6 md:px-12 gap-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-100">M</div>
          <span className="font-bold text-2xl text-slate-900 tracking-tight">MedSmart</span>
        </Link>

        <div className="hidden md:flex items-center gap-3 max-w-xl flex-1">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search medicines, category, description, seller..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (!isLoggedInCustomer) return requireLogin();
            }}
            className="relative p-2 rounded-xl border border-slate-200 text-slate-600"
            title="Wishlist"
          >
            <Heart className="w-5 h-5" />
            {wishlist.length > 0 && <span className="absolute -top-2 -right-2 text-[10px] bg-rose-500 text-white rounded-full px-1.5">{wishlist.length}</span>}
          </button>
          <button
            onClick={() => {
              if (!isLoggedInCustomer) return requireLogin();
              navigate('/cart');
            }}
            className="relative p-2 rounded-xl border border-slate-200 text-slate-600"
            title="Cart"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && <span className="absolute -top-2 -right-2 text-[10px] bg-emerald-600 text-white rounded-full px-1.5">{cartCount}</span>}
          </button>
          <button
            onClick={() => navigate(isLoggedInCustomer ? '/dashboard' : '/login', isLoggedInCustomer ? undefined : { state: { returnTo: '/exploreproducts' } })}
            className="p-2 rounded-xl border border-slate-200 text-slate-600"
            title="Account"
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-10 px-6 md:px-12">
        <div className="mb-6 flex md:hidden items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search medicines, category, description, seller..."
            className="w-full text-sm outline-none"
          />
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Explore Products</h1>
            <p className="text-slate-500">Browse live medicines listed by sellers.</p>
            {feedback && <p className="text-emerald-600 text-sm font-semibold mt-2">{feedback}</p>}
          </div>
          {cartCount > 0 && (
            <button
              onClick={() => (isLoggedInCustomer ? navigate('/cart') : requireLogin())}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold inline-flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              View Cart ({cartCount})
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-slate-500">Loading products…</p>
        ) : items.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
            <h3 className="text-xl font-bold text-slate-900">No products yet</h3>
            <p className="text-slate-500 mt-2">Be the first seller to list medicines.</p>
            <Link to="/seller/register" className="inline-flex mt-4 px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold">Register as Seller</Link>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">No products match your search.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
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
                  className="mt-3 w-full px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700"
                >
                  Add to Cart
                </button>
                <button
                  onClick={() => toggleWishlist(item.id)}
                  className={`mt-2 w-full px-4 py-2 rounded-xl font-semibold border ${wishlist.includes(item.id) ? 'border-rose-300 text-rose-600' : 'border-slate-200 text-slate-600'}`}
                >
                  {wishlist.includes(item.id) ? 'Wishlisted' : 'Wishlist'}
                </button>
                <button
                  onClick={() => openDetails(item.id)}
                  className="mt-2 w-full px-4 py-2 rounded-xl font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ExploreProducts;
