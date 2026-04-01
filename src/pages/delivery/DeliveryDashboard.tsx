import React, { useState, useEffect } from 'react';
import { 
  Bike, 
  DollarSign, 
  Package, 
  Navigation, 
  Star, 
  TrendingUp, 
  Power,
  ChevronRight,
  Clock,
  MapPin,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { api } from '../../services/api';
import { 
  MOCK_DELIVERY_PERFORMANCE, 
  MOCK_DELIVERY_WALLET, 
  MOCK_DELIVERY_ASSIGNMENTS,
  MOCK_AVAILABLE_ORDERS 
} from '../../staticData';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

const DeliveryDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayEarnings: 0,
    activeDeliveries: 0,
    pendingPickups: 0,
    distanceTraveled: 12.5,
    performanceScore: 4.8
  });
  const [activeAssignment, setActiveAssignment] = useState<any>(null);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const assignments = await api.getDeliveryAssignments();
        const myAssignments = assignments.filter((a: any) => a.deliveryStaffId === profile.uid);
        const active = myAssignments.find((a: any) => !['delivered', 'completed', 'failed'].includes(a.status));
        setActiveAssignment(active);

        // Fetch available orders (dispatched by seller)
        const orders = await api.getOrders();
        const readyOrders = orders.filter((o: any) => o.status === 'dispatched');
        setAvailableOrders(readyOrders.slice(0, 2));

        setStats({
          todayEarnings: myAssignments.length * 50, // Mock calculation
          activeDeliveries: active ? 1 : 0,
          pendingPickups: readyOrders.length,
          distanceTraveled: 12.5,
          performanceScore: 4.8
        });
      } catch (error) {
        console.error('Failed to fetch delivery data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  if (loading) return <div className="flex items-center justify-center h-full p-10">Loading...</div>;

  return (
    <div className="space-y-6 pb-20">
      {/* Header with Online/Offline Toggle */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-black/5">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          <div>
            <h2 className="font-semibold text-slate-900">{isOnline ? 'You are Online' : 'You are Offline'}</h2>
            <p className="text-xs text-slate-500">{isOnline ? 'Ready for new orders' : 'Go online to receive orders'}</p>
          </div>
        </div>
        <button 
          onClick={() => setIsOnline(!isOnline)}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${isOnline ? 'bg-emerald-500' : 'bg-slate-200'}`}
        >
          <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isOnline ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-black/5"
        >
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <DollarSign size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">Today</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">₹{stats.todayEarnings}</div>
          <p className="text-[10px] text-slate-500 mt-1">8 orders completed</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-black/5"
        >
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Star size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">Rating</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.performanceScore}</div>
          <p className="text-[10px] text-slate-500 mt-1">Top 5% in your area</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-black/5"
        >
          <div className="flex items-center gap-2 text-orange-600 mb-1">
            <Navigation size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">Distance</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.distanceTraveled} <span className="text-sm font-normal text-slate-500">km</span></div>
          <p className="text-[10px] text-slate-500 mt-1">Fuel efficiency: Good</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-4 rounded-2xl shadow-sm border border-black/5"
        >
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Package size={16} />
            <span className="text-xs font-medium uppercase tracking-wider">Active</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.activeDeliveries}</div>
          <p className="text-[10px] text-slate-500 mt-1">1 in progress</p>
        </motion.div>
      </div>

      {/* Active Delivery Card */}
      {activeAssignment && (
        <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Active Delivery</span>
                <h3 className="text-lg font-bold">Order #ORD-7892</h3>
              </div>
              <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-medium border border-emerald-500/30">
                In Transit
              </div>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex gap-3">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <div className="w-0.5 h-8 bg-white/20" />
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-[10px] text-white/50 uppercase font-bold">Pickup</p>
                    <p className="text-sm font-medium">City Health Pharmacy, Satellite</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/50 uppercase font-bold">Drop</p>
                    <p className="text-sm font-medium">102, Sunrise Apartments, Vastrapur</p>
                  </div>
                </div>
              </div>
            </div>

            <Link 
              to="/delivery/my-deliveries"
              className="w-full bg-white text-slate-900 py-3 rounded-xl font-bold text-center block transition-transform active:scale-95"
            >
              View Details & Navigate
            </Link>
          </div>
          {/* Decorative background element */}
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
        </div>
      )}

      {/* Available Orders Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">Available Near You</h3>
          <Link to="/delivery/available-orders" className="text-xs font-bold text-blue-600">View All</Link>
        </div>
        
        <div className="space-y-3">
          {availableOrders.map((order: any) => (
            <div key={order.id} className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex items-center justify-between">
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                  <MapPin size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{order.pharmacyName}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1"><Navigation size={10} /> {order.distance}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> 15 mins</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-emerald-600">₹{order.payout}</div>
                <button className="text-[10px] font-bold text-blue-600 mt-1 uppercase tracking-wider">Accept</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Alerts */}
      <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex gap-3">
        <AlertCircle className="text-orange-500 shrink-0" size={20} />
        <div>
          <h4 className="text-sm font-bold text-orange-900">Cold Chain Alert</h4>
          <p className="text-xs text-orange-700 mt-0.5">Order #ORD-7892 contains temperature-sensitive medicines. Maintain 2-8°C.</p>
        </div>
      </div>
    </div>
  );
};

export default DeliveryDashboard;
