export type UserRole = 'admin' | 'seller' | 'customer' | 'delivery' | 'pharmacist' | 'compliance_officer' | 'logistics_manager' | 'support_agent';

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetId: string;
  targetType: 'user' | 'pharmacy' | 'medicine' | 'order' | 'prescription' | 'system';
  details: string;
  timestamp: string;
  ipAddress?: string;
}

export interface FraudAlert {
  id: string;
  targetId: string;
  targetType: 'user' | 'pharmacy' | 'transaction';
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  createdAt: string;
}

export type DrugSchedule = 'None' | 'Schedule H' | 'Schedule H1' | 'Schedule X' | 'Narcotic';

export interface MedicineMaster {
  id: string;
  brandName: string;
  genericName: string;
  category: string;
  dosageForm: string;
  strength: string;
  rxRequired: boolean;
  schedule: DrugSchedule;
  description: string;
  manufacturer: string;
  image: string;
  isRestricted: boolean;
}

export interface BatchRecall {
  id: string;
  medicineId: string;
  batchNumber: string;
  reason: string;
  initiatedBy: string;
  status: 'active' | 'completed';
  createdAt: string;
}

export interface LogisticsSLA {
  id: string;
  orderId: string;
  expectedDeliveryTime: string;
  actualDeliveryTime?: string;
  isDelayed: boolean;
  delayReason?: string;
  temperatureLogs?: number[];
  requiresColdChain: boolean;
  currentTemp?: number;
}

export interface FinancialRecord {
  id: string;
  orderId: string;
  pharmacyId: string;
  totalAmount: number;
  commissionAmount: number;
  sellerPayout: number;
  gstAmount: number;
  status: 'pending' | 'reconciled' | 'paid';
  createdAt: string;
}

export interface Address {
  id: string;
  label: string;
  country: string;
  state: string;
  city: string;
  area: string;
  locality: string;
  pincode: string;
  landmark?: string;
  isDefault: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status?: 'active' | 'blocked';
  phoneNumber?: string;
  photoURL?: string;
  addresses: Address[];
  createdAt: string;
}

export interface Pharmacy {
  id: string;
  sellerId: string;
  ownerId?: string;
  name: string;
  description: string;
  address: Partial<Address>;
  contactNumber: string;
  email: string;
  operatingHours: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  status?: 'pending' | 'verified' | 'rejected';
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  minOrderValue: number;
  deliveryFee: number;
  rating: number;
  reviewCount: number;
  image: string;
  createdAt: string;
}

export interface ServiceArea {
  id: string;
  pharmacyId: string;
  city: string;
  area: string;
  pincode: string;
  deliveryTime: string;
}

export interface SellerMedicine {
  id: string;
  traceId?: string;
  pharmacyId: string;
  medicineMasterId: string;
  price: number;
  discountPrice?: number;
  stock: number;
  isVisible: boolean;
  isFeatured: boolean;
  // Joined data for convenience
  masterData?: MedicineMaster;
  pharmacyData?: Pharmacy;
}

export interface InventoryBatch {
  id: string;
  sellerMedicineId: string;
  pharmacyId: string;
  batchNumber: string;
  purchaseQty: number;
  soldQty: number;
  currentStock: number;
  expiryDate: string;
  mfgDate: string;
  buyPrice: number;
  sellPrice: number;
  supplier: string;
}

export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'awaiting_prescription' 
  | 'prescription_under_review' 
  | 'dispatched'
  | 'packed' 
  | 'ready_for_pickup' 
  | 'assigned' 
  | 'on_the_way'
  | 'picked_up'
  | 'out_for_delivery' 
  | 'delivered' 
  | 'cancelled' 
  | 'rejected';

export interface Order {
  id: string;
  traceId?: string;
  customerId: string;
  pharmacyId: string;
  status: OrderStatus;
  totalAmount: number;
  deliveryAddress: Partial<Address>;
  orderType: 'delivery' | 'pickup';
  prescriptionId?: string;
  createdAt: string;
  updatedAt: string;
  // Joined data
  items?: OrderItem[];
  pharmacyName?: string;
  customerName?: string;
  paymentId?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  transactionReference?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  sellerMedicineId: string;
  medicineName: string;
  quantity: number;
  price: number;
}

export interface Prescription {
  id: string;
  customerId: string;
  orderId?: string;
  imageUrl: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'clarification_required';
  pharmacistId?: string;
  remarks?: string;
  createdAt: string;
}

export interface DeliveryAssignment {
  id: string;
  traceId?: string;
  orderId: string;
  deliveryStaffId: string;
  status: 'assigned' | 'picked_up' | 'delivered' | 'failed';
  notes?: string;
  assignedAt: string;
  completedAt?: string;
  pickupOtp?: string;
  deliveryOtp?: string;
  proofOfPickup?: string;
  proofOfDelivery?: string;
  failureReason?: string;
  cashCollected?: number;
  temperatureAlert?: boolean;
}

export interface DeliveryWallet {
  id: string;
  userId: string;
  balance: number;
  totalEarnings: number;
  pendingWithdrawals: number;
  lastPayoutDate?: string;
}

export interface DeliveryTransaction {
  id: string;
  walletId: string;
  amount: number;
  type: 'earning' | 'withdrawal' | 'bonus' | 'penalty';
  status: 'pending' | 'completed' | 'failed';
  description: string;
  orderId?: string;
  createdAt: string;
}

export interface DeliveryPerformance {
  userId: string;
  successRate: number;
  onTimeRate: number;
  averageRating: number;
  cancellationRate: number;
  totalDeliveries: number;
  distanceTraveled: number; // in km
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  orderId: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

export interface Notification {
  id: string;
  traceId?: string;
  userId: string;
  orderId?: string;
  title: string;
  message: string;
  type: 'order' | 'stock' | 'system' | 'prescription' | 'payout' | 'compliance';
  isRead: boolean;
  createdAt: string;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  customerId: string;
  pharmacyId: string;
  reason: 'damaged' | 'wrong_item' | 'expired' | 'missing_item' | 'other';
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'picked_up' | 'refunded' | 'replaced';
  items: { medicineName: string; quantity: number }[];
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'order' | 'payout' | 'inventory' | 'account' | 'technical';
  createdAt: string;
  updatedAt: string;
}

export interface SellerPayout {
  id: string;
  pharmacyId: string;
  amount: number;
  commission: number;
  gst: number;
  netAmount: number;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  bankAccount: string;
  transactionId?: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export interface ComplianceDocument {
  id: string;
  sellerId: string;
  type: string;
  documentUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  updatedAt?: string;
}

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'net_banking' | 'wallet';
export type PaymentStatus = 'initiated' | 'processing' | 'successful' | 'failed' | 'pending' | 'refunded';

export interface PaymentRecord {
  id: string;
  paymentId: string;
  orderId?: string;
  customerId: string;
  pharmacyId?: string;
  sellerId?: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionReference: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  failureReason?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}
