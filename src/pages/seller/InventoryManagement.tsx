import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, Pencil, Search, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';
import { SellerMedicine } from '../../types';

const InventoryManagement: React.FC = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pharmacyId, setPharmacyId] = useState('');
  const [medicines, setMedicines] = useState<SellerMedicine[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    stock: '',
    rxRequired: false,
    image: '',
    imagePath: '',
  });

  const fetchSellerMedicines = async () => {
    if (!profile?.uid) return;
    try {
      setLoading(true);
      let pharmacies = await api.getPharmacies({ ownerId: profile.uid });
      if (!pharmacies.length) {
        await api.createPharmacy({
          id: profile.uid,
          ownerId: profile.uid,
          sellerId: profile.uid,
          name: `${profile.displayName || 'Seller'} Pharmacy`,
          email: profile.email || '',
          contactNumber: profile.phoneNumber || '',
          status: 'pending',
          verificationStatus: 'pending',
          description: '',
          address: {},
          operatingHours: '09:00-21:00',
        });
        pharmacies = await api.getPharmacies({ ownerId: profile.uid });
      }
      if (!pharmacies.length) throw new Error('Unable to initialize seller pharmacy.');
      const sellerPharmacyId = pharmacies[0].id;
      setPharmacyId(sellerPharmacyId);
      setErrorMessage('');

      const mine = await api.getInventory({ sellerId: profile.uid, pharmacyId: sellerPharmacyId });
      setMedicines(mine);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to load seller medicines.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerMedicines();
  }, [profile?.uid]);

  const cloudinaryCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const cloudinaryUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const cloudinaryFolder = import.meta.env.VITE_CLOUDINARY_FOLDER || 'seller-medicines';

  const uploadToCloudinary = async (file: File, sellerId: string): Promise<{ secureUrl: string; publicId: string }> => {
    if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
      throw new Error('Cloudinary is not configured. Please set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.');
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryUploadPreset);
    formData.append('folder', `${cloudinaryFolder}/${sellerId}`);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error('Cloudinary upload failed. Please retry.');
    }
    const payload = await response.json();
    if (!payload?.secure_url) {
      throw new Error('Cloudinary upload returned an invalid response.');
    }
    return { secureUrl: payload.secure_url as string, publicId: (payload.public_id as string) || '' };
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile?.uid) return;
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file.');
      event.target.value = '';
      return;
    }
    const preview = URL.createObjectURL(file);
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl(preview);
    try {
      setUploadingImage(true);
      setErrorMessage('');
      setSuccessMessage('');
      console.info('[SELLER_IMAGE_UPLOAD] started', { name: file.name, size: file.size, type: file.type });
      const uploadResult = await uploadToCloudinary(file, profile.uid);
      setForm((prev) => ({ ...prev, image: uploadResult.secureUrl, imagePath: uploadResult.publicId }));
      console.info('[SELLER_IMAGE_UPLOAD] success', { path: uploadResult.publicId });
      setSuccessMessage('Image uploaded.');
    } catch (error: any) {
      console.error('[SELLER_IMAGE_UPLOAD] failed', error);
      setErrorMessage(error?.message || 'Image upload failed.');
      setForm((prev) => ({ ...prev, image: '', imagePath: '' }));
    } finally {
      setUploadingImage(false);
      if (event.target) event.target.value = '';
    }
  };

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const handleCreateMedicine = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.uid) {
      setErrorMessage('Seller profile not found.');
      return;
    }
    if (!pharmacyId) return;
    if (!form.name || !form.description || !form.category || !form.price || !form.stock) {
      setErrorMessage('Please complete all required fields.');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage('');
      await api.createInventoryEntry({
        sellerId: profile.uid,
        pharmacyId,
        name: form.name,
        description: form.description,
        category: form.category,
        price: Number(form.price),
        stock: Number(form.stock),
        rxRequired: form.rxRequired,
        image: form.image,
        imagePath: form.imagePath,
        isVisible: true,
        isFeatured: false,
        isActive: true,
      });
      setForm({
        name: '',
        description: '',
        category: '',
        price: '',
        stock: '',
        rxRequired: false,
        image: '',
        imagePath: '',
      });
      setSuccessMessage('Medicine created successfully.');
      await fetchSellerMedicines();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to create medicine.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this medicine?')) return;
    try {
      await api.deleteInventory(id, profile?.uid);
      setSuccessMessage('Medicine deleted.');
      await fetchSellerMedicines();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to delete medicine.');
    }
  };

  const handleQuickEdit = async (item: SellerMedicine) => {
    const price = Number(window.prompt('Update price', String(item.price)) || item.price);
    const stock = Number(window.prompt('Update stock', String(item.stock)) || item.stock);
    try {
      await api.updateInventory(item.id, { price, stock, sellerId: profile?.uid || '' });
      setSuccessMessage('Medicine updated.');
      await fetchSellerMedicines();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to update medicine.');
    }
  };

  const filteredMedicines = useMemo(
    () =>
      medicines.filter((item) => {
        const query = searchQuery.toLowerCase();
        return (
          (item.name || '').toLowerCase().includes(query) ||
          (item.category || '').toLowerCase().includes(query) ||
          (item.description || '').toLowerCase().includes(query)
        );
      }),
    [medicines, searchQuery],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Medicines</h1>
          <p className="text-slate-500 text-sm">Create and manage your own seller medicines directly.</p>
        </div>
      </div>

      {errorMessage && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium">{errorMessage}</div>}
      {successMessage && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium">{successMessage}</div>}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-4">Add Medicine</h3>
        <form onSubmit={handleCreateMedicine} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Medicine name"
              className="px-3 py-2 rounded-xl border border-slate-200"
            />
            <input
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="Category"
              className="px-3 py-2 rounded-xl border border-slate-200"
            />
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              placeholder="Price"
              className="px-3 py-2 rounded-xl border border-slate-200"
            />
            <input
              type="number"
              value={form.stock}
              onChange={(e) => setForm((prev) => ({ ...prev, stock: e.target.value }))}
              placeholder="Quantity/Stock"
              className="px-3 py-2 rounded-xl border border-slate-200"
            />
          </div>

          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Description"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 min-h-24"
          />

          <div className="flex items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.rxRequired}
                onChange={(e) => setForm((prev) => ({ ...prev, rxRequired: e.target.checked }))}
              />
              Prescription required
            </label>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                title="Upload medicine image"
              >
                <ImagePlus className="w-5 h-5" />
              </button>
              <span className="text-xs text-slate-500">{uploadingImage ? 'Uploading image…' : form.image ? 'Image attached' : 'Add image (+)'}</span>
            </div>
          </div>

          {(localPreviewUrl || form.image) && (
            <img src={localPreviewUrl || form.image} alt="Medicine upload" className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
          )}

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Medicine'}
          </button>
        </form>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search your medicines"
          className="w-full px-2 py-1 outline-none text-sm"
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Medicine</th>
                <th className="px-6 py-4 font-semibold">Category</th>
                <th className="px-6 py-4 font-semibold">Stock</th>
                <th className="px-6 py-4 font-semibold">Price</th>
                <th className="px-6 py-4 font-semibold">Rx</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMedicines.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden">
                        {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : null}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.name || 'Unnamed medicine'}</p>
                        <p className="text-xs text-slate-500 line-clamp-1">{item.description || '-'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm">{item.category || '-'}</td>
                  <td className="px-6 py-4 text-sm font-bold">{item.stock}</td>
                  <td className="px-6 py-4 text-sm font-bold">₹{item.price}</td>
                  <td className="px-6 py-4 text-sm">{item.rxRequired ? 'Yes' : 'No'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleQuickEdit(item)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMedicines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No medicines found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InventoryManagement;
