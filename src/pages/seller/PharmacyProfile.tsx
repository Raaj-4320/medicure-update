import React, { useEffect, useState } from 'react';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Clock, 
  FileText, 
  CreditCard, 
  ShieldCheck, 
  Camera, 
  Edit3, 
  Save, 
  X, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { api, isPharmacyProfileComplete } from '../../services/api';
import { logUI } from '../../utils/uiLogger';
import { Pharmacy } from '../../types';

const PharmacyProfile: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'license' | 'bank' | 'settings'>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    ownerName: '',
    establishedYear: '',
    email: '',
    phone: '',
    website: '',
    addressLine: '',
    mapUrl: '',
    operatingHours: '',
    workingDays: '',
    licenseNumber: '',
  });

  const asText = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');

  useEffect(() => {
    const fetchPharmacy = async () => {
      if (!profile?.uid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const pharmacies = await api.getPharmacies({ ownerId: profile.uid });
        const currentPharmacy = pharmacies[0] || null;
        setPharmacy(currentPharmacy);
        logUI('SELLER_PROFILE_HYDRATE', {
          component: 'PharmacyProfile',
          action: 'Fetch pharmacy profile',
          expected: 'pharmacy shape should hydrate editable form state',
          success: Boolean(currentPharmacy),
        });
        if (currentPharmacy) {
          const rawAddress = (currentPharmacy.address as any)?.addressLine ?? (currentPharmacy as any)?.address;
          setFormData({
            name: asText(currentPharmacy.name),
            ownerName: asText(currentPharmacy.verificationDetails?.ownerName || currentPharmacy.ownerName),
            establishedYear: asText(currentPharmacy.establishedYear),
            email: asText(currentPharmacy.email),
            phone: asText(currentPharmacy.contactNumber),
            website: asText(currentPharmacy.website),
            addressLine: asText(rawAddress),
            mapUrl: asText(currentPharmacy.mapUrl),
            operatingHours: asText(currentPharmacy.operatingHours),
            workingDays: asText(currentPharmacy.workingDays),
            licenseNumber: asText(currentPharmacy.verificationDetails?.licenseNumber || currentPharmacy.license),
          });
          logUI('SELLER_PROFILE_HYDRATE', {
            component: 'PharmacyProfile',
            action: 'Normalize pharmacy profile data for form',
            expected: 'all form values should be string-safe',
            success: true,
            diagnostics: { stateChanged: true, uiUpdated: true },
          });
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load pharmacy profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchPharmacy();
  }, [profile]);

  const handleInputChange = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveChanges = async () => {
    if (!pharmacy?.id || saving) return;
    setSaving(true);
    setError('');
    setSuccess('');
    logUI('SELLER_PROFILE_SAVE', {
      component: 'PharmacyProfile',
      action: 'Save Changes click',
      expected: 'should update pharmacy profile in firestore',
      status: 'partial',
      diagnostics: { handlerExecuted: true, apiCalled: false },
    });
    const addressPatch = { ...(pharmacy.address || {}), addressLine: formData.addressLine };
    const verificationDetailsPatch = {
      ...(pharmacy.verificationDetails || {}),
      ownerName: formData.ownerName,
      licenseNumber: formData.licenseNumber,
    };
    const patch: Record<string, unknown> = {
      name: formData.name,
      ownerName: formData.ownerName,
      establishedYear: formData.establishedYear,
      email: formData.email,
      contactNumber: formData.phone,
      phone: formData.phone,
      website: formData.website,
      address: addressPatch,
      mapUrl: formData.mapUrl,
      operatingHours: formData.operatingHours,
      workingDays: formData.workingDays,
      license: formData.licenseNumber,
      verificationDetails: verificationDetailsPatch,
    };
    logUI('SELLER_PROFILE_SAVE_PAYLOAD', {
      component: 'PharmacyProfile',
      action: 'Prepared profile save payload',
      expected: 'payload contains required completeness fields',
      success: true,
    });
    const changedFields = Object.keys(patch).filter((key) => JSON.stringify((pharmacy as any)[key]) !== JSON.stringify((patch as any)[key]));

    try {
      const updated = await api.updatePharmacy(pharmacy.id, patch);
      if (!updated) throw new Error('Profile update failed.');
      const refreshed = (await api.getPharmacies({ id: pharmacy.id }))[0];
      if (refreshed) {
        setPharmacy(refreshed);
        logUI('SELLER_PROFILE_SAVE_FETCH', {
          component: 'PharmacyProfile',
          action: 'Post-save pharmacy fetch',
          expected: 'should re-read normalized pharmacy doc',
          success: true,
        });
      }
      await api.logPharmacyProfileUpdate(pharmacy.id, {
        sellerId: profile?.uid,
        changedFields,
        before: {
          name: pharmacy.name,
          ownerName: pharmacy.verificationDetails?.ownerName || pharmacy.ownerName || '',
          establishedYear: pharmacy.establishedYear || '',
          email: pharmacy.email,
          phone: pharmacy.contactNumber,
          website: pharmacy.website || '',
          addressLine: (pharmacy.address as any)?.addressLine || '',
          mapUrl: pharmacy.mapUrl || '',
          operatingHours: pharmacy.operatingHours,
          workingDays: pharmacy.workingDays || '',
          licenseNumber: pharmacy.verificationDetails?.licenseNumber || pharmacy.license || '',
        },
        after: formData,
        source: 'seller_profile_update',
      });
      setSuccess('Profile updated successfully.');
      setIsEditing(false);
      window.localStorage.setItem('seller_profile_last_updated_at', new Date().toISOString());
      window.dispatchEvent(new CustomEvent('seller-profile-updated', { detail: { pharmacyId: pharmacy.id } }));
      logUI('SELLER_PROFILE_SAVE', {
        component: 'PharmacyProfile',
        action: 'Save Changes click',
        expected: 'should update pharmacy profile in firestore',
        success: true,
        diagnostics: { handlerExecuted: true, apiCalled: true, stateChanged: true, uiUpdated: true },
      });
      setTimeout(() => navigate('/seller'), 400);
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile changes.');
      logUI('SELLER_PROFILE_SAVE', {
        component: 'PharmacyProfile',
        action: 'Save Changes click',
        expected: 'should update pharmacy profile in firestore',
        success: false,
        diagnostics: { handlerExecuted: true, apiCalled: true, stateChanged: false, uiUpdated: false },
        reason: err?.message || 'save failed',
      });
    } finally {
      setSaving(false);
    }
  };

  const profileStatus = (pharmacy?.status || pharmacy?.verificationStatus || 'pending').toString();
  const isComplete = pharmacy ? isPharmacyProfileComplete(pharmacy as any) : false;
  const normalizedAddressLine = asText(formData.addressLine);
  const headerLocation = normalizedAddressLine.split(',')[1]?.trim() || normalizedAddressLine || 'Address not set';
  const totalOrders = 0;

  const tabs = [
    { id: 'general', label: 'General Info', icon: Building2 },
    { id: 'license', label: 'Compliance & Licenses', icon: ShieldCheck },
    { id: 'bank', label: 'Bank & Payouts', icon: CreditCard },
    { id: 'settings', label: 'Store Settings', icon: FileText },
  ];

  return (
    <div className="space-y-8 pb-12">
      {loading && <div className="text-sm text-slate-500">Loading profile...</div>}
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</div>}
      {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2">{success}</div>}
      {/* Header / Banner */}
      <div className="relative h-44 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-3xl overflow-hidden shadow-lg shadow-emerald-100">
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        <div className="absolute -bottom-10 left-8 flex items-end gap-6 z-20">
          <div className="relative group">
            <div className="w-32 h-32 bg-white rounded-3xl border-4 border-white shadow-xl overflow-hidden flex items-center justify-center">
              <Building2 className="w-16 h-16 text-emerald-600" />
            </div>
            <button className="absolute bottom-2 right-2 p-2 bg-slate-900 text-white rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div className="mb-4 pb-2">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white drop-shadow-sm">{formData.name || 'Pharmacy Profile'}</h1>
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white text-[10px] font-bold rounded-full border border-white/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                {profileStatus}
              </span>
              <span className={`px-3 py-1 text-[10px] font-bold rounded-full border ${isComplete ? 'bg-emerald-200/40 border-emerald-100 text-emerald-50' : 'bg-amber-200/30 border-amber-100 text-amber-50'}`}>
                {isComplete ? 'Profile Complete' : 'Profile Incomplete'}
              </span>
            </div>
            <div className="flex items-center gap-4 text-white/80 text-sm">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {headerLocation}
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                {totalOrders}+ Orders
              </div>
            </div>
          </div>
        </div>
      </div>


      <div className="flex justify-end gap-3 -mt-4">
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="flex items-center gap-2 px-6 py-2.5 bg-white text-slate-900 rounded-2xl text-sm font-bold shadow-lg hover:bg-slate-50 transition-all border border-slate-200"
        >
          {isEditing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
        {isEditing && (
          <button
            onClick={handleSaveChanges}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 disabled:opacity-70 text-white rounded-2xl text-sm font-bold shadow-lg hover:bg-emerald-700 transition-all"
          >
            <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
            Save Changes
          </button>
        )}
      </div>

      <div className="mt-14 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1 space-y-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-emerald-400' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[500px]">
          <AnimatePresence mode="wait">
            {activeTab === 'general' && (
              <motion.div
                key="general"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4">Basic Information</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Pharmacy Name</label>
                        {isEditing ? (
                          <input type="text" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                        ) : (
                          <p className="text-sm font-bold text-slate-900">{formData.name}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Owner Name</label>
                        {isEditing ? (
                          <input type="text" value={formData.ownerName} onChange={(e) => handleInputChange('ownerName', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                        ) : (
                          <p className="text-sm font-bold text-slate-900">{formData.ownerName}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Established Year</label>
                        {isEditing ? (
                          <input type="text" value={formData.establishedYear} onChange={(e) => handleInputChange('establishedYear', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                        ) : (
                          <p className="text-sm font-bold text-slate-900">{formData.establishedYear || '-'}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4">Contact Details</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                          <Mail className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Email Address</p>
                          {isEditing ? (
                            <input type="text" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                          ) : (
                            <p className="text-sm font-bold text-slate-900">{formData.email}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Phone Number</p>
                          {isEditing ? (
                            <input type="text" value={formData.phone} onChange={(e) => handleInputChange('phone', e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                          ) : (
                            <p className="text-sm font-bold text-slate-900">{formData.phone}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                          <Globe className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Website</p>
                          {isEditing ? (
                            <input type="text" value={formData.website} onChange={(e) => handleInputChange('website', e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                          ) : (
                            <p className="text-sm font-bold text-slate-900">{formData.website || '-'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4">Store Location</h3>
                  <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                      <MapPin className="w-6 h-6 text-rose-500" />
                    </div>
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input type="text" value={formData.addressLine} onChange={(e) => handleInputChange('addressLine', e.target.value)} placeholder="Store Location / Address" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                          <input type="text" value={formData.mapUrl} onChange={(e) => handleInputChange('mapUrl', e.target.value)} placeholder="Google Maps Link" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-slate-900 mb-1">{formData.addressLine}</p>
                          <a href={formData.mapUrl || '#'} target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-600 flex items-center gap-1 hover:underline">
                            View on Google Maps
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4">Operating Hours</h3>
                  <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                      <Clock className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      {isEditing ? (
                        <div className="space-y-2">
                          <input type="text" value={formData.operatingHours} onChange={(e) => handleInputChange('operatingHours', e.target.value)} placeholder="Operating Hours" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                          <input type="text" value={formData.workingDays} onChange={(e) => handleInputChange('workingDays', e.target.value)} placeholder="Working Days / Open Days" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-slate-900 mb-1">{formData.operatingHours}</p>
                          <p className="text-xs text-slate-500">{formData.workingDays || 'Open Monday to Sunday'}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'license' && (
              <motion.div
                key="license"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">Regulatory Documents</h3>
                  <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all">
                    <Plus className="w-4 h-4" />
                    Upload New
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md">Verified</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Drug License (Form 20/21)</h4>
                      {isEditing ? (
                        <input type="text" value={formData.licenseNumber} onChange={(e) => handleInputChange('licenseNumber', e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      ) : (
                        <p className="text-xs text-slate-500 mt-1">License No: {formData.licenseNumber}</p>
                      )}
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Expires: 31 Dec 2025</span>
                      <button className="text-xs font-bold text-emerald-600 hover:underline">View Doc</button>
                    </div>
                  </div>

                  <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md">Verified</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">GST Registration</h4>
                      <p className="text-xs text-slate-500 mt-1">GSTIN: Not provided</p>
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Status: Active</span>
                      <button className="text-xs font-bold text-emerald-600 hover:underline">View Doc</button>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
                  <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-900">License Renewal Alert</h4>
                    <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                      Your Drug License is expiring in 9 months. Please ensure you start the renewal process at least 3 months in advance to avoid platform suspension.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'bank' && (
              <motion.div
                key="bank"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <h3 className="text-lg font-bold text-slate-900">Settlement Bank Account</h3>
                <div className="p-8 bg-slate-900 rounded-3xl text-white relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform">
                    <CreditCard className="w-48 h-48" />
                  </div>
                  <div className="relative z-10 space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center p-2">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/c/cc/SBI-logo.svg" alt="SBI" className="w-full h-full object-contain" />
                      </div>
                      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/30">
                        Primary Account
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Account Number</p>
                      <h4 className="text-2xl font-bold tracking-widest">**** **** 1234</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Account Holder</p>
                        <p className="text-sm font-bold">Primary settlement account</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">IFSC Code</p>
                        <p className="text-sm font-bold">Configured</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Payout Schedule</h4>
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-xl shadow-sm">
                        <Clock className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">Weekly Settlements</p>
                        <p className="text-xs text-slate-500">Every Monday</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Minimum Payout</h4>
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white rounded-xl shadow-sm">
                        <DollarSign className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">₹1,000.00</p>
                        <p className="text-xs text-slate-500">Threshold for auto-transfer</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const DollarSign = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default PharmacyProfile;
