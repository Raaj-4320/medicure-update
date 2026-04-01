import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  Package, 
  ShoppingCart, 
  ClipboardList, 
  Settings, 
  LogOut, 
  Bell, 
  PieChart,
  LifeBuoy,
  History,
  ShieldCheck,
  Truck,
  ShieldAlert,
  DollarSign,
  Navigation,
  FileText,
  Activity,
  Menu,
  X,
  Factory,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Plus,
  MoreVertical,
  Calendar,
  Eye,
  Trash2,
  Lock,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  ShoppingBag,
  CreditCard,
  Wallet,
  Globe,
  Phone,
  Mail,
  Building2,
  MapPin,
  Camera,
  Edit3,
  Save,
  MessageCircle,
  MessageSquare,
  Send,
  Paperclip
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { useLocation as useAppLocation } from '../../LocationContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MainLayout: React.FC = () => {
  const { profile, logout } = useAuth();
  const { location } = useAppLocation();
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getNavItems = () => {
    if (!profile) return [];
    
    const items = [];
    
    if (profile.role === 'customer') {
      items.push(
        { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Discover Pharmacies', icon: Store, path: '/discover' },
        { label: 'My Orders', icon: ClipboardList, path: '/orders' },
        { label: 'Cart', icon: ShoppingCart, path: '/cart' }
      );
    } else if (profile.role === 'seller') {
      items.push(
        { label: 'Dashboard', icon: LayoutDashboard, path: '/seller' },
        { label: 'Orders', icon: ClipboardList, path: '/seller/orders' },
        { label: 'Inventory', icon: Package, path: '/seller/inventory' },
        { label: 'Medicine Catalog', icon: Store, path: '/seller/catalog' },
        { label: 'Store Profile', icon: Building2, path: '/seller/profile' }
      );
    } else if (profile.role === 'admin') {
      items.push(
        { label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
        { label: 'Users', icon: Users, path: '/admin/users' },
        { label: 'Verifications', icon: ShieldCheck, path: '/admin/verifications' },
        { label: 'Medicine Catalog', icon: Package, path: '/admin/catalog' },
        { label: 'Logistics', icon: Truck, path: '/admin/logistics' }
      );
    } else if (profile.role === 'delivery') {
      items.push(
        { label: 'My Deliveries', icon: Truck, path: '/delivery' }
      );
    }
    
    return items;
  };

  const navItems = getNavItems();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-30",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">M</div>
          {isSidebarOpen && <span className="font-bold text-xl text-slate-900">MedSmart</span>}
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                routerLocation.pathname === item.path 
                  ? "bg-emerald-50 text-emerald-700" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {isSidebarOpen && <span className="font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 px-3 py-2 w-full rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors",
            )}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {isSidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-bottom border-slate-200 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            
            {location && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-200 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span className="truncate max-w-[200px]">{location.area}, {location.city}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900">{profile?.displayName}</p>
                <p className="text-xs text-slate-500 capitalize">{profile?.role}</p>
              </div>
              <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold overflow-hidden">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  profile?.displayName?.charAt(0) || 'U'
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
