import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../AuthContext';

interface Props {
role?: 'customer' | 'seller' | 'admin' | 'delivery';
}

const LoginPage: React.FC<Props> = ({ role = 'customer' }) => {
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [error, setError] = useState('');
const [loading, setLoading] = useState(false);

const navigate = useNavigate();
const location = useLocation();
const { login } = useAuth();

const getRedirectPath = (userRole: string) => {
switch (userRole) {
case 'admin': return '/admin';
case 'seller': return '/seller';
case 'delivery': return '/delivery';
default: return '/dashboard';
}
};

const handleLogin = async (e: React.FormEvent) => {
e.preventDefault();
setError('');
setLoading(true);


try {
  const actualRole = await login(email, password);
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  navigate(returnTo || getRedirectPath(actualRole || role));

} catch (err: any) {
  setError(err?.message || 'Login failed');
} finally {
  setLoading(false);
}


};

return ( <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4"> <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"> <div className="p-8">


      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white">
          <ShieldCheck className="w-10 h-10" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-center mb-2">
        {role === 'admin' ? 'Admin Login' : `${role} Login`}
      </h2>

      {error && (
        <div className="mb-4 text-red-600 text-sm flex gap-2">
          <AlertCircle /> {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">

        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-2 border rounded"
        />

        <input
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-2 border rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 text-white py-2 rounded flex justify-center"
        >
          {loading ? <Loader2 className="animate-spin" /> : 'Login'}
        </button>

      </form>

    </div>

    {/* REGISTER LINK BASED ON ROLE */}
    {role !== 'admin' && (
      <div className="p-4 text-center border-t">
        <Link
          to={`/${role === 'customer' ? 'register' : role + '/register'}`}
          className="text-emerald-600"
        >
          Create {role} account
        </Link>
      </div>
    )}
  </div>
</div>


);
};

export default LoginPage;
