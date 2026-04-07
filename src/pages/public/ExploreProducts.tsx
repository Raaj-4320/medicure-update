import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, Heart, Search, ShoppingBag, User } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { api } from '../../services/api';
import { Pharmacy, SellerMedicine } from '../../types';
import { parseStoredCart } from '../../utils/safeCart';
import { resolveDisplayName } from '../../utils/displayName';

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
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceRange, setPriceRange] = useState<'all' | 'under100' | '100to500' | 'above500'>('all');
  const [rxFilter, setRxFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [inStockOnly, setInStockOnly] = useState(false);

  const isLoggedInCustomer = Boolean(user && profile?.role === 'customer');
  const wishlistKey = useMemo(() => `explore_wishlist_${profile?.uid || 'guest'}`, [profile?.uid]);

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
    try {
      const parsed = parseStoredCart(localStorage.getItem(wishlistKey), 'ExploreProducts wishlist');
      setWishlist(parsed.filter((id): id is string => typeof id === 'string'));
    } catch (error) {
      console.warn('Failed to parse explore wishlist', error);
      setWishlist([]);
    }
  }, [wishlistKey]);

  const categoryOptions = useMemo(() => {
    const unique = new Set(items.map((item) => (item.category || 'General').trim() || 'General'));
    return ['all', ...Array.from(unique)];
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    const base = items.filter((item) => {
      const sellerName = pharmacyById[item.pharmacyId]?.name || '';
      return (
        (item.name || '').toLowerCase().includes(query) ||
        (item.category || '').toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query) ||
        sellerName.toLowerCase().includes(query)
      );
    });
    return base;
  }, [items, pharmacyById, searchQuery]);

  const finalItems = useMemo(() => {
    return filteredItems.filter((item) => {
      const category = (item.category || 'General').trim() || 'General';
      const price = Number(item.discountPrice || item.price || 0);
      const rx = Boolean(item.rxRequired);
      const inStock = Number(item.stock || 0) > 0;

      const categoryMatch = selectedCategory === 'all' || category === selectedCategory;
      const priceMatch =
        priceRange === 'all' ||
        (priceRange === 'under100' && price < 100) ||
        (priceRange === '100to500' && price >= 100 && price <= 500) ||
        (priceRange === 'above500' && price > 500);
      const rxMatch = rxFilter === 'all' || (rxFilter === 'yes' ? rx : !rx);
      const stockMatch = !inStockOnly || inStock;

      return categoryMatch && priceMatch && rxMatch && stockMatch;
    });
  }, [filteredItems, selectedCategory, priceRange, rxFilter, inStockOnly]);

  const addToCart = (med: SellerMedicine) => {
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
    setWishlist((prev) => {
      const next = prev.includes(medicineId) ? prev.filter((id) => id !== medicineId) : [...prev, medicineId];
      localStorage.setItem(wishlistKey, JSON.stringify(next));
      return next;
    });
  };

  const openDetails = (id: string) => {
    navigate(`/product-detailpage/${id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="h-20 border-b border-slate-100 bg-white flex items-center justify-between px-6 md:px-12 gap-4 sticky top-0 z-40">
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
              navigate('/wishlist');
            }}
            className="relative p-2 rounded-xl border border-slate-200 text-slate-600"
            title="Wishlist"
          >
            <Heart className="w-5 h-5" />
            {wishlist.length > 0 && <span className="absolute -top-2 -right-2 text-[10px] bg-rose-500 text-white rounded-full px-1.5">{wishlist.length}</span>}
          </button>
          <button
            onClick={() => {
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
              onClick={() => navigate('/cart')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold inline-flex items-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              View Cart ({cartCount})
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <aside className="bg-white border border-slate-200 rounded-2xl p-4 h-fit lg:sticky lg:top-24 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Filters</h3>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
              {categoryOptions.map((option) => (
                <option key={option} value={option}>{option === 'all' ? 'All Categories' : option}</option>
              ))}
            </select>
            <select value={priceRange} onChange={(e) => setPriceRange(e.target.value as any)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
              <option value="all">All Prices</option>
              <option value="under100">Under ₹100</option>
              <option value="100to500">₹100 - ₹500</option>
              <option value="above500">Above ₹500</option>
            </select>
            <select value={rxFilter} onChange={(e) => setRxFilter(e.target.value as any)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm">
              <option value="all">Rx + Non-Rx</option>
              <option value="yes">Prescription required</option>
              <option value="no">No prescription</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-slate-200 w-full">
              <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
              In stock only
            </label>
          </aside>

          <section>
            {loading ? (
              <p className="text-slate-500">Loading products…</p>
            ) : items.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
                <h3 className="text-xl font-bold text-slate-900">No products yet</h3>
                <p className="text-slate-500 mt-2">Be the first seller to list medicines.</p>
                <Link to="/seller/register" className="inline-flex mt-4 px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold">Register as Seller</Link>
              </div>
            ) : finalItems.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">No products match your search.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {finalItems.map((item) => (
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
                      Seller:{' '}
                      <span className="font-semibold text-slate-700">
                        {resolveDisplayName({
                          name: pharmacyById[item.pharmacyId]?.name,
                          email: pharmacyById[item.pharmacyId]?.email,
                          id: item.pharmacyId,
                          fallback: 'Pharmacy',
                        })}
                      </span>
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-bold text-emerald-700">₹{item.discountPrice || item.price}</span>
                      <span className="text-xs text-slate-500">{item.stock > 0 ? 'Available' : 'Out of stock'}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        onClick={() => addToCart(item)}
                        className="w-10 h-10 rounded-xl bg-emerald-600 text-white inline-flex items-center justify-center hover:bg-emerald-700"
                        title="Add to cart"
                      >
                        <ShoppingBag className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleWishlist(item.id)}
                        className={`w-10 h-10 rounded-xl border inline-flex items-center justify-center ${wishlist.includes(item.id) ? 'border-rose-300 text-rose-600' : 'border-slate-200 text-slate-600'}`}
                        title="Wishlist"
                      >
                        <Heart className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDetails(item.id)}
                        className="w-10 h-10 rounded-xl border border-slate-200 text-slate-700 inline-flex items-center justify-center hover:bg-slate-50"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default ExploreProducts;
