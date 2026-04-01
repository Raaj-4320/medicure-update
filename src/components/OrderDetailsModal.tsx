import React from 'react';
import { X } from 'lucide-react';

type OrderDetailsModalProps = {
  order: any | null;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  userNameMap?: Record<string, string>;
  pharmacyNameMap?: Record<string, string>;
};

const renderValue = (value: any) => {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
};

export default function OrderDetailsModal({
  order,
  isOpen,
  onClose,
  title = 'Order Details',
  userNameMap = {},
  pharmacyNameMap = {},
}: OrderDetailsModalProps) {
  if (!isOpen || !order) return null;

  const items = Array.isArray(order.items) ? order.items : [];
  const deliveryAddress = order.deliveryAddress || {};
  const customerLabel = userNameMap[String(order.customerId || '')] || renderValue(order.customerId);
  const sellerLabel = userNameMap[String(order.sellerId || '')] || renderValue(order.sellerId);
  const pharmacyLabel = pharmacyNameMap[String(order.pharmacyId || '')] || renderValue(order.pharmacyId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-72px)] space-y-6 text-sm">
          <section>
            <h4 className="font-bold text-slate-900 mb-2">Order Info</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <p><span className="font-semibold">Order ID:</span> {renderValue(order.id)}</p>
              <p><span className="font-semibold">Trace ID:</span> {renderValue(order.traceId)}</p>
              <p><span className="font-semibold">Status:</span> {renderValue(order.status)}</p>
              <p><span className="font-semibold">Created At:</span> {renderValue(order.createdAt)}</p>
              <p><span className="font-semibold">Updated At:</span> {renderValue(order.updatedAt)}</p>
              <p><span className="font-semibold">Total Amount:</span> ₹{Number(order.totalAmount || 0).toFixed(2)}</p>
            </div>
          </section>

          <section>
            <h4 className="font-bold text-slate-900 mb-2">Customer / Pharmacy</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <p><span className="font-semibold">Customer:</span> {customerLabel}</p>
              <p><span className="font-semibold">Seller:</span> {sellerLabel}</p>
              <p><span className="font-semibold">Pharmacy:</span> {pharmacyLabel}</p>
              <p><span className="font-semibold">Address ID:</span> {renderValue(order.addressId)}</p>
            </div>
          </section>

          <section>
            <h4 className="font-bold text-slate-900 mb-2">Delivery Address</h4>
            {deliveryAddress && (deliveryAddress.addressLine || deliveryAddress.area || deliveryAddress.city || deliveryAddress.type) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <p><span className="font-semibold">Type:</span> {renderValue(deliveryAddress.type)}</p>
                <p><span className="font-semibold">Address Line:</span> {renderValue(deliveryAddress.addressLine)}</p>
                <p><span className="font-semibold">Area:</span> {renderValue(deliveryAddress.area)}</p>
                <p><span className="font-semibold">City:</span> {renderValue(deliveryAddress.city)}</p>
                <p><span className="font-semibold">Address ID:</span> {renderValue(order.addressId || deliveryAddress.id)}</p>
              </div>
            ) : (
              <p className="text-slate-500">Address not available.</p>
            )}
          </section>

          <section>
            <h4 className="font-bold text-slate-900 mb-2">Items</h4>
            {items.length === 0 ? (
              <p className="text-slate-500">No items available.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item: any, index: number) => (
                  <div key={`${item.medicineId || 'item'}-${index}`} className="border border-slate-200 rounded-lg p-3">
                    <p><span className="font-semibold">Medicine ID:</span> {renderValue(item.medicineId)}</p>
                    <p><span className="font-semibold">Medicine Master ID:</span> {renderValue(item.medicineMasterId)}</p>
                    <p><span className="font-semibold">Quantity:</span> {renderValue(item.quantity)}</p>
                    <p><span className="font-semibold">Price:</span> ₹{Number(item.price || 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h4 className="font-bold text-slate-900 mb-2">Payment</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <p><span className="font-semibold">Payment Method:</span> {renderValue(order.paymentMethod)}</p>
              <p><span className="font-semibold">Payment Status:</span> {renderValue(order.paymentStatus)}</p>
              <p><span className="font-semibold">Payment ID:</span> {renderValue(order.paymentId)}</p>
              <p><span className="font-semibold">Payment Record ID:</span> {renderValue(order.paymentRecordId)}</p>
              <p><span className="font-semibold">Transaction Reference:</span> {renderValue(order.transactionReference)}</p>
            </div>
          </section>

          <section>
            <h4 className="font-bold text-slate-900 mb-2">Prescription</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <p><span className="font-semibold">Prescription ID:</span> {renderValue(order.prescriptionId)}</p>
              <p><span className="font-semibold">Prescription URL:</span> {renderValue(order.prescriptionUrl)}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
