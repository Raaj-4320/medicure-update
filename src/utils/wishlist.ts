import { parseStoredCart } from './safeCart';

const LEGACY_WISHLIST_KEYS = ['wishlist', 'wishlistItems'] as const;

const asWishlistId = (entry: unknown): string | null => {
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!entry || typeof entry !== 'object') return null;

  const candidate = (entry as Record<string, unknown>).id
    ?? (entry as Record<string, unknown>).medicineId
    ?? (entry as Record<string, unknown>).sellerMedicineId;

  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeWishlistIds = (entries: unknown[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  entries.forEach((entry) => {
    const id = asWishlistId(entry);
    if (!id || seen.has(id)) return;
    seen.add(id);
    normalized.push(id);
  });

  return normalized;
};

export const getWishlistStorageKey = (uid?: string | null) => `explore_wishlist_${uid || 'guest'}`;
export const getWishlistMetaStorageKey = (uid?: string | null) => `explore_wishlist_meta_${uid || 'guest'}`;

const readMetaMap = (metaKey: string): Record<string, number> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(metaKey) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.entries(parsed as Record<string, unknown>).reduce<Record<string, number>>((acc, [id, value]) => {
      if (typeof id !== 'string') return acc;
      const timestamp = Number(value);
      if (!Number.isFinite(timestamp) || timestamp <= 0) return acc;
      acc[id] = timestamp;
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const writeMetaMap = (metaKey: string, map: Record<string, number>) => {
  localStorage.setItem(metaKey, JSON.stringify(map));
};

const syncWishlistMeta = (key: string, ids: string[]) => {
  const metaKey = key.replace('explore_wishlist_', 'explore_wishlist_meta_');
  const previous = readMetaMap(metaKey);
  const now = Date.now();
  const next = ids.reduce<Record<string, number>>((acc, id) => {
    acc[id] = previous[id] || now;
    return acc;
  }, {});
  writeMetaMap(metaKey, next);
};

export const readWishlistIds = (key: string, context: string): string[] => {
  const primaryRaw = parseStoredCart(localStorage.getItem(key), `${context} primary`);
  let normalized = normalizeWishlistIds(primaryRaw);

  if (normalized.length === 0) {
    const migrated = LEGACY_WISHLIST_KEYS.flatMap((legacyKey) =>
      normalizeWishlistIds(parseStoredCart(localStorage.getItem(legacyKey), `${context} ${legacyKey}`)),
    );
    if (migrated.length > 0) {
      normalized = normalizeWishlistIds(migrated);
      localStorage.setItem(key, JSON.stringify(normalized));
      LEGACY_WISHLIST_KEYS.forEach((legacyKey) => localStorage.removeItem(legacyKey));
    }
  }

  const serialized = JSON.stringify(normalized);
  if (localStorage.getItem(key) !== serialized) {
    localStorage.setItem(key, serialized);
  }
  syncWishlistMeta(key, normalized);

  return normalized;
};

export const writeWishlistIds = (key: string, ids: unknown[]) => {
  const normalized = normalizeWishlistIds(ids);
  localStorage.setItem(key, JSON.stringify(normalized));
  syncWishlistMeta(key, normalized);
  return normalized;
};

export const readWishlistAddedAt = (uid?: string | null): Record<string, number> => {
  const metaKey = getWishlistMetaStorageKey(uid);
  return readMetaMap(metaKey);
};
