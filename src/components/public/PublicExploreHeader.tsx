import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Search, ShoppingBag, User } from 'lucide-react';

type PublicExploreHeaderProps = {
  wishlistCount: number;
  cartCount: number;
  isLoggedInCustomer: boolean;
  accountReturnTo: string;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  searchMode?: 'active' | 'redirect';
};

const PublicExploreHeader: React.FC<PublicExploreHeaderProps> = ({
  wishlistCount,
  cartCount,
  isLoggedInCustomer,
  accountReturnTo,
  searchQuery = '',
  onSearchQueryChange,
  searchMode = 'active',
}) => {
  const navigate = useNavigate();

  const redirectToExploreSearch = () => {
    if (searchMode === 'redirect') navigate('/exploreproducts');
  };

  return (
    <nav className="h-20 border-b border-slate-100 bg-white flex items-center justify-between px-6 md:px-12 gap-4 sticky top-0 z-40">
      <Link to="/" className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-100">M</div>
        <span className="font-bold text-2xl text-slate-900 tracking-tight">MedSmart</span>
      </Link>

      <div className="hidden md:flex items-center gap-3 max-w-xl flex-1">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          value={searchQuery}
          onChange={(e) => onSearchQueryChange?.(e.target.value)}
          onFocus={redirectToExploreSearch}
          onClick={redirectToExploreSearch}
          placeholder="Search medicines, category, description, seller..."
          readOnly={searchMode === 'redirect'}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/wishlist')}
          className="relative p-2 rounded-xl border border-slate-200 text-slate-600"
          title="Wishlist"
        >
          <Heart className="w-5 h-5" />
          {wishlistCount > 0 && <span className="absolute -top-2 -right-2 text-[10px] bg-rose-500 text-white rounded-full px-1.5">{wishlistCount}</span>}
        </button>
        <button
          onClick={() => navigate('/cart')}
          className="relative p-2 rounded-xl border border-slate-200 text-slate-600"
          title="Cart"
        >
          <ShoppingBag className="w-5 h-5" />
          {cartCount > 0 && <span className="absolute -top-2 -right-2 text-[10px] bg-emerald-600 text-white rounded-full px-1.5">{cartCount}</span>}
        </button>
        <button
          onClick={() => navigate(isLoggedInCustomer ? '/dashboard' : '/login', isLoggedInCustomer ? undefined : { state: { returnTo: accountReturnTo } })}
          className="p-2 rounded-xl border border-slate-200 text-slate-600"
          title="Account"
        >
          <User className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
};

export default PublicExploreHeader;
