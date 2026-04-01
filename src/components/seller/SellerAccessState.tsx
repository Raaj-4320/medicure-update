import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock3 } from 'lucide-react';

type SellerAccessStateProps = {
  mode: 'missing' | 'pending' | 'rejected';
};

const copyByMode = {
  missing: {
    title: 'Pharmacy profile not found',
    description: 'Please complete your store profile first. This section will unlock after setup.',
  },
  pending: {
    title: 'Approval pending',
    description: 'Your pharmacy is pending admin approval. This section will unlock after approval.',
  },
  rejected: {
    title: 'Approval required',
    description: 'Your pharmacy profile needs updates before this section can be accessed.',
  },
} as const;

const SellerAccessState: React.FC<SellerAccessStateProps> = ({ mode }) => {
  const copy = copyByMode[mode];
  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-8 text-center">
      <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
        {mode === 'pending' ? <Clock3 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
      </div>
      <h2 className="text-xl font-bold text-amber-700 mb-2">{copy.title}</h2>
      <p className="text-slate-600 mb-5">{copy.description}</p>
      <Link to="/seller/profile" className="inline-flex px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold">
        Open Store Profile
      </Link>
    </div>
  );
};

export default SellerAccessState;
