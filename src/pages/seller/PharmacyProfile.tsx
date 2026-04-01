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
import { useAuth } from '../../AuthContext';
import { api, isPharmacyProfileComplete } from '../../services/api';
import { logUI } from '../../utils/uiLogger';
import { Pharmacy } from '../../types';

const PharmacyProfile: React.FC = () => {
  const { profile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
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

  useEffect(() => {
    const fetchPharmacy = async () => {
      if (!profile?.uid) return;
      setLoading(true);
      setError('');
      try {
        const pharmacies = await api.getPharmacies({ ownerId: profile.uid });
        const currentPharmacy = pharmacies[0] || null;
        setPharmacy(currentPharmacy);
        if (currentPharmacy) {
          setFormData({
            name: currentPharmacy.name || '',
            ownerName: currentPharmacy.verificationDetails?.ownerName || currentPharmacy.ownerName || '',
            establishedYear: currentPharmacy.establishedYear || '',
            email: currentPharmacy.email || '',
            phone: currentPharmacy.contactNumber || '',
            website: currentPharmacy.website || '',
            addressLine: (currentPharmacy.address as any)?.addressLine || '',
            mapUrl: currentPharmacy.mapUrl || '',
            operatingHours: currentPharmacy.operatingHours || '',
            workingDays: currentPharmacy.workingDays || '',
            licenseNumber: currentPharmacy.verificationDetails?.licenseNumber || currentPharmacy.license || '',
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
    const changedFields = Object.keys(patch).filter((key) => JSON.stringify((pharmacy as any)[key]) !== JSON.stringify((patch as any)[key]));

    try {
      const updated = await api.updatePharmacy(pharmacy.id, patch);
      if (!updated) throw new Error('Profile update failed.');
      const refreshed = (await api.getPharmacies({ id: pharmacy.id }))[0];
      if (refreshed) {
        setPharmacy(refreshed);
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
      logUI('SELLER_PROFILE_SAVE', {
        component: 'PharmacyProfile',
        action: 'Save Changes click',
        expected: 'should update pharmacy profile in firestore',
        success: true,
        diagnostics: { handlerExecuted: true, apiCalled: true, stateChanged: true, uiUpdated: true },
      });
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
  const headerLocation = formData.addressLine.split(',')[1]?.trim() || formData.addressLine || 'Address not set';
  const totalOrders = 0;

  return (
    <div className="space-y-8 pb-12">
      {loading && <div className="text-sm text-slate-500">Loading profile...</div>}
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</div>}
      {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2">{success}</div>}
      {/* Header / Banner */}
      <div className="relative h-48 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-3xl overflow-hidden shadow-lg shadow-emerald-100">
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        <div className="absolute -bottom-16 left-8 flex items-end gap-6">
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
        <div className="absolute bottom-4 right-8 flex gap-3">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-2 px-6 py-2.5 bg-white text-slate-900 rounded-2xl text-sm font-bold shadow-lg hover:bg-slate-50 transition-all"
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
      </div>

      <div className="mt-20 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <div className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold bg-slate-900 text-white shadow-xl shadow-slate-200">
            <Building2 className="w-5 h-5 text-emerald-400" />
            General Info
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[500px]">
          <AnimatePresence mode="wait">
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
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default PharmacyProfile;
