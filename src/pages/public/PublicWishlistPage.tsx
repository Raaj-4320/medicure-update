import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckSquare, Heart, Search, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { api } from '../../services/api';
import { Pharmacy, SellerMedicine } from '../../types';
import { parseStoredCart } from '../../utils/safeCart';
import { getWishlistStorageKey, readWishlistAddedAt, readWishlistIds, writeWishlistIds } from '../../utils/wishlist';
import { resolveDisplayName } from '../../utils/displayName';
import PublicExploreHeader from '../../components/public/PublicExploreHeader';

const PublicWishlistPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [items, setItems] = useState<SellerMedicine[]>([]);
  const [pharmacyById, setPharmacyById] = useState<Record<string, Pharmacy>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addedAtMap, setAddedAtMap] = useState<Record<string, number>>({});
  const [cartCount, setCartCount] = useState(0);

  const wishlistKey = getWishlistStorageKey(profile?.uid);
  const isLoggedInCustomer = Boolean(profile?.role === 'customer');

  useEffect(() => {
    try {
      setWishlistIds(readWishlistIds(wishlistKey, 'PublicWishlistPage load'));
      setAddedAtMap(readWishlistAddedAt(profile?.uid));
      const cart = parseStoredCart(localStorage.getItem('cart'), 'PublicWishlistPage header');
      setCartCount(cart.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0));
    } catch (error) {
      console.warn('Failed to load wishlist', error);
      setWishlistIds([]);
    }
  }, [wishlistKey]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [inventory, pharmacies] = await Promise.all([api.getInventory({}), api.getPharmacies({})]);
        const visible = inventory.filter((item) => item.isVisible !== false && (item as any).isActive !== false);
        const wishlistSet = new Set(wishlistIds);
        const matched = visible.filter((item) => wishlistSet.has(item.id));
        const validIds = matched.map((item) => item.id);

        if (validIds.length !== wishlistIds.length) {
          const cleaned = writeWishlistIds(wishlistKey, validIds);
          setWishlistIds(cleaned);
        }

        setItems(matched);
        setPharmacyById(
          pharmacies.reduce<Record<string, Pharmacy>>((acc, pharmacy) => {
            acc[pharmacy.id] = pharmacy;
            return acc;
          }, {}),
        );
      } catch (error) {
        console.error('Failed to load wishlist products', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [wishlistIds]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const sellerName = pharmacyById[item.pharmacyId]?.name || '';
      return (
        (item.name || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        sellerName.toLowerCase().includes(q)
      );
    });
  }, [items, pharmacyById, searchQuery]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filteredIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedSet.has(id));
  const totalValue = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.discountPrice || item.price || 0), 0),
    [items],
  );

  const removeFromWishlist = (id: string) => {
    const next = wishlistIds.filter((itemId) => itemId !== id);
    setWishlistIds(writeWishlistIds(wishlistKey, next));
    setSelectedIds((prev) => prev.filter((selected) => selected !== id));
  };

  const upsertCartItem = (med: SellerMedicine) => {
    const cart = parseStoredCart(localStorage.getItem('cart'), 'PublicWishlistPage upsert cart');
    const nextCart = [...cart];
    const existing = nextCart.findIndex((entry) => entry.id === med.id);

    if (nextCart.length > 0 && nextCart[0]?.pharmacyId && nextCart[0].pharmacyId !== med.pharmacyId) {
      const shouldReplace = window.confirm('Your cart has items from another pharmacy. Replace cart?');
      if (!shouldReplace) return false;
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
      return true;
    }

    if (existing !== -1) nextCart[existing].quantity += 1;
    else {
      nextCart.push({
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
    localStorage.setItem('cart', JSON.stringify(nextCart));
    setCartCount(nextCart.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0));
    return true;
  };

  const addToCart = (med: SellerMedicine) => {
    upsertCartItem(med);
  };

  const moveToCart = (med: SellerMedicine) => {
    const added = upsertCartItem(med);
    if (!added) return;
    removeFromWishlist(med.id);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (allFilteredSelected ? prev.filter((id) => !filteredIds.includes(id)) : Array.from(new Set([...prev, ...filteredIds]))));
  };

  const removeSelected = () => {
    if (selectedSet.size === 0) return;
    const next = wishlistIds.filter((id) => !selectedSet.has(id));
    setWishlistIds(writeWishlistIds(wishlistKey, next));
    setSelectedIds([]);
  };

  const moveSelectedToCart = () => {
    if (selectedSet.size === 0) return;
    const selectedItems = items.filter((item) => selectedSet.has(item.id));
    const movedIds = new Set<string>();

    selectedItems.forEach((item) => {
      const added = upsertCartItem(item);
      if (added) movedIds.add(item.id);
    });

    if (movedIds.size > 0) {
      const next = wishlistIds.filter((id) => !movedIds.has(id));
      setWishlistIds(writeWishlistIds(wishlistKey, next));
      setSelectedIds((prev) => prev.filter((id) => !movedIds.has(id)));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicExploreHeader
        wishlistCount={wishlistIds.length}
        cartCount={cartCount}
        isLoggedInCustomer={isLoggedInCustomer}
        accountReturnTo="/wishlist"
        searchMode="redirect"
      />
      <div className="max-w-[1200px] mx-auto py-6 px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between mb-5 gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-slate-900">Wishlist</h1>
            <p className="text-slate-500">Saved products for later.</p>
            <p className="text-sm text-slate-600">
              {items.length} items • Total value ₹{totalValue.toFixed(2)}
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-2 w-full lg:max-w-md shadow-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search wishlist..." className="w-full text-sm outline-none" />
          </div>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="mb-5 bg-white border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center gap-2.5 shadow-sm">
            <button onClick={toggleSelectAll} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 inline-flex items-center gap-2">
              <CheckSquare className="w-4 h-4" /> {allFilteredSelected ? 'Deselect All' : 'Select All'}
            </button>
            <button onClick={removeSelected} disabled={selectedSet.size === 0} className="px-3 py-2 rounded-lg border border-rose-200 text-sm text-rose-600 disabled:opacity-50">
              Remove Selected
            </button>
            <button onClick={moveSelectedToCart} disabled={selectedSet.size === 0} className="px-3 py-2 rounded-lg border border-emerald-200 text-sm text-emerald-700 disabled:opacity-50">
              Move Selected to Cart
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Loading wishlist…</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 sm:p-10 text-center shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">No items in wishlist</h3>
            <p className="text-slate-500 mt-1">Browse products and save medicines you like.</p>
            <Link to="/exploreproducts" className="inline-flex mt-4 px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold">Explore Products</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
            {filtered.map((item) => (
              <div key={item.id} className="border border-slate-200 rounded-2xl p-4 bg-white flex flex-col shadow-sm hover:shadow-md transition-shadow">
                <label className="mb-2 inline-flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <input type="checkbox" checked={selectedSet.has(item.id)} onChange={() => toggleSelection(item.id)} />
                  Select
                </label>
                <div className="w-full aspect-[4/3] rounded-xl bg-slate-100 overflow-hidden mb-3 border border-slate-100">
                  {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">No image</div>}
                </div>
                <h3 className="font-bold text-slate-900 line-clamp-1 text-[15px]">{item.name || 'Medicine'}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{item.category || 'General'}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description || 'No description available.'}</p>
                {item.rxRequired && (
                  <p className="mt-2 text-[10px] font-bold uppercase text-red-600 inline-flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Prescription required
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
                  <span
                    className={`text-xs font-semibold ${
                      Number(item.stock || 0) <= 0 ? 'text-red-600' : Number(item.stock || 0) <= 5 ? 'text-amber-600' : 'text-emerald-700'
                    }`}
                  >
                    {Number(item.stock || 0) <= 0 ? 'Out of Stock' : Number(item.stock || 0) <= 5 ? 'Low Stock' : 'In Stock'}
                  </span>
                </div>
                {Number((item as any).price || 0) > Number(item.discountPrice || item.price || 0) && (
                  <p className="text-xs text-emerald-600 mt-1">Price dropped from ₹{Number((item as any).price).toFixed(2)}</p>
                )}
                {addedAtMap[item.id] ? (
                  <p className="text-xs text-slate-500 mt-1">
                    Added {Math.max(0, Math.floor((Date.now() - addedAtMap[item.id]) / (1000 * 60 * 60 * 24)))} days ago
                  </p>
                ) : null}
                <div className="mt-3 space-y-2">
                  <button onClick={() => addToCart(item)} className="w-full px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 inline-flex items-center justify-center gap-2">
                    <ShoppingBag className="w-4 h-4" /> Add to Cart
                  </button>
                  <button onClick={() => moveToCart(item)} className="w-full px-4 py-2 rounded-xl border border-emerald-200 text-emerald-700 font-semibold inline-flex items-center justify-center gap-2">
                    Move to Cart
                  </button>
                  <button onClick={() => removeFromWishlist(item.id)} className="w-full px-4 py-2 rounded-xl border border-rose-200 text-rose-600 font-semibold inline-flex items-center justify-center gap-2">
                    <Heart className="w-4 h-4" /> Remove
                  </button>
                  <button onClick={() => navigate(`/product-detailpage/${item.id}`)} className="w-full px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">View Details</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicWishlistPage;
