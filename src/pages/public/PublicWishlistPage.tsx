import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Heart, Search, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { api } from '../../services/api';
import { Pharmacy, SellerMedicine } from '../../types';
import { parseStoredCart } from '../../utils/safeCart';

const PublicWishlistPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [items, setItems] = useState<SellerMedicine[]>([]);
  const [pharmacyById, setPharmacyById] = useState<Record<string, Pharmacy>>({});

  const wishlistKey = `explore_wishlist_${profile?.uid || 'guest'}`;

  useEffect(() => {
    try {
      const parsed = parseStoredCart(localStorage.getItem(wishlistKey), 'PublicWishlistPage load');
      setWishlistIds(parsed.filter((id): id is string => typeof id === 'string'));
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
        setItems(visible.filter((item) => wishlistIds.includes(item.id)));
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

  const removeFromWishlist = (id: string) => {
    const next = wishlistIds.filter((itemId) => itemId !== id);
    setWishlistIds(next);
    localStorage.setItem(wishlistKey, JSON.stringify(next));
  };

  const addToCart = (med: SellerMedicine) => {
    const cart = parseStoredCart(localStorage.getItem('cart'), 'PublicWishlistPage addToCart');
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
      return;
    }

    const existing = newCart.findIndex((entry) => entry.id === med.id);
    if (existing !== -1) newCart[existing].quantity += 1;
    else {
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
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Wishlist</h1>
            <p className="text-slate-500">Saved products for later.</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search wishlist..." className="w-full text-sm outline-none" />
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading wishlist…</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
            <h3 className="text-xl font-bold text-slate-900">No items in wishlist</h3>
            <p className="text-slate-500 mt-1">Browse products and save medicines you like.</p>
            <Link to="/exploreproducts" className="inline-flex mt-4 px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold">Explore Products</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <div key={item.id} className="border border-slate-200 rounded-2xl p-4 bg-white flex flex-col">
                <div className="w-full aspect-square rounded-xl bg-slate-100 overflow-hidden mb-3">
                  {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">No image</div>}
                </div>
                <h3 className="font-bold text-slate-900 line-clamp-1">{item.name || 'Medicine'}</h3>
                <p className="text-sm text-slate-500">{item.category || 'General'}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description || 'No description available.'}</p>
                {item.rxRequired && (
                  <p className="mt-2 text-[10px] font-bold uppercase text-red-600 inline-flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Prescription required
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-2">Seller: <span className="font-semibold text-slate-700">{pharmacyById[item.pharmacyId]?.name || 'Pharmacy'}</span></p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-bold text-emerald-700">₹{item.discountPrice || item.price}</span>
                  <span className="text-xs text-slate-500">{item.stock > 0 ? `Stock: ${item.stock}` : 'Out of stock'}</span>
                </div>
                <button onClick={() => addToCart(item)} className="mt-3 w-full px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 inline-flex items-center justify-center gap-2">
                  <ShoppingBag className="w-4 h-4" /> Add to Cart
                </button>
                <button onClick={() => removeFromWishlist(item.id)} className="mt-2 w-full px-4 py-2 rounded-xl border border-rose-200 text-rose-600 font-semibold inline-flex items-center justify-center gap-2">
                  <Heart className="w-4 h-4" /> Remove
                </button>
                <button onClick={() => navigate(`/product-detailpage/${item.id}`)} className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50">View Details</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicWishlistPage;
