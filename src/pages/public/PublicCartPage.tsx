import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { parseStoredCart } from '../../utils/safeCart';

const PublicCartPage: React.FC = () => {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = React.useState<any[]>(() => parseStoredCart(localStorage.getItem('cart'), 'PublicCartPage'));

  const persist = (next: any[]) => {
    setCartItems(next);
    localStorage.setItem('cart', JSON.stringify(next));
  };

  const updateQuantity = (id: string, delta: number) => {
    const next = cartItems
      .map((item) => (item.id === id ? { ...item, quantity: Math.max(1, (Number(item.quantity) || 1) + delta) } : item))
      .filter((item) => Number(item.quantity) > 0);
    persist(next);
  };

  const removeItem = (id: string) => persist(cartItems.filter((item) => item.id !== id));
  const clearCart = () => persist([]);

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
                        <span className="font-semibold text-sm w-6 text-center">{Number(item.quantity) || 1}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1"><Plus className="w-4 h-4" /></button>
                      </div>
                      <p className="font-bold text-slate-900">₹{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 h-fit">
              <h3 className="font-bold text-slate-900 mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Delivery Fee</span><span>₹{deliveryFee.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total</span><span className="text-emerald-600">₹{total.toFixed(2)}</span></div>
              </div>
              <button onClick={() => navigate('/checkout')} className="mt-6 w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 inline-flex items-center justify-center gap-2">
                Proceed to Checkout <ArrowRight className="w-4 h-4" />
              </button>
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
