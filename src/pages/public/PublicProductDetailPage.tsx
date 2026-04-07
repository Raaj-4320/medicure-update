import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Heart, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { api } from '../../services/api';
import { Pharmacy, SellerMedicine } from '../../types';
import { parseStoredCart } from '../../utils/safeCart';

const PublicProductDetailPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [item, setItem] = useState<SellerMedicine | null>(null);
  const [sellerName, setSellerName] = useState('Pharmacy');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [recentlyViewed, setRecentlyViewed] = useState<SellerMedicine[]>([]);

  const isLoggedInCustomer = Boolean(user && profile?.role === 'customer');
  const wishlistKey = `explore_wishlist_${profile?.uid || 'guest'}`;
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const parsed = parseStoredCart(localStorage.getItem(wishlistKey), 'PublicProductDetailPage wishlist');
      setWishlistIds(parsed.filter((id): id is string => typeof id === 'string'));
    } catch {
      setWishlistIds([]);
    }
  }, [wishlistKey]);

  useEffect(() => {
    const load = async () => {
      if (!productId) return;
      try {
        setLoading(true);
        const inventory = await api.getInventory({});
        const visible = inventory.filter((entry) => entry.isVisible !== false && (entry as any).isActive !== false);
        const found = visible.find((entry) => entry.id === productId) || null;
        setItem(found);
        if (found?.pharmacyId) {
          const pharmacies = await api.getPharmacies({ id: found.pharmacyId });
          const pharmacy = pharmacies[0] as Pharmacy | undefined;
          setSellerName(pharmacy?.name || 'Pharmacy');
        }

        const recentIds = parseStoredCart(localStorage.getItem('recently_viewed_products'), 'PublicProductDetailPage recent')
          .filter((id): id is string => typeof id === 'string');
        const nextIds = [productId, ...recentIds.filter((id) => id !== productId)].slice(0, 8);
        localStorage.setItem('recently_viewed_products', JSON.stringify(nextIds));
        setRecentlyViewed(visible.filter((entry) => nextIds.includes(entry.id) && entry.id !== productId).slice(0, 6));
      } catch (error) {
        console.error('Failed to load product detail', error);
        setErrorMessage('Unable to load product details right now.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [productId]);

  const addToCart = () => {
    if (!item) return;
    const cart = parseStoredCart(localStorage.getItem('cart'), 'PublicProductDetailPage addToCart');
    const next = [...cart];

    if (next.length > 0 && next[0]?.pharmacyId && next[0].pharmacyId !== item.pharmacyId) {
      const shouldReplace = window.confirm('Your cart has items from another pharmacy. Replace cart?');
      if (!shouldReplace) return;
      const replacement = [{
        id: item.id,
        medicineId: item.id,
        sellerMedicineId: item.id,
        medicineName: item.name,
        brandName: item.name,
        price: item.discountPrice || item.price,
        quantity: 1,
        pharmacyId: item.pharmacyId,
        sellerId: item.sellerId,
        rxRequired: item.rxRequired,
        image: item.image,
      }];
      localStorage.setItem('cart', JSON.stringify(replacement));
      return;
    }

    const existing = next.findIndex((entry) => entry.id === item.id);
    if (existing !== -1) next[existing].quantity += 1;
    else next.push({
      id: item.id,
      medicineId: item.id,
      sellerMedicineId: item.id,
      medicineName: item.name,
      brandName: item.name,
      price: item.discountPrice || item.price,
      quantity: 1,
      pharmacyId: item.pharmacyId,
      sellerId: item.sellerId,
      rxRequired: item.rxRequired,
      image: item.image,
    });
    localStorage.setItem('cart', JSON.stringify(next));
  };

  const toggleWishlist = () => {
    if (!item) return;
    const next = wishlistIds.includes(item.id) ? wishlistIds.filter((id) => id !== item.id) : [...wishlistIds, item.id];
    setWishlistIds(next);
    localStorage.setItem(wishlistKey, JSON.stringify(next));
  };

  if (loading) return <div className="min-h-screen bg-slate-50 p-6 text-slate-500">Loading product details…</div>;

  if (!item || errorMessage) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Link to="/exploreproducts" className="inline-flex items-center gap-2 text-emerald-600 font-semibold mb-4"><ArrowLeft className="w-4 h-4" /> Back</Link>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-600">{errorMessage || 'Product not found.'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-6 md:px-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <Link to="/exploreproducts" className="inline-flex items-center gap-2 text-emerald-600 font-semibold"><ArrowLeft className="w-4 h-4" /> Back to products</Link>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="w-full aspect-square rounded-2xl bg-slate-100 overflow-hidden">
            {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400">No image</div>}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{item.name || 'Medicine'}</h1>
            <p className="text-slate-500 mt-1">{item.category || 'General'}</p>
            <p className="text-slate-600 mt-4 leading-relaxed">{item.description || 'No description available.'}</p>
            {item.rxRequired && <p className="mt-4 text-xs font-bold uppercase text-red-600 inline-flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Prescription required</p>}
            <p className="mt-4 text-sm text-slate-600">Seller: <span className="font-semibold text-slate-800">{sellerName}</span></p>
            <p className="mt-2 text-sm text-slate-600">Stock: {item.stock > 0 ? item.stock : 0}</p>
            <p className="mt-4 text-3xl font-bold text-emerald-700">₹{item.discountPrice || item.price}</p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button onClick={addToCart} className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 inline-flex items-center justify-center gap-2"><ShoppingBag className="w-4 h-4" /> Add to Cart</button>
              <button onClick={toggleWishlist} className={`px-5 py-3 rounded-xl border font-semibold inline-flex items-center justify-center gap-2 ${wishlistIds.includes(item.id) ? 'border-rose-300 text-rose-600' : 'border-slate-300 text-slate-700'}`}><Heart className="w-4 h-4" /> {wishlistIds.includes(item.id) ? 'Wishlisted' : 'Wishlist'}</button>
              <button
                onClick={() => {
                  if (!isLoggedInCustomer) {
                    window.alert('Please login to complete purchase.');
                    navigate('/login', { state: { returnTo: `/product-detailpage/${item.id}` } });
                    return;
                  }
                  addToCart();
                  navigate('/checkout');
                }}
                className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>

        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Recently Viewed Products</h2>
          {recentlyViewed.length === 0 ? (
            <p className="text-slate-500">No recently viewed products yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentlyViewed.map((recent) => (
                <button key={recent.id} onClick={() => navigate(`/product-detailpage/${recent.id}`)} className="text-left bg-white border border-slate-200 rounded-2xl p-3 hover:border-emerald-200">
                  <div className="w-full aspect-square rounded-xl bg-slate-100 overflow-hidden mb-2">
                    {recent.image ? <img src={recent.image} alt={recent.name} className="w-full h-full object-cover" /> : null}
                  </div>
                  <p className="font-semibold text-slate-900 line-clamp-1">{recent.name || 'Medicine'}</p>
                  <p className="text-sm text-emerald-700 font-bold">₹{recent.discountPrice || recent.price}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PublicProductDetailPage;
