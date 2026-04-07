import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { api } from '../../services/api';
import { Pharmacy, SellerMedicine } from '../../types';
import { parseStoredCart } from '../../utils/safeCart';

const ExploreProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [item, setItem] = useState<SellerMedicine | null>(null);
  const [sellerName, setSellerName] = useState('Pharmacy');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const isLoggedInCustomer = useMemo(() => Boolean(user && profile?.role === 'customer'), [user, profile?.role]);

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const inventory = await api.getInventory({});
        const found = inventory.find((entry) => entry.id === id && entry.isVisible !== false && (entry as any).isActive !== false) || null;
        setItem(found);
        if (found?.pharmacyId) {
          const pharmacies = await api.getPharmacies({ id: found.pharmacyId });
          const pharmacy = pharmacies[0] as Pharmacy | undefined;
          setSellerName(pharmacy?.name || 'Pharmacy');
        }
      } catch (error) {
        console.error('Failed to load explore product detail', error);
        setErrorMessage('Unable to load product details right now.');
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  const addToCart = () => {
    if (!item) return;

    const cart = parseStoredCart(localStorage.getItem('cart'), 'ExploreProductDetail addToCart');
    const newCart = [...cart];

    if (newCart.length > 0 && newCart[0]?.pharmacyId && newCart[0].pharmacyId !== item.pharmacyId) {
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
      navigate('/cart');
      return;
    }

    const existingIndex = newCart.findIndex((entry) => entry.id === item.id);
    if (existingIndex !== -1) {
      newCart[existingIndex].quantity += 1;
    } else {
      newCart.push({
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
    }

    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6 text-slate-500">Loading product details…</div>;
  }

  if (errorMessage || !item) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Link to="/exploreproducts" className="inline-flex items-center gap-2 text-emerald-600 font-semibold mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to products
        </Link>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-600">{errorMessage || 'Product not found.'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-6 md:px-12">
      <div className="max-w-5xl mx-auto">
        <Link to="/exploreproducts" className="inline-flex items-center gap-2 text-emerald-600 font-semibold mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to products
        </Link>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="w-full aspect-square rounded-2xl bg-slate-100 overflow-hidden">
            {item.image ? (
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">No image</div>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-bold text-slate-900">{item.name || 'Medicine'}</h1>
            <p className="text-slate-500 mt-1">{item.category || 'General'}</p>
            <p className="text-slate-600 mt-4 leading-relaxed">{item.description || 'No description available.'}</p>

            {item.rxRequired && (
              <p className="mt-4 text-xs font-bold uppercase text-red-600 inline-flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Prescription required
              </p>
            )}

            <p className="mt-4 text-sm text-slate-600">
              Seller: <span className="font-semibold text-slate-800">{sellerName}</span>
            </p>
            <p className="mt-2 text-sm text-slate-600">Availability: {item.stock > 0 ? `In stock (${item.stock})` : 'Out of stock'}</p>
            <p className="mt-4 text-3xl font-bold text-emerald-700">₹{item.discountPrice || item.price}</p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={addToCart}
                className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 inline-flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" /> Add to Cart
              </button>
              <button
                onClick={() => {
                  if (!isLoggedInCustomer) {
                    window.alert('Please login to complete purchase.');
                    navigate('/login', { state: { returnTo: `/exploreproducts/${item.id}` } });
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
      </div>
    </div>
  );
};

export default ExploreProductDetail;
