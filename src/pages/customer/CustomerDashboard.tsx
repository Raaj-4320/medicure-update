import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  MapPin, 
  Clock, 
  ChevronRight, 
  Search,
  Package,
  Heart,
  Bell,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { useLocation } from '../../LocationContext';
import { Order, Pharmacy } from '../../types';
import { MOCK_ORDERS } from '../../staticData';
import { logUI } from '../../utils/uiLogger';
import { api } from '../../services/api';

const CustomerDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { location, setLocation } = useLocation();
  const navigate = useNavigate();
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [nearbyPharmacies, setNearbyPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) {
        setLoading(false);
        return;
      }
      
      // Use mock data
      setRecentOrders(MOCK_ORDERS.filter(o => o.customerId === profile.uid).slice(0, 3) as any);
      const customerVisiblePharmacies = await api.getPharmaciesForCustomer();
      setNearbyPharmacies(customerVisiblePharmacies.slice(0, 4) as any);
      setLoading(false);
    };

    fetchData().catch(() => setLoading(false));
  }, [profile, location]);

  const handleChangeLocation = () => {
    const city = window.prompt('Enter city', location?.city || 'Bangalore');
    if (!city) return;
    const area = window.prompt('Enter area', location?.area || 'Downtown');
    if (!area) return;
    setLocation({
      country: location?.country || 'India',
      state: location?.state || 'Karnataka',
      city,
      area,
      locality: location?.locality || area,
      pincode: location?.pincode || '560001',
      landmark: location?.landmark || '',
    });
    logUI('ACTION', { component: 'CustomerDashboard', action: 'Change Location', success: true });
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-emerald-600 rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl shadow-emerald-100">
        <div className="relative z-10 max-w-xl">
          <h1 className="text-3xl font-bold mb-2">Hello, {profile?.displayName}!</h1>
          <p className="text-emerald-50 mb-8">Your health is our priority. Discover pharmacies near you and get your medicines delivered fast.</p>
          <Link 
            to="/discover" 
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 transition-all"
          >
            <Search className="w-5 h-5" />
            Find Medicines
          </Link>
        </div>
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-emerald-500/20 skew-x-[-20deg] translate-x-1/2"></div>
        <ShoppingBag className="absolute right-12 top-1/2 -translate-y-1/2 w-32 h-32 text-white/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Orders */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Recent Orders</h2>
            <Link to="/orders" className="text-emerald-600 text-sm font-semibold hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {recentOrders.length > 0 ? (
            <div className="space-y-4">
              {recentOrders.map(order => (
                <div key={order.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Order #{order.id.slice(-6)}</h4>
                      <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">₹{order.totalAmount}</p>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-200 text-center">
              <p className="text-slate-500">No recent orders found.</p>
            </div>
          )}

          {/* Nearby Pharmacies */}
          <div className="space-y-6 pt-4">
            <h2 className="text-xl font-bold text-slate-900">Pharmacies Near You</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {nearbyPharmacies.map(pharmacy => (
                <Link key={pharmacy.id} to={`/pharmacy/${pharmacy.id}`} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-all flex items-center gap-4">
                  <img src={pharmacy.image || undefined} alt="" className="w-16 h-16 rounded-xl object-cover" />
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{pharmacy.name || 'Profile Incomplete'}</h4>
                    <p className="text-xs text-slate-500">{(pharmacy.address as any)?.area || (pharmacy.address as any)?.addressLine || 'Address unavailable'}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">Current Location</h3>
            {location ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{location.area}</p>
                    <p className="text-xs text-slate-500">{location.city}, {location.pincode}</p>
                  </div>
                </div>
                <button
                  onClick={handleChangeLocation}
                  className="w-full py-2 text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  Change Location
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No location set.</p>
            )}
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl text-white">
            <h3 className="font-bold mb-2">Need Help?</h3>
            <p className="text-xs text-slate-400 mb-4">Our support team is available 24/7 for your medical queries.</p>
            <button onClick={() => navigate('/orders')} className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-lg transition-all">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
