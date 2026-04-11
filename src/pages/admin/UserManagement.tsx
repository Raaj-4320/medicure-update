import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical, 
  UserPlus, 
  Shield, 
  Mail, 
  Phone, 
  Download,
  Trash2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import { api } from '../../services/api';
import { motion, AnimatePresence } from 'motion/react';

const UserManagement: React.FC = () => {
  const isUserRole = (value: string): value is UserRole =>
    ['admin', 'seller', 'customer', 'delivery', 'pharmacist', 'compliance_officer', 'logistics_manager', 'support_agent'].includes(value);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersData = await api.getUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to fetch users', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      await api.deleteUser(userId);
      setUsers(users.filter(u => (u.uid || (u as any).id) !== userId));
    } catch (error) {
      console.error('Failed to delete user', error);
    }
  };

  const handleBulkAction = async (action: 'delete') => {
    if (selectedUsers.length === 0) return;
    if (!window.confirm(`Are you sure you want to ${action} ${selectedUsers.length} users?`)) return;

    if (action === 'delete') {
      await Promise.all(selectedUsers.map((id) => api.deleteUser(id)));
      setUsers(users.filter(u => !selectedUsers.includes(u.uid || (u as any).id)));
    }
    setSelectedUsers([]);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? user.status !== 'blocked' : user.status === 'blocked');
    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedUsers.length === paginatedUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(paginatedUsers.map(u => u.uid || (u as any).id));
    }
  };

  const toggleSelectUser = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const exportUsers = () => {
    const csv = [
      ['Name', 'Email', 'Role', 'Status', 'Joined Date'],
      ...filteredUsers.map(u => [
        u.displayName,
        u.email,
        u.role,
        u.status || 'active',
        u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'
      ])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'users_export.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500 text-sm">Manage system access, roles, and user status</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportUsers}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={async () => {
              const email = window.prompt('Email');
              if (!email) return;
              const displayName = window.prompt('Display name', email.split('@')[0]) || email.split('@')[0];
              const roleInput = window.prompt('Role (admin/seller/customer/delivery)', 'customer') || 'customer';
              const role: UserRole = isUserRole(roleInput) ? roleInput : 'customer';
              const id = `user-${Date.now()}`;
              await api.createUser({ id, uid: id, email, displayName, role, status: 'active', addresses: [] });
              await fetchUsers();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <UserPlus className="w-4 h-4" />
            Add New User
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or email..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select 
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="seller">Seller</option>
                <option value="customer">Customer</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>
            <select 
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        {selectedUsers.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between bg-emerald-50 p-3 rounded-xl border border-emerald-100"
          >
            <span className="text-sm text-emerald-700 font-medium">{selectedUsers.length} users selected</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleBulkAction('delete')}
                className="px-3 py-1.5 bg-white text-red-600 text-xs font-bold rounded-lg border border-red-200 hover:bg-red-50"
              >
                Bulk Delete
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 font-semibold">User Info</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Joined Date</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
                    <p className="text-slate-500">Loading users...</p>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.uid} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        checked={selectedUsers.includes(user.uid || (user as any).id)}
                        onChange={() => toggleSelectUser(user.uid || (user as any).id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold">
                          {user.displayName?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{user.displayName}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        user.role === 'admin' ? 'bg-purple-50 text-purple-600' :
                        user.role === 'seller' ? 'bg-blue-50 text-blue-600' :
                        user.role === 'delivery' ? 'bg-amber-50 text-amber-600' :
                        'bg-slate-50 text-slate-600'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${
                        user.status === 'blocked' ? 'text-red-600' : 'text-emerald-600'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          user.status === 'blocked' ? 'bg-red-600' : 'bg-emerald-600'
                        }`}></div>
                        {user.status === 'blocked' ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleDeleteUser(user.uid || (user as any).id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} users
          </p>
          <div className="flex items-center gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {[...Array(totalPages)].map((_, i) => (
              <button 
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  currentPage === i + 1 ? 'bg-emerald-600 text-white shadow-md' : 'hover:bg-white border border-slate-200 text-slate-600'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
