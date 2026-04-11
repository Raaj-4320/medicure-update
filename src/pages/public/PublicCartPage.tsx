import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Lock, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Wallet } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { parseStoredCart } from '../../utils/safeCart';
import { getWishlistStorageKey, readWishlistIds, writeWishlistIds } from '../../utils/wishlist';

const PublicCartPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [cartItems, setCartItems] = React.useState<any[]>(() => parseStoredCart(localStorage.getItem('cart'), 'PublicCartPage'));
  const [removedItem, setRemovedItem] = React.useState<any | null>(null);
  const [coupon, setCoupon] = React.useState('');
  const [couponMessage, setCouponMessage] = React.useState('');
  const wishlistKey = getWishlistStorageKey(profile?.uid);

  const persist = (next: any[]) => {
    setCartItems(next);
    localStorage.setItem('cart', JSON.stringify(next));
  };

  const updateQuantity = (id: string, delta: number) => {
    const item = cartItems.find((entry) => entry.id === id);
    const stockLimit = Number(item?.stock || 0);
    const next = cartItems
      .map((cartItem) => {
        if (cartItem.id !== id) return cartItem;
        const current = Number(cartItem.quantity) || 1;
        const target = current + delta;
        const capped = stockLimit > 0 ? Math.min(stockLimit, target) : target;
        return { ...cartItem, quantity: Math.max(1, capped) };
      })
      .filter((item) => Number(item.quantity) > 0);
    persist(next);
  };

  const setQuantity = (id: string, value: number) => {
    const next = cartItems.map((item) => {
      if (item.id !== id) return item;
      const stockLimit = Number(item.stock || 0);
      const normalized = Math.max(1, Math.floor(Number.isFinite(value) ? value : 1));
      const bounded = stockLimit > 0 ? Math.min(stockLimit, normalized) : normalized;
      return { ...item, quantity: bounded };
    });
    persist(next);
  };

  const removeItem = (id: string) => {
    const target = cartItems.find((item) => item.id === id) || null;
    setRemovedItem(target);
    persist(cartItems.filter((item) => item.id !== id));
  };
  const undoRemove = () => {
    if (!removedItem) return;
    const existing = cartItems.find((item) => item.id === removedItem.id);
    const next = existing
      ? cartItems.map((item) => (item.id === removedItem.id ? { ...item, quantity: Number(item.quantity || 0) + Number(removedItem.quantity || 1) } : item))
      : [removedItem, ...cartItems];
    persist(next);
    setRemovedItem(null);
  };
  const clearCart = () => persist([]);
  const saveForLater = (item: any) => {
    const wishlistIds = readWishlistIds(wishlistKey, 'PublicCartPage saveForLater');
    const nextWishlist = writeWishlistIds(wishlistKey, [...wishlistIds, item.id]);
    if (nextWishlist.includes(item.id)) {
      persist(cartItems.filter((entry) => entry.id !== item.id));
    }
  };
  const applyCouponPlaceholder = () => {
    setCouponMessage(coupon.trim() ? `Coupon "${coupon.trim()}" will be validated at checkout soon.` : 'Enter a coupon code to preview.');
  };

  const subtotal = cartItems.reduce((acc, item) => acc + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const deliveryFee = cartItems.length > 0 ? 40 : 0;
  const total = subtotal + deliveryFee;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-6 md:px-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Your Cart</h1>
          <div className="flex items-center gap-3">
            <Link to="/exploreproducts" className="text-emerald-600 font-semibold">Continue Shopping</Link>
            {cartItems.length > 0 && (
              <button onClick={clearCart} className="px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100">Clear Cart</button>
            )}
          </div>
        </div>

        {cartItems.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <ShoppingBag className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Your cart is empty</h3>
            <p className="text-slate-500 mt-1">Add medicines from the explore page.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {removedItem && (
                <div className="bg-white border border-slate-200 rounded-xl p-3 text-sm flex items-center justify-between">
                  <p className="text-slate-600">Item removed.</p>
                  <button onClick={undoRemove} className="text-emerald-700 font-semibold">Undo</button>
                </div>
              )}
              {cartItems.map((item) => (
                <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4">
                  <div className="w-24 h-24 rounded-xl bg-slate-100 overflow-hidden">
                    {item.image ? <img src={item.image} alt={item.medicineName || item.brandName || 'Medicine'} className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-900">{item.medicineName || item.brandName || item.name || 'Medicine'}</h3>
                        <p className="text-sm text-slate-500">₹{Number(item.price || 0).toFixed(2)} each</p>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="p-1 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1"><Minus className="w-4 h-4" /></button>
                        <input
                          type="number"
                          min={1}
                          max={Number(item.stock || 0) > 0 ? Number(item.stock) : undefined}
                          value={Number(item.quantity) || 1}
                          onChange={(e) => setQuantity(item.id, Number(e.target.value))}
                          className="w-12 text-sm text-center bg-transparent outline-none"
                        />
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1"><Plus className="w-4 h-4" /></button>
                      </div>
                      <p className="font-bold text-slate-900">₹{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Delivery in 2–3 days</span>
                      <button onClick={() => saveForLater(item)} className="text-emerald-700 font-semibold">Save for Later</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 h-fit lg:sticky lg:top-24">
              <h3 className="font-bold text-slate-900 mb-4">Order Summary</h3>
              <div className="mb-4 flex items-center gap-2">
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Apply Coupon"
                  className="flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200"
                />
                <button onClick={applyCouponPlaceholder} className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600">Apply</button>
              </div>
              {couponMessage && <p className="text-xs text-slate-500 -mt-2 mb-3">{couponMessage}</p>}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-medium">₹{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Delivery Fee</span><span className="font-medium">₹{deliveryFee.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Coupon</span><span className="text-slate-400">{coupon ? 'Applied at checkout' : '—'}</span></div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total</span><span className="text-emerald-600">₹{total.toFixed(2)}</span></div>
              </div>
              <button onClick={() => navigate('/checkout')} className="mt-6 w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 inline-flex items-center justify-center gap-2">
                Proceed to Checkout <ArrowRight className="w-4 h-4" />
              </button>
              <div className="mt-3 text-xs text-slate-500 space-y-1">
                <p className="inline-flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Secure Checkout</p>
                <p className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Verified Pharmacies</p>
                <p className="inline-flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Support Available</p>
              </div>
              <div className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Login is required only when placing the order.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicCartPage;
