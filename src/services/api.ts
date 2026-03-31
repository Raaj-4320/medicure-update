import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../firebase';
import { logError, logFlow, logTraceFlow, validateRequiredFields } from '../utils/flowLogger';
import type {
  ComplianceDocument,
  DeliveryAssignment,
  MedicineMaster,
  Notification,
  Order,
  PaymentMethod,
  PaymentRecord,
  PaymentStatus,
  Pharmacy,
  Prescription,
  ReturnRequest,
  SellerMedicine,
  SellerPayout,
  SupportTicket,
  UserProfile,
} from '../types';

type Dictionary = Record<string, unknown>;

type FilterOptions = Record<string, string | number | boolean | undefined>;

type PaymentResponse = {
  success: boolean;
  paymentId: string;
  transactionId: string;
  status: PaymentStatus;
  method: PaymentMethod;
  message?: string;
  failureReason?: string;
};

type AnalyticsData = {
  totalOrders: number;
  revenue: number;
  customers: number;
};

const nowIso = () => new Date().toISOString();

const FALLBACK_ANALYTICS: AnalyticsData = {
  totalOrders: 0,
  revenue: 0,
  customers: 0,
};

const makeTraceId = (prefix: 'ord' | 'inv' | 'noti'): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

function getDemoOutcomeOverride(): PaymentStatus | null {
  const explicit = typeof localStorage !== 'undefined' ? localStorage.getItem('demo_payment_outcome') : null;
  const valid = explicit === 'successful' || explicit === 'failed' || explicit === 'pending';
  return valid ? (explicit as PaymentStatus) : null;
}

function toDictionary(value: unknown): Dictionary {
  if (value && typeof value === 'object') {
    return value as Dictionary;
  }
  return {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }
  return [];
}

function normalizeUserProfile(id: string, data: DocumentData): UserProfile {
  const source = toDictionary(data);
  return {
    uid: asString(source.uid, id),
    email: asString(source.email),
    displayName: asString(source.displayName),
    role: (asString(source.role, 'customer') as UserProfile['role']) ?? 'customer',
    phoneNumber: asString(source.phoneNumber),
    photoURL: asString(source.photoURL),
    addresses: Array.isArray(source.addresses) ? (source.addresses as UserProfile['addresses']) : [],
    createdAt: asString(source.createdAt, nowIso()),
  };
}

function normalizePharmacy(id: string, data: DocumentData): Pharmacy {
  const source = toDictionary(data);
  const ownerId = asString(source.ownerId, asString(source.sellerId));
  const verificationStatus = asString(source.verificationStatus, asString(source.status, 'pending'));
  return {
    id,
    sellerId: ownerId,
    ownerId,
    name: asString(source.name),
    description: asString(source.description),
    address: toDictionary(source.address) as Pharmacy['address'],
    contactNumber: asString(source.contactNumber),
    email: asString(source.email),
    operatingHours: asString(source.operatingHours),
    verificationStatus: (verificationStatus as Pharmacy['verificationStatus']) ?? 'pending',
    status: (verificationStatus as Pharmacy['status']) ?? 'pending',
    deliveryAvailable: asBoolean(source.deliveryAvailable),
    pickupAvailable: asBoolean(source.pickupAvailable),
    minOrderValue: asNumber(source.minOrderValue),
    deliveryFee: asNumber(source.deliveryFee),
    rating: asNumber(source.rating),
    reviewCount: asNumber(source.reviewCount),
    image: asString(source.image),
    createdAt: asString(source.createdAt, nowIso()),
  };
}

function hasAddressValue(address: unknown): boolean {
  if (!address || typeof address !== 'object') return false;
  return Object.values(address as Record<string, unknown>).some((value) => typeof value === 'string' && value.trim().length > 0);
}

export function isPharmacyProfileComplete(pharmacy: Partial<Pharmacy> & { verificationDetails?: Dictionary }): boolean {
  const verificationDetails = toDictionary(pharmacy.verificationDetails);
  return Boolean(
    asString(pharmacy.name).trim() &&
      hasAddressValue(pharmacy.address) &&
      asString((pharmacy as Dictionary).phone || pharmacy.contactNumber).trim() &&
      asString(verificationDetails.licenseNumber || (pharmacy as Dictionary).license).trim() &&
      asString(verificationDetails.ownerName || (pharmacy as Dictionary).ownerName).trim(),
  );
}

export function isPharmacyOperational(pharmacy: Partial<Pharmacy> & { verificationDetails?: Dictionary }): boolean {
  return asString(pharmacy.status || pharmacy.verificationStatus) === 'verified' && isPharmacyProfileComplete(pharmacy);
}

function normalizeMedicine(id: string, data: DocumentData): MedicineMaster {
  const source = toDictionary(data);
  return {
    id,
    brandName: asString(source.brandName),
    genericName: asString(source.genericName),
    category: asString(source.category),
    dosageForm: asString(source.dosageForm),
    strength: asString(source.strength),
    rxRequired: asBoolean(source.rxRequired),
    schedule: (asString(source.schedule, 'None') as MedicineMaster['schedule']) ?? 'None',
    description: asString(source.description),
    manufacturer: asString(source.manufacturer),
    image: asString(source.image),
    isRestricted: asBoolean(source.isRestricted),
  };
}

function normalizeInventory(id: string, data: DocumentData): SellerMedicine {
  const source = toDictionary(data);
  return {
    id,
    traceId: asString(source.traceId),
    pharmacyId: asString(source.pharmacyId),
    medicineMasterId: asString(source.medicineMasterId),
    price: asNumber(source.price),
    discountPrice: typeof source.discountPrice === 'number' ? source.discountPrice : undefined,
    stock: asNumber(source.stock),
    isVisible: asBoolean(source.isVisible, true),
    isFeatured: asBoolean(source.isFeatured),
    masterData: source.masterData as SellerMedicine['masterData'],
    pharmacyData: source.pharmacyData as SellerMedicine['pharmacyData'],
  };
}

function normalizeOrder(id: string, data: DocumentData): Order {
  const source = toDictionary(data);
  return {
    id,
    traceId: asString(source.traceId),
    customerId: asString(source.customerId),
    pharmacyId: asString(source.pharmacyId),
    status: (asString(source.status, 'pending') as Order['status']) ?? 'pending',
    totalAmount: asNumber(source.totalAmount),
    deliveryAddress: toDictionary(source.deliveryAddress) as Order['deliveryAddress'],
    orderType: (asString(source.orderType, 'delivery') as Order['orderType']) ?? 'delivery',
    prescriptionId: asString(source.prescriptionId),
    createdAt: asString(source.createdAt, nowIso()),
    updatedAt: asString(source.updatedAt, nowIso()),
    items: Array.isArray(source.items) ? (source.items as Order['items']) : [],
    pharmacyName: asString(source.pharmacyName),
    customerName: asString(source.customerName),
    paymentId: asString(source.paymentId),
    paymentMethod: (asString(source.paymentMethod, 'upi') as PaymentMethod) ?? 'upi',
    paymentStatus: (asString(source.paymentStatus, 'pending') as PaymentStatus) ?? 'pending',
    transactionReference: asString(source.transactionReference),
  };
}

function normalizePrescription(id: string, data: DocumentData): Prescription {
  const source = toDictionary(data);
  return {
    id,
    customerId: asString(source.customerId || source.userId),
    orderId: asString(source.orderId),
    imageUrl: asString(source.imageUrl),
    status: (asString(source.status, 'pending') as Prescription['status']) ?? 'pending',
    pharmacistId: asString(source.pharmacistId),
    remarks: asString(source.remarks),
    createdAt: asString(source.createdAt, nowIso()),
  };
}

function normalizeNotification(id: string, data: DocumentData): Notification {
  const source = toDictionary(data);
  return {
    id,
    traceId: asString(source.traceId),
    userId: asString(source.userId),
    orderId: asString(source.orderId),
    title: asString(source.title),
    message: asString(source.message),
    type: (asString(source.type, 'system') as Notification['type']) ?? 'system',
    isRead: asBoolean(source.isRead),
    createdAt: asString(source.createdAt, nowIso()),
  };
}

function normalizeTicket(id: string, data: DocumentData): SupportTicket & { description?: string } {
  const source = toDictionary(data);
  const message = asString(source.message || source.description);
  return {
    id,
    userId: asString(source.userId),
    subject: asString(source.subject),
    message,
    description: message,
    status: (asString(source.status, 'open') as SupportTicket['status']) ?? 'open',
    priority: (asString(source.priority, 'medium') as SupportTicket['priority']) ?? 'medium',
    category: (asString(source.category, 'technical') as SupportTicket['category']) ?? 'technical',
    createdAt: asString(source.createdAt, nowIso()),
    updatedAt: asString(source.updatedAt, nowIso()),
  };
}

function normalizePayout(id: string, data: DocumentData): SellerPayout {
  const source = toDictionary(data);
  return {
    id,
    pharmacyId: asString(source.pharmacyId),
    amount: asNumber(source.amount),
    commission: asNumber(source.commission),
    gst: asNumber(source.gst),
    netAmount: asNumber(source.netAmount),
    status: (asString(source.status, 'pending') as SellerPayout['status']) ?? 'pending',
    bankAccount: asString(source.bankAccount),
    transactionId: asString(source.transactionId),
    periodStart: asString(source.periodStart, nowIso()),
    periodEnd: asString(source.periodEnd, nowIso()),
    createdAt: asString(source.createdAt, nowIso()),
  };
}

function normalizeCompliance(id: string, data: DocumentData): ComplianceDocument {
  const source = toDictionary(data);
  return {
    id,
    sellerId: asString(source.sellerId),
    type: asString(source.type),
    documentUrl: asString(source.documentUrl),
    status: (asString(source.status, 'pending') as ComplianceDocument['status']) ?? 'pending',
    createdAt: asString(source.createdAt, nowIso()),
  };
}

function normalizeReturn(id: string, data: DocumentData): ReturnRequest {
  const source = toDictionary(data);
  return {
    id,
    orderId: asString(source.orderId),
    customerId: asString(source.customerId),
    pharmacyId: asString(source.pharmacyId),
    reason: (asString(source.reason, 'other') as ReturnRequest['reason']) ?? 'other',
    description: asString(source.description),
    status: (asString(source.status, 'pending') as ReturnRequest['status']) ?? 'pending',
    items: Array.isArray(source.items) ? (source.items as ReturnRequest['items']) : [],
    createdAt: asString(source.createdAt, nowIso()),
  };
}

function normalizeDeliveryAssignment(id: string, data: DocumentData): DeliveryAssignment {
  const source = toDictionary(data);
  return {
    id,
    traceId: asString(source.traceId),
    orderId: asString(source.orderId),
    deliveryStaffId: asString(source.deliveryStaffId),
    status: (asString(source.status, 'assigned') as DeliveryAssignment['status']) ?? 'assigned',
    notes: asString(source.notes),
    assignedAt: asString(source.assignedAt, nowIso()),
    completedAt: asString(source.completedAt),
    pickupOtp: asString(source.pickupOtp),
    deliveryOtp: asString(source.deliveryOtp),
    proofOfPickup: asString(source.proofOfPickup),
    proofOfDelivery: asString(source.proofOfDelivery),
    failureReason: asString(source.failureReason),
    cashCollected: asNumber(source.cashCollected),
    temperatureAlert: asBoolean(source.temperatureAlert),
  };
}

function normalizePayment(id: string, data: DocumentData): PaymentRecord {
  const source = toDictionary(data);
  return {
    id,
    paymentId: asString(source.paymentId, id),
    orderId: asString(source.orderId),
    customerId: asString(source.customerId),
    pharmacyId: asString(source.pharmacyId),
    sellerId: asString(source.sellerId),
    amount: asNumber(source.amount),
    currency: asString(source.currency, 'INR'),
    paymentMethod: (asString(source.paymentMethod, 'upi') as PaymentMethod) ?? 'upi',
    paymentStatus: (asString(source.paymentStatus, 'initiated') as PaymentStatus) ?? 'initiated',
    transactionReference: asString(source.transactionReference),
    createdAt: asString(source.createdAt, nowIso()),
    updatedAt: asString(source.updatedAt, nowIso()),
    paidAt: asString(source.paidAt),
    failureReason: asString(source.failureReason),
    notes: asString(source.notes),
    metadata: toDictionary(source.metadata),
  };
}

function handleFirestoreError(error: unknown, label: string): void {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('requires an index')) {
    console.error(`Firestore index missing (${label}):`, message);
    return;
  }
  console.error(`Error in ${label}:`, error);
}

function applyFilters<T>(rows: T[], filters: FilterOptions = {}): T[] {
  const active = Object.entries(filters).filter(([, value]) => value !== undefined);
  if (active.length === 0) {
    return rows;
  }

  return rows.filter((row) =>
    active.every(([key, value]) => {
      if (value === undefined) return true;
      return (row as Dictionary)[key] === value;
    }),
  );
}

async function listCollection<T>(
  collectionName: string,
  normalize: (id: string, data: DocumentData) => T,
  filters: FilterOptions = {},
): Promise<T[]> {
  try {
    const constraints: QueryConstraint[] = [];
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) {
        constraints.push(where(key, '==', value));
      }
    }

    const ref = collection(db, collectionName);
    const snapshot = constraints.length > 0 ? await getDocs(query(ref, ...constraints)) : await getDocs(ref);
    const rows = snapshot.docs.map((entry) => normalize(entry.id, entry.data()));

    if (constraints.length === 0) {
      return applyFilters(rows, filters);
    }

    return rows;
  } catch (error) {
    handleFirestoreError(error, `listCollection:${collectionName}`);
    return [];
  }
}

async function createDoc<T extends Dictionary>(collectionName: string, payload: T): Promise<string> {
  try {
    const ref = await addDoc(collection(db, collectionName), payload);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, `createDoc:${collectionName}`);
    return '';
  }
}

async function patchDoc(collectionName: string, id: string, patch: Dictionary): Promise<boolean> {
  try {
    await updateDoc(doc(db, collectionName, id), patch);
    return true;
  } catch (error) {
    handleFirestoreError(error, `patchDoc:${collectionName}`);
    return false;
  }
}

async function removeDoc(collectionName: string, id: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, collectionName, id));
    return true;
  } catch (error) {
    handleFirestoreError(error, `removeDoc:${collectionName}`);
    return false;
  }
}

async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? normalizeUserProfile(uid, snap.data()) : null;
  } catch (error) {
    handleFirestoreError(error, 'getUserProfile');
    return null;
  }
}

async function getUsers(): Promise<UserProfile[]> {
  return listCollection('users', normalizeUserProfile);
}

async function createUser(user: Partial<UserProfile> & { uid?: string; id?: string }): Promise<UserProfile> {
  const uid = user.uid ?? user.id ?? `user-${Date.now()}`;
  const payload: Dictionary = {
    uid,
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    role: user.role ?? 'customer',
    status: (user as Dictionary).status ?? 'active',
    phoneNumber: user.phoneNumber ?? '',
    photoURL: user.photoURL ?? '',
    addresses: user.addresses ?? [],
    createdAt: user.createdAt ?? nowIso(),
  };

  await createDoc('users', payload);
  return normalizeUserProfile(uid, payload);
}

async function updateUser(id: string, patch: Dictionary): Promise<UserProfile | null> {
  const ok = await patchDoc('users', id, patch);
  if (!ok) {
    return null;
  }
  const snap = await getDoc(doc(db, 'users', id));
  return snap.exists() ? normalizeUserProfile(id, snap.data()) : null;
}

async function deleteUser(id: string): Promise<boolean> {
  return removeDoc('users', id);
}

async function getPharmacies(filters: FilterOptions = {}): Promise<Pharmacy[]> {
  const normalizedFilters: FilterOptions = { ...filters };

  if (normalizedFilters.sellerId !== undefined && normalizedFilters.ownerId === undefined) {
    normalizedFilters.ownerId = normalizedFilters.sellerId;
    delete normalizedFilters.sellerId;
  }

  const ownerId = asString(normalizedFilters.ownerId);
  if (ownerId) {
    const ownerMatches = await listCollection('pharmacies', normalizePharmacy, { ...normalizedFilters, ownerId });
    const validOwnerMatches = ownerMatches.filter((pharmacy) => Boolean(pharmacy.id) && Boolean(pharmacy.name));
    if (ownerMatches.length > 0 && validOwnerMatches.length === 0) {
      logError('DATA_MISMATCH', {
        type: 'DATA',
        detail: 'Pharmacy exists but not bindable to UI (missing id/name mapping)',
      });
    }
    if (ownerMatches.length > 0) {
      logFlow('GET_PHARMACIES', {
        expected: { ownerId, strategy: 'ownerId query' },
        received: { count: ownerMatches.length, validCount: validOwnerMatches.length },
        status: validOwnerMatches.length === ownerMatches.length ? 'success' : 'partial',
      });
      return validOwnerMatches;
    }

    try {
      const directDoc = await getDoc(doc(db, 'pharmacies', ownerId));
      if (directDoc.exists()) {
        const normalized = normalizePharmacy(directDoc.id, directDoc.data());
        if (!normalized.ownerId) {
          await patchDoc('pharmacies', directDoc.id, {
            ownerId,
            sellerId: normalized.sellerId || ownerId,
            updatedAt: nowIso(),
          });
        }
        logFlow('GET_PHARMACIES', {
          expected: { ownerId, strategy: 'direct doc fallback' },
          received: { count: 1 },
          success: true,
        });
        return [normalized];
      }
    } catch (error) {
      handleFirestoreError(error, 'getPharmacies:docFallback');
    }

    const legacySellerMatches = await listCollection('pharmacies', normalizePharmacy, { sellerId: ownerId });
    if (legacySellerMatches.length > 0) {
      await Promise.all(
        legacySellerMatches.map((pharmacy) =>
          patchDoc('pharmacies', pharmacy.id, {
            ownerId,
            sellerId: ownerId,
            updatedAt: nowIso(),
          }),
        ),
      );
      const migrated = legacySellerMatches.map((pharmacy) => ({ ...pharmacy, ownerId }));
      logFlow('GET_PHARMACIES', {
        expected: { ownerId, strategy: 'legacy sellerId fallback' },
        received: { count: migrated.length },
        success: true,
      });
      return migrated;
    }

    logFlow('GET_PHARMACIES', {
      expected: { ownerId, strategy: 'owner/doc/seller' },
      received: { count: 0 },
      success: false,
      error: 'No pharmacy found',
    });
    return [];
  }

  if (normalizedFilters.status !== undefined && normalizedFilters.verificationStatus === undefined) {
    const statusValue = normalizedFilters.status;
    const [statusMatches, verificationMatches] = await Promise.all([
      listCollection('pharmacies', normalizePharmacy, { ...normalizedFilters, status: statusValue }),
      listCollection('pharmacies', normalizePharmacy, { ...normalizedFilters, verificationStatus: statusValue }),
    ]);
    const merged = [...statusMatches, ...verificationMatches].filter(
      (pharmacy, index, arr) => arr.findIndex((entry) => entry.id === pharmacy.id) === index,
    );
    logFlow('GET_PHARMACIES', {
      expected: { filters: { ...normalizedFilters, status: statusValue }, strategy: 'status+verification fallback' },
      received: { count: merged.length },
      success: true,
    });
    return merged;
  }

  const data = await listCollection('pharmacies', normalizePharmacy, normalizedFilters);
  logFlow('GET_PHARMACIES', {
    expected: { filters: normalizedFilters },
    received: { count: data.length },
    status: data.length > 0 ? 'success' : 'fail',
  });
  return data;
}

async function getPharmaciesForCustomer(): Promise<Pharmacy[]> {
  const verifiedPharmacies = await getPharmacies({ status: 'verified' });
  const visibilityChecks = await Promise.all(
    verifiedPharmacies.map(async (pharmacy) => {
      const inventory = await getInventory({ pharmacyId: pharmacy.id });
      return {
        pharmacy,
        inventoryCount: inventory.length,
        isComplete: isPharmacyOperational(pharmacy as Pharmacy & { verificationDetails?: Dictionary }),
      };
    }),
  );
  const visiblePharmacies = visibilityChecks
    .filter((entry) => entry.inventoryCount > 0 && entry.isComplete)
    .map((entry) => entry.pharmacy);
  logFlow('GET_PHARMACIES_FOR_CUSTOMER', {
    expected: ['verified pharmacy with complete profile and inventory > 0'],
    received: { count: visiblePharmacies.length, sourceCount: verifiedPharmacies.length },
    status: visiblePharmacies.length > 0 ? 'success' : 'partial',
    partialType: visiblePharmacies.length > 0 ? undefined : 'DATA_MISSING',
    suggestion: 'Add inventory and complete profile details for verified pharmacies.',
  });
  return visiblePharmacies;
}

async function updatePharmacy(id: string, patch: Dictionary): Promise<boolean> {
  const normalizedPatch: Dictionary = { ...patch, updatedAt: nowIso() };
  if (patch.status !== undefined && patch.verificationStatus === undefined) {
    normalizedPatch.verificationStatus = patch.status;
  }
  if (patch.verificationStatus !== undefined && patch.status === undefined) {
    normalizedPatch.status = patch.verificationStatus;
  }
  return patchDoc('pharmacies', id, normalizedPatch);
}

async function createPharmacy(payload: Dictionary): Promise<Pharmacy> {
  const ownerId = asString(payload.ownerId, asString(payload.sellerId));
  if (!ownerId) {
    throw new Error('ownerId is required to create pharmacy');
  }
  const normalizedPayload: Dictionary = {
    id: ownerId,
    ownerId,
    sellerId: ownerId,
    name: asString(payload.name, 'New Pharmacy'),
    description: asString(payload.description),
    address: toDictionary(payload.address),
    contactNumber: asString(payload.contactNumber),
    email: asString(payload.email),
    operatingHours: asString(payload.operatingHours, '09:00-21:00'),
    verificationStatus: asString(payload.verificationStatus, 'pending'),
    status: asString(payload.status, 'pending'),
    deliveryAvailable: asBoolean(payload.deliveryAvailable, true),
    pickupAvailable: asBoolean(payload.pickupAvailable, true),
    minOrderValue: asNumber(payload.minOrderValue),
    deliveryFee: asNumber(payload.deliveryFee),
    rating: asNumber(payload.rating),
    reviewCount: asNumber(payload.reviewCount),
    image: asString(payload.image),
    createdAt: nowIso(),
  };

  const pharmacyId = asString(payload.id || ownerId);
  if (pharmacyId) {
    try {
      await setDoc(doc(db, 'pharmacies', pharmacyId), normalizedPayload, { merge: true });
      return normalizePharmacy(pharmacyId, normalizedPayload);
    } catch (error) {
      handleFirestoreError(error, 'createPharmacy');
    }
  }

  const id = await createDoc('pharmacies', normalizedPayload);
  return normalizePharmacy(id || `pharmacy-${Date.now()}`, normalizedPayload);
}

async function getMedicines(filters: FilterOptions = {}): Promise<MedicineMaster[]> {
  const normalizedFilters = { ...filters };
  delete normalizedFilters.includeAll;
  const medicineMaster = await listCollection('medicine_master', normalizeMedicine, normalizedFilters);
  if (medicineMaster.length > 0) {
    return medicineMaster;
  }
  return listCollection('medicines', normalizeMedicine, normalizedFilters);
}

async function createMedicine(payload: Dictionary): Promise<Dictionary> {
  const medicinePayload: Dictionary = {
    ...payload,
    createdAt: nowIso(),
  };

  if (medicinePayload.pharmacyId) {
    if (!asString(medicinePayload.medicineMasterId)) {
      logFlow('CREATE_MEDICINE_INVENTORY', {
        expected: ['medicineMasterId'],
        received: { medicineMasterId: medicinePayload.medicineMasterId },
        success: false,
        error: 'missing medicineMasterId',
      });
      throw new Error('medicineMasterId is required for inventory item');
    }
    if (typeof medicinePayload.price !== 'number' || medicinePayload.price <= 0 || typeof medicinePayload.stock !== 'number' || medicinePayload.stock < 0) {
      logFlow('CREATE_MEDICINE_INVENTORY', {
        expected: ['price > 0', 'stock >= 0'],
        received: { price: medicinePayload.price, stock: medicinePayload.stock },
        success: false,
        error: 'invalid price/stock',
      });
      throw new Error('price must be > 0 and stock must be >= 0');
    }
    const id = await createDoc('inventory', {
      pharmacyId: medicinePayload.pharmacyId,
      medicineMasterId: asString(medicinePayload.medicineMasterId, asString(medicinePayload.id)),
      price: asNumber(medicinePayload.price),
      discountPrice: asNumber(medicinePayload.discountPrice),
      stock: asNumber(medicinePayload.stock, 0),
      isVisible: asBoolean(medicinePayload.isVisible, true),
      isFeatured: asBoolean(medicinePayload.isFeatured),
      createdAt: nowIso(),
      ...medicinePayload,
    });
    return { id, ...medicinePayload };
  }

  const id = await createDoc('medicine_master', medicinePayload);
  return { id, ...medicinePayload };
}

async function updateMedicine(id: string, patch: Dictionary): Promise<boolean> {
  return patchDoc('medicine_master', id, { ...patch, updatedAt: nowIso() });
}

async function getInventory(filters: FilterOptions = {}): Promise<SellerMedicine[]> {
  const inventory = await listCollection('inventory', normalizeInventory, filters);
  const validInventory = inventory.filter((item) => {
    const isValid = Boolean(item.pharmacyId) && Boolean(item.medicineMasterId) && typeof item.price === 'number' && typeof item.stock === 'number';
    if (!isValid) {
      logFlow('GET_INVENTORY_VALIDATION', {
        expected: ['pharmacyId', 'medicineMasterId', 'price:number', 'stock:number'],
        received: item,
        success: false,
      });
    }
    return isValid;
  });
  return validInventory;
}

async function updateInventory(id: string, patch: Dictionary): Promise<boolean> {
  return patchDoc('inventory', id, { ...patch, updatedAt: nowIso() });
}

async function deleteInventory(id: string): Promise<boolean> {
  return removeDoc('inventory', id);
}

async function createInventoryEntry(payload: Dictionary): Promise<SellerMedicine> {
  const traceId = asString(payload.traceId, makeTraceId('inv'));
  const validation = validateRequiredFields(payload, ['pharmacyId', 'medicineMasterId', 'price', 'stock']);
  if (!validation.ok) {
    logFlow('CREATE_INVENTORY', {
      expected: ['pharmacyId', 'medicineMasterId', 'price', 'stock'],
      received: { missing: validation.missing },
      success: false,
      error: 'missing required fields',
    });
    throw new Error('pharmacyId and medicineMasterId are required');
  }
  if (typeof payload.price !== 'number' || payload.price <= 0 || typeof payload.stock !== 'number' || payload.stock < 0) {
    logFlow('CREATE_INVENTORY', {
      expected: ['price > 0', 'stock >= 0'],
      received: { price: payload.price, stock: payload.stock },
      success: false,
      error: 'invalid price or stock',
    });
    throw new Error('price must be > 0 and stock must be >= 0');
  }
  const id = await createDoc('inventory', {
    ...payload,
    traceId,
    createdAt: nowIso(),
    isVisible: asBoolean(payload.isVisible, true),
    isFeatured: asBoolean(payload.isFeatured, false),
  });
  logTraceFlow('CREATE_INVENTORY', traceId, { stage: 'WRITE', detail: { inventoryId: id || null } });
  logFlow('CREATE_INVENTORY', {
    expected: ['inventory record created'],
    received: { id, medicineMasterId: payload.medicineMasterId, pharmacyId: payload.pharmacyId },
    success: Boolean(id),
  });
  return normalizeInventory(id || `inv-${Date.now()}`, {
    ...payload,
    traceId,
    createdAt: nowIso(),
  });
}

async function createOrder(payload: Dictionary): Promise<Order> {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const firstItem = toDictionary(items[0]);
  const orderPayload: Dictionary = {
    ...payload,
    traceId: asString(payload.traceId, makeTraceId('ord')),
    medicineMasterId: asString(payload.medicineMasterId, asString(firstItem.medicineMasterId, asString(firstItem.medicineId))),
    quantity: asNumber(payload.quantity, asNumber(firstItem.quantity, 1)),
    price: asNumber(payload.price, asNumber(firstItem.price)),
    status: asString(payload.status, 'pending'),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const pharmacyId = asString(orderPayload.pharmacyId);
  const pharmacies = await getPharmacies({ id: pharmacyId });
  const pharmacy = pharmacies[0];
  if (!pharmacy || !isPharmacyOperational(pharmacy as Pharmacy & { verificationDetails?: Dictionary })) {
    throw new Error('Order blocked: pharmacy is not operational.');
  }
  const inventory = await getInventory({ pharmacyId });
  if (inventory.length === 0) {
    throw new Error('Order blocked: pharmacy has no active inventory.');
  }
  const id = await createDoc('orders', orderPayload);
  const orderTraceId = asString(orderPayload.traceId);
  logTraceFlow('CREATE_ORDER', orderTraceId, { stage: 'WRITE_ORDER', detail: { orderId: id || null } });
  await createDoc('notifications', {
    traceId: orderTraceId,
    userId: asString(orderPayload.pharmacyId),
    orderId: id,
    title: 'New Order Received',
    message: `New order received (${id})`,
    type: 'order',
    isRead: false,
    createdAt: nowIso(),
  });
  logFlow('CREATE_ORDER', {
    expected: ['customerId', 'pharmacyId', 'totalAmount'],
    received: { id, customerId: orderPayload.customerId, pharmacyId: orderPayload.pharmacyId, totalAmount: orderPayload.totalAmount },
    success: Boolean(id),
  });
  return normalizeOrder(id || `order-${Date.now()}`, orderPayload);
}

async function getOrders(filters: FilterOptions = {}): Promise<Order[]> {
  const orders = await listCollection('orders', normalizeOrder, filters);
  return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function getOrderById(id: string): Promise<Order | null> {
  try {
    const snap = await getDoc(doc(db, 'orders', id));
    return snap.exists() ? normalizeOrder(id, snap.data()) : null;
  } catch (error) {
    handleFirestoreError(error, 'getOrderById');
    return null;
  }
}

async function updateOrder(id: string, patch: Dictionary): Promise<boolean> {
  const previousOrder = await getOrderById(id);
  const ok = await patchDoc('orders', id, { ...patch, updatedAt: nowIso() });
  if (ok && patch.status && previousOrder) {
    const traceId = asString((patch as Dictionary).traceId, previousOrder.traceId || makeTraceId('ord'));
    logTraceFlow('UPDATE_ORDER', traceId, { stage: 'PATCH_STATUS', detail: { id, from: previousOrder.status, to: patch.status } });
    await createDoc('notifications', {
      traceId,
      userId: previousOrder.customerId,
      orderId: id,
      title: 'Order Status Updated',
      message: `Order ${id} status updated to ${String(patch.status)}`,
      type: 'order',
      isRead: false,
      createdAt: nowIso(),
    });
    const isFirstDeliveredTransition =
      patch.status === 'delivered' &&
      previousOrder.status !== 'delivered' &&
      !Boolean((previousOrder as unknown as Dictionary).analyticsRecordedAt);
    if (isFirstDeliveredTransition) {
      await setDoc(
        doc(db, 'analytics', `pharmacy_${previousOrder.pharmacyId}`),
        {
          pharmacyId: previousOrder.pharmacyId,
          totalOrders: increment(1),
          revenue: increment(Number(previousOrder.totalAmount || 0)),
          updatedAt: nowIso(),
        },
        { merge: true },
      );
      await patchDoc('orders', id, { analyticsRecordedAt: nowIso() });
    }
  }
  logFlow('UPDATE_ORDER', {
    expected: { id, patchKeys: Object.keys(patch) },
    received: { id, updated: ok },
    success: ok,
  });
  return ok;
}

function subscribeToOrders(filters: FilterOptions, callback: (orders: Order[]) => void): () => void {
  try {
    const constraints: QueryConstraint[] = [];
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) {
        constraints.push(where(key, '==', value));
      }
    }

    const ref = collection(db, 'orders');
    const source = constraints.length > 0 ? query(ref, ...constraints) : ref;

    const unsubscribe = onSnapshot(
      source,
      (snap) => {
        const orders = snap.docs
          .map((entry) => normalizeOrder(entry.id, entry.data()))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        orders.forEach((order) => {
          if (order.traceId) {
            logTraceFlow('SUBSCRIBE_ORDERS', order.traceId, { stage: 'SNAPSHOT', detail: { orderId: order.id } });
          }
        });
        callback(orders);
      },
      () => callback([]),
    );
    return () => unsubscribe();
  } catch (error) {
    handleFirestoreError(error, 'subscribeToOrders');
    callback([]);
    return () => undefined;
  }
}

function subscribeToInventory(filters: FilterOptions, callback: (items: SellerMedicine[]) => void): () => void {
  try {
    const constraints: QueryConstraint[] = [];
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) constraints.push(where(key, '==', value));
    }
    const ref = collection(db, 'inventory');
    const source = constraints.length > 0 ? query(ref, ...constraints) : ref;
    const unsubscribe = onSnapshot(
      source,
      (snap) => {
        const items = snap.docs.map((entry) => normalizeInventory(entry.id, entry.data()));
        items.forEach((item) => {
          if (item.traceId) {
            logTraceFlow('SUBSCRIBE_INVENTORY', item.traceId, { stage: 'SNAPSHOT', detail: { inventoryId: item.id } });
          }
        });
        callback(items);
      },
      () => callback([]),
    );
    return () => unsubscribe();
  } catch (error) {
    handleFirestoreError(error, 'subscribeToInventory');
    callback([]);
    return () => undefined;
  }
}

function subscribeToNotifications(filters: FilterOptions, callback: (items: Notification[]) => void): () => void {
  try {
    const constraints: QueryConstraint[] = [];
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) constraints.push(where(key, '==', value));
    }
    const ref = collection(db, 'notifications');
    const source = constraints.length > 0 ? query(ref, ...constraints) : ref;
    const unsubscribe = onSnapshot(
      source,
      (snap) => {
        const items = snap.docs.map((entry) => normalizeNotification(entry.id, entry.data()));
        items.forEach((item) => {
          if (item.traceId) {
            logTraceFlow('SUBSCRIBE_NOTIFICATIONS', item.traceId, { stage: 'SNAPSHOT', detail: { notificationId: item.id } });
          }
        });
        callback(items);
      },
      () => callback([]),
    );
    return () => unsubscribe();
  } catch (error) {
    handleFirestoreError(error, 'subscribeToNotifications');
    callback([]);
    return () => undefined;
  }
}

async function createPrescription(payload: Dictionary): Promise<Prescription> {
  const rxPayload: Dictionary = {
    ...payload,
    customerId: asString(payload.customerId || payload.userId),
    createdAt: nowIso(),
  };
  const id = await createDoc('prescriptions', rxPayload);
  return normalizePrescription(id || `rx-${Date.now()}`, rxPayload);
}

async function getPrescriptions(filters: FilterOptions = {}): Promise<Prescription[]> {
  const prescriptions = await listCollection('prescriptions', normalizePrescription, filters);
  return [...prescriptions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function updatePrescription(id: string, patch: Dictionary): Promise<boolean> {
  return patchDoc('prescriptions', id, { ...patch, updatedAt: nowIso() });
}

async function getNotifications(filters: FilterOptions = {}): Promise<Notification[]> {
  const notifications = await listCollection('notifications', normalizeNotification, filters);
  return [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function updateNotification(id: string, patch: Dictionary): Promise<boolean> {
  return patchDoc('notifications', id, { ...patch, updatedAt: nowIso() });
}

async function deleteNotification(id: string): Promise<boolean> {
  return removeDoc('notifications', id);
}

async function getTickets(filters: FilterOptions = {}): Promise<(SupportTicket & { description?: string })[]> {
  return listCollection('tickets', normalizeTicket, filters);
}

async function createTicket(payload: Dictionary): Promise<SupportTicket & { description?: string }>
{
  const ticketPayload: Dictionary = {
    ...payload,
    message: asString(payload.message),
    description: asString(payload.description, asString(payload.message)),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    status: asString(payload.status, 'open'),
    priority: asString(payload.priority, 'medium'),
    category: asString(payload.category, 'technical'),
  };
  const id = await createDoc('tickets', ticketPayload);
  return normalizeTicket(id || `ticket-${Date.now()}`, ticketPayload);
}

async function getPayouts(filters: FilterOptions = {}): Promise<SellerPayout[]> {
  const normalizedFilters = { ...filters };
  const ownerId = normalizedFilters.ownerId ?? normalizedFilters.sellerId;

  if (ownerId && normalizedFilters.pharmacyId === undefined) {
    const pharmacies = await getPharmacies({ ownerId: asString(ownerId) });
    const pharmacyIds = new Set(pharmacies.map((pharmacy) => pharmacy.id));
    const payouts = await listCollection('payouts', normalizePayout);
    return payouts
      .filter((payout) => pharmacyIds.has(payout.pharmacyId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  delete normalizedFilters.ownerId;
  delete normalizedFilters.sellerId;
  const payouts = await listCollection('payouts', normalizePayout, normalizedFilters);
  return [...payouts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function updatePayout(id: string, patch: Dictionary): Promise<boolean> {
  return patchDoc('payouts', id, { ...patch, updatedAt: nowIso() });
}

async function getCompliance(filters: FilterOptions = {}): Promise<ComplianceDocument[]> {
  return listCollection('compliance', normalizeCompliance, filters);
}

async function createCompliance(payload: Dictionary): Promise<ComplianceDocument> {
  const compliancePayload: Dictionary = {
    ...payload,
    status: asString(payload.status, 'pending'),
    createdAt: nowIso(),
  };
  const id = await createDoc('compliance', compliancePayload);
  return normalizeCompliance(id || `compliance-${Date.now()}`, compliancePayload);
}

async function updateCompliance(id: string, patch: Dictionary): Promise<boolean> {
  return patchDoc('compliance', id, { ...patch, updatedAt: nowIso() });
}

async function getReturns(filters: FilterOptions = {}): Promise<ReturnRequest[]> {
  const returns = await listCollection('returns', normalizeReturn, filters);
  return [...returns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function updateReturn(id: string, patch: Dictionary): Promise<boolean> {
  return patchDoc('returns', id, { ...patch, updatedAt: nowIso() });
}

async function getDeliveryAssignments(filters: FilterOptions = {}): Promise<DeliveryAssignment[]> {
  const assignments = await listCollection('deliveryAssignments', normalizeDeliveryAssignment, filters);
  return [...assignments].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
}

async function createDeliveryAssignment(payload: Dictionary): Promise<DeliveryAssignment> {
  const orderId = asString(payload.orderId);
  if (!orderId) {
    throw new Error('orderId is required to create a delivery assignment.');
  }
  const linkedOrder = orderId ? await getOrderById(orderId) : null;
  const traceId = asString(payload.traceId, linkedOrder?.traceId || makeTraceId('ord'));
  const assignmentPayload: Dictionary = {
    ...payload,
    traceId,
    orderId,
    assignedAt: nowIso(),
    status: asString(payload.status, 'assigned'),
  };
  const id = await createDoc('deliveryAssignments', assignmentPayload);
  await createDoc('notifications', {
    traceId,
    userId: asString(assignmentPayload.deliveryStaffId),
    orderId,
    title: 'Delivery Assignment Created',
    message: `Order ${orderId} assigned for delivery.`,
    type: 'order',
    isRead: false,
    createdAt: nowIso(),
  });
  logTraceFlow('CREATE_DELIVERY_ASSIGNMENT', traceId, { stage: 'WRITE_ASSIGNMENT', detail: { assignmentId: id || null, orderId } });
  return normalizeDeliveryAssignment(id || `assignment-${Date.now()}`, assignmentPayload);
}

async function updateDeliveryAssignment(id: string, patch: Dictionary): Promise<boolean> {
  return patchDoc('deliveryAssignments', id, { ...patch, updatedAt: nowIso() });
}

async function getAnalytics(filters: FilterOptions = {}): Promise<AnalyticsData> {
  const ownerId = asString(filters.ownerId ?? filters.sellerId);
  let orders: Order[] = [];

  if (ownerId) {
    const pharmacies = await getPharmacies({ ownerId });
    const pharmacyIds = new Set(pharmacies.map((pharmacy) => pharmacy.id));
    const allOrders = await getOrders();
    orders = allOrders.filter((order) => pharmacyIds.has(order.pharmacyId));
  } else {
    orders = await getOrders(filters);
  }

  if (orders.length === 0) {
    return FALLBACK_ANALYTICS;
  }

  const customers = new Set(orders.map((order) => order.customerId).filter(Boolean));
  return {
    totalOrders: orders.length,
    revenue: orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0),
    customers: customers.size,
  };
}

async function processPayment(payload: Dictionary): Promise<PaymentResponse> {
  const amount = asNumber(payload.amount);
  if (amount <= 0) {
    return {
      success: false,
      paymentId: '',
      transactionId: '',
      status: 'failed',
      method: (asString(payload.method, 'upi') as PaymentMethod) ?? 'upi',
      message: 'Invalid payment amount',
      failureReason: 'Amount must be greater than zero',
    };
  }

  const method = (asString(payload.method, 'upi') as PaymentMethod) ?? 'upi';
  const now = nowIso();
  const paymentId = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const transactionReference = `TXN-${Date.now().toString().slice(-8)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const forcedOutcome = asString(payload.forceOutcome).toLowerCase();
  const demoOverride = getDemoOutcomeOverride();
  const nextStatus: PaymentStatus =
    forcedOutcome === 'successful' || forcedOutcome === 'failed' || forcedOutcome === 'pending'
      ? (forcedOutcome as PaymentStatus)
      : demoOverride || 'successful';

  await setDoc(
    doc(db, 'payments', paymentId),
    {
      paymentId,
      orderId: asString(payload.orderId),
      customerId: asString(payload.customerId),
      pharmacyId: asString(payload.pharmacyId),
      sellerId: asString(payload.sellerId),
      amount,
      currency: asString(payload.currency, 'INR'),
      paymentMethod: method,
      paymentStatus: 'initiated',
      transactionReference,
      createdAt: now,
      updatedAt: now,
      notes: asString(payload.notes, 'Demo payment initiated'),
      metadata: toDictionary(payload.metadata),
    },
    { merge: true },
  );

  await patchDoc('payments', paymentId, {
    paymentStatus: 'processing',
    updatedAt: nowIso(),
  });
  await sleep(1200);

  const updatePayload: Dictionary = {
    paymentStatus: nextStatus,
    updatedAt: nowIso(),
    failureReason: nextStatus === 'failed' ? asString(payload.failureReason, 'Demo failure: simulated gateway decline') : '',
  };
  if (nextStatus === 'successful') {
    updatePayload.paidAt = nowIso();
  }
  await patchDoc('payments', paymentId, updatePayload);

  return {
    success: nextStatus === 'successful',
    paymentId,
    transactionId: transactionReference,
    status: nextStatus,
    method,
    message:
      nextStatus === 'successful'
        ? 'Payment processed successfully'
        : nextStatus === 'pending'
          ? 'Payment is pending confirmation'
          : 'Payment failed',
    failureReason: nextStatus === 'failed' ? asString(updatePayload.failureReason) : undefined,
  };
}

async function getPayments(filters: FilterOptions = {}): Promise<PaymentRecord[]> {
  const payments = await listCollection('payments', normalizePayment, filters);
  return [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function updatePayment(id: string, patch: Dictionary): Promise<boolean> {
  return patchDoc('payments', id, { ...patch, updatedAt: nowIso() });
}

const concreteApi = {
  // existing exports
  getUserProfile,
  addMedicineMaster: createMedicine,
  addInventoryItem: createInventoryEntry,
  createOrder,
  getOrders,
  subscribeToOrders,
  subscribeToInventory,
  subscribeToNotifications,

  // user management
  getUsers,
  createUser,
  updateUser,
  deleteUser,

  // pharmacies + catalog
  getPharmacies,
  getPharmaciesForCustomer,
  createPharmacy,
  updatePharmacy,
  getMedicines,
  createMedicine,
  updateMedicine,
  getInventory,
  createInventoryEntry,
  updateInventory,
  deleteInventory,

  // order + delivery
  getOrderById,
  updateOrder,
  getDeliveryAssignments,
  createDeliveryAssignment,
  updateDeliveryAssignment,

  // customer + prescription
  processPayment,
  getPayments,
  updatePayment,
  createPrescription,
  getPrescriptions,
  updatePrescription,

  // notifications + support
  getNotifications,
  updateNotification,
  deleteNotification,
  getTickets,
  createTicket,

  // finance + compliance + analytics
  getPayouts,
  updatePayout,
  getCompliance,
  createCompliance,
  updateCompliance,
  getReturns,
  updateReturn,
  getAnalytics,
};

type ApiShape = typeof concreteApi & Record<string, (...args: unknown[]) => unknown>;

function getFallbackByName(name: string): unknown {
  if (name.startsWith('get')) {
    if (name === 'getAnalytics') {
      return FALLBACK_ANALYTICS;
    }
    return [];
  }

  if (name.startsWith('create')) {
    return { id: '' };
  }

  if (name.startsWith('update') || name.startsWith('delete')) {
    return false;
  }

  return null;
}

export const api = new Proxy(concreteApi as ApiShape, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value === 'function') {
      return async (...args: unknown[]) => {
        try {
          return await value(...args);
        } catch (error) {
          handleFirestoreError(error, String(prop));
          logFlow(`API_${String(prop).toUpperCase()}`, {
            expected: ['function executes without throw'],
            received: { argsCount: args.length },
            success: false,
            error,
          });
          const fallback = getFallbackByName(String(prop));
          return fallback;
        }
      };
    }

    if (value !== undefined) {
      return value;
    }

    return async () => getFallbackByName(String(prop));
  },
});
