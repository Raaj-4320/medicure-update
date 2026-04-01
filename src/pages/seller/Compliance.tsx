import React, { useEffect, useState } from 'react';
import { Plus, Loader2, AlertCircle, Upload } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { api } from '../../services/api';

const Compliance: React.FC = () => {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [type, setType] = useState('license');
  const [documentUrl, setDocumentUrl] = useState('');

  const loadDocs = async () => {
    if (!profile?.uid) {
    setLoading(false);
    return;
  }
    setLoading(true);
    setError('');
    try {
      const data = await api.getCompliance({ ownerId: profile.uid });
      setDocs(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load compliance documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [profile]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    setSubmitting(true);
    setError('');
    try {
      await api.createCompliance({ ownerId: profile.uid, sellerId: profile.uid, type, documentUrl });
      setDocumentUrl('');
      await loadDocs();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload document');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compliance Center</h1>
        <p className="text-slate-500 text-sm">Upload and track your compliance documents.</p>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

      <form onSubmit={handleUpload} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h3 className="font-bold text-slate-900 flex items-center gap-2"><Plus className="w-4 h-4" />Upload Document</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200">
            <option value="license">License</option>
            <option value="certification">Certification</option>
            <option value="gst">GST</option>
            <option value="other">Other</option>
          </select>
          <input value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} placeholder="Document URL" className="px-3 py-2 rounded-xl border border-slate-200 md:col-span-2" required />
        </div>
        <button disabled={submitting} className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold disabled:opacity-60 flex items-center gap-2">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Submit
        </button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
      ) : docs.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center text-slate-600">No compliance documents uploaded yet.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Document</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(docs) ? docs : []).map((doc) => (
                <tr key={doc.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{doc.type}</td>
                  <td className="px-4 py-3 capitalize">{doc.status}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(doc.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3"><a href={doc.documentUrl} className="text-emerald-600 hover:underline" target="_blank" rel="noreferrer">View</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Compliance;
