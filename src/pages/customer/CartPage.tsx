import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  ArrowRight, 
  AlertCircle,
  ChevronLeft,
  Package
} from 'lucide-react';
import { logUI } from '../../utils/uiLogger';

const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = React.useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('cart');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Failed to parse cart from localStorage', error);
      return [];
    }
  });

  const updateQuantity = (id: string, delta: number) => {
    const newCart = cartItems.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    });
    setCartItems(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    logUI('CART_QUANTITY', { context: `Item ${id} delta ${delta}`, success: true });
  };

  const removeItem = (id: string) => {
    const newCart = cartItems.filter(item => item.id !== id);
    setCartItems(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    logUI('CART_REMOVE', { context: `Item ${id}`, success: true });
  };

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const deliveryFee = 40;
  const total = subtotal + deliveryFee;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Your Cart</h1>
        <Link to="/discover" className="text-emerald-600 font-semibold flex items-center gap-1 hover:underline">
          <ChevronLeft className="w-4 h-4" />
          Continue Shopping
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex gap-4">
              <div className="w-20 h-20 bg-slate-50 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                {item.image ? (
                  <img src={item.image} alt={item.brandName || item.name || 'Medicine'} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h4 className="font-bold text-slate-900">{item.brandName || item.name}</h4>
                    {item.rxRequired && (
                      <span className="text-[10px] font-bold text-red-600 uppercase flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Prescription Required
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="text-slate-400 hover:text-red-600 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-1">
                    <button 
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-md text-slate-600"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-bold text-slate-900">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-md text-slate-600"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="font-bold text-slate-900">₹{item.price * item.quantity}</p>
                </div>
              </div>
            </div>
          ))}

          {cartItems.length === 0 && (
            <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Your cart is empty</h3>
              <p className="text-slate-500 mb-6">Looks like you haven't added any medicines yet.</p>
              <Link to="/discover" className="inline-flex px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all">
                Start Shopping
              </Link>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6">Order Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900">₹{subtotal}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Delivery Fee</span>
                <span className="font-bold text-slate-900">₹{deliveryFee}</span>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between text-lg">
                <span className="font-bold text-slate-900">Total</span>
                <span className="font-bold text-emerald-600">₹{total}</span>
              </div>
            </div>
            
            <button 
              onClick={() => {
                logUI('CHECKOUT_CLICK', { context: 'Cart checkout button', success: true });
                navigate('/checkout');
              }}
              className="w-full mt-8 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
            >
              Checkout
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">
              One or more items in your cart require a valid prescription. You will be asked to upload it during checkout.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
