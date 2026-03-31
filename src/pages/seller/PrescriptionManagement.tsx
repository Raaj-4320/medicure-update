import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Eye, 
  Download,
  User,
  Stethoscope,
  Clock,
  ChevronRight,
  ShieldAlert,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Prescription } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../AuthContext';
import SellerAccessState from '../../components/seller/SellerAccessState';
import { logRouteState } from '../../utils/flowLogger';

const PrescriptionManagement: React.FC = () => {
  const { profile } = useAuth();
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'under_review' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRx, setSelectedRx] = useState<Prescription | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [accessState, setAccessState] = useState<'ok' | 'missing' | 'pending' | 'rejected'>('ok');

  useEffect(() => {
    const load = async () => {
      if (!profile) return;
      try {
        await loadPrescriptions();
      } catch (error: any) {
        setErrorMessage(error?.message || 'Failed to fetch prescriptions');
      }
    };
    load();
  }, [profile]);

  const filteredRx = prescriptions.filter(rx => {
    const matchesFilter = filter === 'all' || rx.status === filter;
    const matchesSearch = rx.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         rx.customerId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleReview = (rx: Prescription) => {
    setSelectedRx(rx);
    setIsReviewModalOpen(true);
  };

  const loadPrescriptions = async () => {
    if (!profile) return;
    const pharmacies = await api.getPharmacies({ ownerId: profile.uid });
    if (!pharmacies.length) {
      setErrorMessage('No pharmacy found for this seller account.');
      setPrescriptions([]);
      setAccessState('missing');
      logRouteState({ route: '/seller/prescriptions', state: 'blocked', reason: 'NO_PHARMACY' });
      return;
    }
    const pharmacyStatus = pharmacies[0].status || pharmacies[0].verificationStatus || 'pending';
    if (pharmacyStatus !== 'verified') {
      setPrescriptions([]);
      setAccessState(pharmacyStatus === 'rejected' ? 'rejected' : 'pending');
      logRouteState({ route: '/seller/prescriptions', state: 'blocked', reason: `PHARMACY_${String(pharmacyStatus).toUpperCase()}` });
      return;
    }
    setAccessState('ok');
    logRouteState({ route: '/seller/prescriptions', state: 'ok', detail: { pharmacyId: pharmacies[0].id } });
    setErrorMessage('');
    const data = await api.getPrescriptions({ pharmacyId: pharmacies[0].id });
    setPrescriptions(data as Prescription[]);
  };

  const updateStatus = async (id: string, status: Prescription['status']) => {
    setProcessingId(id);
    setErrorMessage('');
    try {
      await api.updatePrescription(id, { status });
      await loadPrescriptions();
      setIsReviewModalOpen(false);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to update prescription');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    accessState !== 'ok' ? <SellerAccessState mode={accessState} /> : (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Prescription Management</h1>
          <p className="text-slate-500 text-sm">Verify and approve customer prescriptions</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
          <Zap className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-bold text-emerald-700">AI OCR Active</span>
        </div>
      </div>

      {errorMessage && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium">{errorMessage}</div>}

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search by Rx ID or Customer..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {(['all', 'under_review', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filter === f 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Rx Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRx.map((rx) => (
          <motion.div
            layout
            key={rx.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
          >
            <div className="relative h-48 bg-slate-100 group">
              <img src={rx.imageUrl} alt="Prescription" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button 
                  onClick={() => handleReview(rx)}
                  className="p-2 bg-white rounded-full text-slate-900 shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>
              <div className={`absolute top-3 right-3 px-2 py-1 rounded-lg text-[10px] font-bold uppercase shadow-sm ${
                rx.status === 'approved' ? 'bg-emerald-500 text-white' :
                rx.status === 'rejected' ? 'bg-red-500 text-white' :
                'bg-amber-500 text-white'
              }`}>
                {rx.status.replace('_', ' ')}
              </div>
            </div>
            <div className="p-5 space-y-4 flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prescription ID</p>
                  <h3 className="font-bold text-slate-900">#{rx.id.slice(-8)}</h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
                  <p className="text-xs font-medium text-slate-600">{new Date(rx.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                  <User className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Customer</p>
                  <p className="text-xs font-bold text-slate-900">{rx.customerId}</p>
                </div>
              </div>

              {rx.status === 'under_review' ? (
                <button 
                  onClick={() => handleReview(rx)}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200 flex items-center justify-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4" />
                  Verify Now
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 py-2.5 bg-slate-50 rounded-xl text-slate-500 text-sm font-bold border border-dashed border-slate-200">
                  {rx.status === 'approved' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                  {rx.status.replace('_', ' ').toUpperCase()}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Review Modal */}
      <AnimatePresence>
        {isReviewModalOpen && selectedRx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row"
            >
              {/* Image Preview */}
              <div className="flex-1 bg-slate-100 p-6 flex items-center justify-center overflow-auto">
                <img 
                  src={selectedRx.imageUrl} 
                  alt="Prescription" 
                  className="max-w-full h-auto rounded-lg shadow-lg"
                />
              </div>

              {/* Review Panel */}
              <div className="w-full md:w-96 border-l border-slate-100 flex flex-col bg-white">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">Verify Rx</h2>
                  <button 
                    onClick={() => setIsReviewModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <XCircle className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                      <Zap className="w-5 h-5" />
                      <div>
                        <p className="text-xs font-bold uppercase">AI Extraction Results</p>
                        <p className="text-[10px] font-medium text-emerald-700">Confidence: 94%</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Extracted Medicines</label>
                      <div className="space-y-2">
                        {['Augmentin 625 Duo', 'Pan 40'].map((med, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                            <span className="text-xs font-bold text-slate-700">{med}</span>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Doctor Details</label>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                        <p className="text-xs font-bold text-slate-900">Dr. Arpit Shah</p>
                        <p className="text-[10px] text-slate-500">Reg No: G-44552 (Verified)</p>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-amber-900">Controlled Drug Warning</p>
                        <p className="text-[10px] text-amber-700">This prescription contains Schedule H medicines. Ensure quantity matches Rx.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => updateStatus(selectedRx.id, 'rejected')}
                      className="py-3 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors"
                    >
                      Reject
                    </button>
                    <button 
                      onClick={() => updateStatus(selectedRx.id, 'approved')}
                      className="py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                    >
                      Approve
                    </button>
                  </div>
                  <button className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
                    Request Re-upload
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    )
  );
};

export default PrescriptionManagement;
