import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  CreditCard, 
  FileText, 
  CheckCircle2, 
  ChevronRight, 
  Loader2, 
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { api } from '../../services/api';
import { motion, AnimatePresence } from 'motion/react';
import { appLogger } from '../../utils/observability';
import type { PaymentMethod, PaymentStatus } from '../../types';

export default function CheckoutPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedAddress, setSelectedAddress] = useState(profile?.addresses?.[0]?.id ? String(profile.addresses[0].id) : '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('initiated');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentFailureReason, setPaymentFailureReason] = useState('');
  const [paymentRecordId, setPaymentRecordId] = useState('');
  const [prescriptionUploaded, setPrescriptionUploaded] = useState(false);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const availableAddresses = Array.isArray(profile?.addresses)
    ? profile.addresses.map((address: any) => ({
        ...address,
        id: String(address?.id || ''),
      }))
    : [];

  useEffect(() => {
    appLogger.log({
      category: 'PAGE_LOAD_ROUTE',
      event: 'checkout_page_entered',
      status: 'start',
      page: 'CheckoutPage',
      route: '/checkout',
      scope: 'useEffect',
      message: 'Checkout page mounted.',
    });
    // In a real app, we'd fetch cart from API
    // For now, we'll simulate fetching it
    const savedCart = localStorage.getItem('cart');
    if (!savedCart) {
      appLogger.log({
        category: 'ORDER_FLOW',
        event: 'checkout_cart_missing',
        status: 'warning',
        page: 'CheckoutPage',
        message: 'No cart found, redirecting to cart.',
      });
      navigate('/cart');
      return;
    }
    try {
      const parsed = JSON.parse(savedCart);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Cart is empty.');
      }
      setCartItems(parsed);
      appLogger.log({
        category: 'ORDER_FLOW',
        event: 'checkout_cart_loaded',
        status: 'success',
        page: 'CheckoutPage',
        message: 'Cart loaded from storage.',
        meta: { cartCount: parsed.length },
      });
    } catch (cartError) {
      appLogger.log({
        category: 'ORDER_FLOW',
        event: 'checkout_cart_parse_failure',
        status: 'warning',
        page: 'CheckoutPage',
        message: 'Cart data was invalid, redirecting to cart.',
        error: appLogger.errorSummary(cartError),
      });
      navigate('/cart');
    }
  }, [navigate]);

  useEffect(() => {
    if (availableAddresses.length === 0) {
      setSelectedAddress('');
      return;
    }
    const hasSelectedAddress = availableAddresses.some((addr: any) => addr.id === selectedAddress);
    if (!hasSelectedAddress) {
      setSelectedAddress(String(availableAddresses[0].id));
    }
  }, [availableAddresses, selectedAddress]);

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const deliveryFee = 40;
  const total = subtotal + deliveryFee;
  const allowDemoOutcomeControl = import.meta.env.DEV || import.meta.env.VITE_ENABLE_PAYMENT_DEMO_CONTROL === 'true';
  const [showDemoControls, setShowDemoControls] = useState(false);
  const [demoOutcome, setDemoOutcome] = useState<'auto' | 'successful' | 'failed' | 'pending'>('auto');

  const formatMethodLabel = (method: PaymentMethod) => method.replace('_', ' ').toUpperCase();
  const nowLabel = new Date().toLocaleString();

  const resetPaymentUi = () => {
    setError('');
    setPaymentFailureReason('');
    setTransactionRef('');
    setPaymentRecordId('');
    setPaymentStatus('initiated');
  };

  const handleContinueToPayment = () => {
    setError('');
    setStep((prevStep) => (prevStep < 2 ? 2 : prevStep));
    appLogger.log({
      category: 'ORDER_FLOW',
      event: 'checkout_step_transition_success',
      status: 'success',
      page: 'CheckoutPage',
      message: 'Checkout moved from delivery step to payment step.',
      meta: { fromStep: 1, toStep: 2 },
    });
  };

  const handlePlaceOrder = async () => {
    let successfulPaymentRecordId = '';
    setLoading(true);
    resetPaymentUi();
    appLogger.log({
      category: 'UI_ACTION',
      event: 'checkout_place_order_clicked',
      status: 'start',
      page: 'CheckoutPage',
      scope: 'handlePlaceOrder',
      message: 'Place order clicked.',
    });
    try {
      appLogger.log({
        category: 'ORDER_FLOW',
        event: 'checkout_validation_started',
        status: 'start',
        page: 'CheckoutPage',
        message: 'Checkout validations started.',
      });
      if (!profile?.uid) {
        appLogger.log({
          category: 'AUTH_PROFILE_PHARMACY',
          event: 'checkout_missing_profile',
          status: 'failure',
          page: 'CheckoutPage',
          message: 'Cannot place order without authenticated profile uid.',
        });
        throw new Error('You must be logged in to place an order.');
      }
      const checkoutPharmacyId = cartItems[0]?.pharmacyId;
      if (!checkoutPharmacyId) {
        throw new Error('Cart is missing pharmacy information. Please re-add items.');
      }
      const pharmacy = (await api.getPharmacies({ id: checkoutPharmacyId }))?.[0];
      const selectedAddressData = availableAddresses.find((addr: any) => String(addr.id) === selectedAddress) || null;
      if (!selectedAddressData) {
        setError('Please select a valid delivery address.');
        appLogger.log({
          category: 'ORDER_FLOW',
          event: 'checkout_address_resolution_failure',
          status: 'warning',
          page: 'CheckoutPage',
          message: 'Address resolution failed before order creation.',
          meta: { selectedAddress, availableAddressCount: availableAddresses.length },
        });
        return;
      }
      appLogger.log({
        category: 'ORDER_FLOW',
        event: 'checkout_validation_passed',
        status: 'success',
        page: 'CheckoutPage',
        message: 'Checkout validations passed.',
        ids: { customerId: profile.uid, pharmacyId: checkoutPharmacyId },
        meta: { selectedAddress: selectedAddressData.id, cartCount: cartItems.length, totalAmount: total },
      });
      // 1. Process payment in demo-safe simulated flow
      setPaymentStatus('processing');
      appLogger.log({
        category: 'ORDER_FLOW',
        event: 'checkout_payment_started',
        status: 'start',
        page: 'CheckoutPage',
        message: 'Payment processing started.',
        ids: { customerId: profile.uid, pharmacyId: checkoutPharmacyId },
        meta: { method: paymentMethod, totalAmount: total, cartCount: cartItems.length },
      });
      const paymentResponse = await api.processPayment({
        orderId: `temp-${Date.now()}`,
        amount: total,
        method: paymentMethod,
        customerId: profile.uid,
        pharmacyId: checkoutPharmacyId,
        sellerId: pharmacy?.ownerId || pharmacy?.sellerId || '',
        metadata: {
          cartSize: cartItems.length,
          demoMode: true,
        },
        forceOutcome: demoOutcome === 'auto' ? undefined : demoOutcome,
      });
      setPaymentStatus(paymentResponse.status);
      setTransactionRef(paymentResponse.transactionId || '');
      setPaymentRecordId(paymentResponse.paymentId || '');
      appLogger.log({
        category: 'ORDER_FLOW',
        event: 'checkout_payment_result',
        status: paymentResponse.success ? 'success' : 'failure',
        page: 'CheckoutPage',
        message: paymentResponse.success ? 'Payment processed successfully.' : 'Payment failed before order creation.',
        ids: { customerId: profile.uid, pharmacyId: checkoutPharmacyId },
        meta: { paymentId: paymentResponse.paymentId, paymentStatus: paymentResponse.status },
      });

      if (!paymentResponse.success) {
        setPaymentFailureReason(paymentResponse.failureReason || 'Payment failed. Please retry.');
        throw new Error(paymentResponse.message || 'Payment failed. Please try again.');
      }

      // 2. Create Order
      let prescriptionId: string | null = null;
      if (prescriptionUploaded) {
        const createdPrescription = await api.createPrescription({
          userId: profile.uid,
          pharmacyId: checkoutPharmacyId,
          status: 'pending',
          imageUrl: 'https://example.com/rx.jpg',
        });
        prescriptionId = createdPrescription.id;
      }

      const orderData = {
        customerId: profile.uid,
        pharmacyId: checkoutPharmacyId,
        sellerId: pharmacy?.ownerId || pharmacy?.sellerId || '',
        medicineMasterId: cartItems[0]?.medicineMasterId || cartItems[0]?.medicineId || cartItems[0]?.id || '',
        quantity: Number(cartItems[0]?.quantity || 1),
        price: Number(cartItems[0]?.price || 0),
        items: cartItems.map(item => ({
          medicineId: item.medicineMasterId || item.medicineId || item.id,
          medicineMasterId: item.medicineMasterId || item.medicineId || item.id,
          quantity: item.quantity,
          price: item.price
        })),
        totalAmount: total,
        addressId: selectedAddress,
        deliveryAddress: selectedAddressData,
        paymentMethod,
        paymentStatus: paymentResponse.status,
        paymentId: paymentResponse.paymentId,
        paymentRecordId: paymentResponse.paymentId,
        transactionReference: paymentResponse.transactionId,
        prescriptionId,
        prescriptionUrl: prescriptionUploaded ? 'https://example.com/rx.jpg' : null
      };
      successfulPaymentRecordId = paymentResponse.paymentId;
      appLogger.log({
        category: 'ORDER_FLOW',
        event: 'checkout_order_payload_constructed',
        status: 'success',
        page: 'CheckoutPage',
        message: 'Order payload prepared.',
        ids: { customerId: profile.uid, pharmacyId: checkoutPharmacyId },
        meta: { itemCount: orderData.items.length, totalAmount: orderData.totalAmount, paymentStatus: orderData.paymentStatus },
      });

      appLogger.log({
        category: 'ORDER_FLOW',
        event: 'checkout_create_order_started',
        status: 'start',
        page: 'CheckoutPage',
        message: 'Order creation request started.',
      });
      const order = await api.createOrder(orderData);
      if (!order?.id) {
        throw new Error('Order creation did not return a valid order id.');
      }
      appLogger.log({
        category: 'ORDER_FLOW',
        event: 'checkout_order_write_success',
        status: 'success',
        page: 'CheckoutPage',
        message: 'Order write succeeded.',
        ids: { orderId: order.id, customerId: profile.uid, pharmacyId: checkoutPharmacyId },
      });
      if (paymentResponse.paymentId) {
        appLogger.log({
          category: 'ORDER_FLOW',
          event: 'checkout_payment_link_patch_started',
          status: 'start',
          page: 'CheckoutPage',
          message: 'Linking payment with persisted order.',
          ids: { orderId: order.id },
          meta: { paymentId: paymentResponse.paymentId },
        });
        await api.updatePayment(paymentResponse.paymentId, {
          orderId: order.id,
          notes: `Linked to order ${order.id}`,
        });
        appLogger.log({
          category: 'ORDER_FLOW',
          event: 'checkout_payment_link_patch_success',
          status: 'success',
          page: 'CheckoutPage',
          message: 'Payment linked with order.',
          ids: { orderId: order.id },
          meta: { paymentId: paymentResponse.paymentId },
        });
      }
      setOrderId(order.id);
      appLogger.log({
        category: 'ORDER_FLOW',
        event: 'checkout_success_ui_shown',
        status: 'success',
        page: 'CheckoutPage',
        message: 'Checkout success state rendered.',
        ids: { orderId: order.id },
      });

      // 3. Clear Cart
      localStorage.removeItem('cart');
      
      setStep(3); // Success step
    } catch (err: any) {
      if (successfulPaymentRecordId) {
        appLogger.log({
          category: 'ORDER_FLOW',
          event: 'checkout_payment_link_patch_failure',
          status: 'warning',
          page: 'CheckoutPage',
          message: 'Order failed after payment success; payment flagged for manual review.',
          meta: { paymentId: successfulPaymentRecordId },
          error: appLogger.errorSummary(err),
        });
        await api.updatePayment(successfulPaymentRecordId, {
          paymentStatus: 'pending',
          failureReason: 'Order creation failed after payment success. Needs manual review.',
          notes: 'Order link failed in checkout flow',
        });
      }
      setError(err.message || 'Failed to place order');
      appLogger.log({
        category: 'ORDER_FLOW',
        event: 'checkout_order_write_failure',
        status: 'failure',
        page: 'CheckoutPage',
        message: 'Checkout flow failed.',
        ids: { customerId: profile?.uid, pharmacyId: cartItems[0]?.pharmacyId },
        meta: { cartCount: cartItems.length, totalAmount: total },
        error: appLogger.errorSummary(err),
      });
      appLogger.log({
        category: 'UI_ACTION',
        event: 'checkout_failure_ui_shown',
        status: 'warning',
        page: 'CheckoutPage',
        message: 'Checkout error message shown to user.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-full transition-colors">
            <ChevronRight className="w-6 h-6 rotate-180" />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Address & Prescription */}
            <div className={`bg-white rounded-2xl p-6 border border-slate-200 ${step > 1 ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center font-bold">1</div>
                <h2 className="text-lg font-bold text-slate-900">Delivery & Prescription</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">Select Delivery Address</label>
                  <div className="grid grid-cols-1 gap-3">
                    {availableAddresses.map((addr: any) => (
                      <label 
                        key={addr.id}
                        className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedAddress === addr.id ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="address" 
                          className="mt-1 text-emerald-600 focus:ring-emerald-500"
                          checked={selectedAddress === addr.id}
                          onChange={() => setSelectedAddress(String(addr.id))}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <span className="font-bold text-slate-900">{addr.type}</span>
                          </div>
                          <p className="text-sm text-slate-600">{addr.addressLine}, {addr.area}, {addr.city}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-amber-900 mb-1">Prescription Required</h3>
                      <p className="text-xs text-amber-700 mb-3">Some items in your cart require a valid prescription.</p>
                      <button 
                        onClick={() => setPrescriptionUploaded(true)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                          prescriptionUploaded 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-white text-amber-600 border border-amber-200'
                        }`}
                      >
                        {prescriptionUploaded ? '✓ Prescription Uploaded' : 'Upload Prescription'}
                      </button>
                    </div>
                  </div>
                </div>

                {step === 1 && (
                  <button 
                    onClick={handleContinueToPayment}
                    className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                    Continue to Payment
                  </button>
                )}
              </div>
            </div>

            {/* Step 2: Payment */}
            <div className={`bg-white rounded-2xl p-6 border border-slate-200 ${step < 2 ? 'opacity-40' : ''} ${step > 2 ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center font-bold">2</div>
                <h2 className="text-lg font-bold text-slate-900">Payment Method</h2>
              </div>

              {step >= 2 && (
                <div className="space-y-4">
                  <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'upi' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100'
                  }`}>
                    <input 
                      type="radio" 
                      name="payment" 
                      checked={paymentMethod === 'upi'}
                      onChange={() => setPaymentMethod('upi')}
                      className="text-emerald-600"
                    />
                    <CreditCard className="w-5 h-5 text-slate-400" />
                    <span className="font-bold text-slate-900">UPI</span>
                  </label>

                  <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'card' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-100'
                  }`}>
                    <input 
                      type="radio" 
                      name="payment" 
                      checked={paymentMethod === 'card'}
                      onChange={() => setPaymentMethod('card')}
                      className="text-emerald-600"
                    />
                    <CreditCard className="w-5 h-5 text-slate-400" />
                    <span className="font-bold text-slate-900">Card</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'net_banking', 'wallet'] as PaymentMethod[]).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`px-2 py-2 rounded-lg text-xs font-bold border ${
                          paymentMethod === method ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {method.replace('_', ' ').toUpperCase()}
                      </button>
                    ))}
                  </div>
                  {(paymentStatus === 'processing' || paymentStatus === 'failed' || paymentStatus === 'pending') && (
                    <div className="p-3 rounded-lg bg-slate-50 text-xs text-slate-700 border border-slate-200">
                      <p><span className="font-bold">Payment Status:</span> {paymentStatus.toUpperCase()}</p>
                      {transactionRef && <p><span className="font-bold">Transaction Reference:</span> {transactionRef}</p>}
                      {paymentRecordId && <p><span className="font-bold">Payment Record ID:</span> {paymentRecordId}</p>}
                      {paymentFailureReason && <p className="text-red-600 mt-1">{paymentFailureReason}</p>}
                    </div>
                  )}
                  {allowDemoOutcomeControl && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-dashed border-slate-300 text-xs">
                      <button
                        type="button"
                        onClick={() => setShowDemoControls((prev) => !prev)}
                        className="font-bold text-slate-700 underline underline-offset-2"
                      >
                        {showDemoControls ? 'Hide demo controls' : 'Show demo controls'}
                      </button>
                      {showDemoControls && (
                        <div className="mt-2">
                          <p className="font-bold text-slate-700 mb-2">Demo outcome (dev-only helper)</p>
                          <select
                            value={demoOutcome}
                            onChange={(e) => setDemoOutcome(e.target.value as 'auto' | 'successful' | 'failed' | 'pending')}
                            className="w-full px-2 py-2 rounded border border-slate-300 bg-white text-slate-700"
                          >
                            <option value="auto">Auto (default success)</option>
                            <option value="successful">Force Successful</option>
                            <option value="failed">Force Failed</option>
                            <option value="pending">Force Pending</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}

                  {step === 2 && (
                    <button 
                      onClick={handlePlaceOrder}
                      disabled={loading}
                      className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Pay ₹${total.toFixed(2)} and Place Order`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 sticky top-8">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Order Summary</h2>
              <div className="space-y-4 mb-6">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-slate-600">{item.brandName} x {item.quantity}</span>
                    <span className="font-bold text-slate-900">₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-900">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Delivery Fee</span>
                  <span className="text-emerald-600 font-medium">₹{deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-100">
                  <span className="text-slate-900">Total</span>
                  <span className="text-emerald-600">₹{total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {step === 3 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Order Placed!</h2>
              <p className="text-slate-500 mb-6">Your payment is confirmed and your order is now being processed.</p>
              <div className="mb-6 text-left text-sm bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
                <p><span className="font-bold text-slate-700">Order Reference:</span> #{orderId}</p>
                <p><span className="font-bold text-slate-700">Amount:</span> ₹{total.toFixed(2)}</p>
                <p><span className="font-bold text-slate-700">Payment Method:</span> {formatMethodLabel(paymentMethod)}</p>
                <p><span className="font-bold text-slate-700">Payment Status:</span> {paymentStatus.toUpperCase()}</p>
                {transactionRef && <p><span className="font-bold text-slate-700">Transaction Reference:</span> {transactionRef}</p>}
                <p><span className="font-bold text-slate-700">Date & Time:</span> {nowLabel}</p>
              </div>
              <button 
                onClick={() => navigate('/orders')}
                className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all"
              >
                Track My Order
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
