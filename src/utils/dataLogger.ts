type DataSource = 'STATIC' | 'FIRESTORE';

type DataLogInput = {
  source: DataSource;
  requested: string[];
  received: unknown;
  rendered: boolean;
  placeholder: boolean;
  requiredFields?: string[];
  expectedUiKeys?: string[];
  userId?: string;
  route?: string;
  filters?: Record<string, unknown>;
};

const dedupeMap = new Map<string, number>();
const DEDUPE_MS = 1500;
const CUSTOMER_ROUTES = ['/customer', '/discover', '/pharmacy', '/cart', '/checkout', '/orders'];

const shouldMuteCustomerConsole = (): boolean => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname || '';
  return CUSTOMER_ROUTES.some((route) => path.startsWith(route));
};

export function logDataFlow(name: string, input: DataLogInput): void {
  if (shouldMuteCustomerConsole()) return;
  const receivedCount = Array.isArray(input.received) ? input.received.length : input.received ? 1 : 0;
  const key = `${name}:${input.source}:${receivedCount}:${input.rendered}:${input.placeholder}`;
  const now = Date.now();
  const prev = dedupeMap.get(key);
  if (prev && now - prev < DEDUPE_MS) return;
  dedupeMap.set(key, now);

  console.group(`[DATA][${name}]`);
  console.log('SOURCE:', input.source === 'STATIC' ? 'STATIC ⚠️' : 'FIRESTORE');
  console.log('CONTEXT:', {
    userId: input.userId || 'anonymous',
    route: input.route || (typeof window !== 'undefined' ? window.location.pathname : 'unknown'),
    filters: input.filters || {},
  });
  console.log('REQUESTED:', input.requested);
  console.log('RECEIVED:', { count: receivedCount });
  console.log('UI_RENDER:', input.rendered ? 'RENDERED ✅' : 'NOT_RENDERED ❌');
  console.log('PLACEHOLDER:', input.placeholder ? 'YES ⚠️' : 'NO');

  if (!input.received || (Array.isArray(input.received) && input.received.length === 0)) {
    console.warn('STATUS: EMPTY ⚠️');
  } else if (!input.rendered) {
    const firstEntry =
      Array.isArray(input.received) && input.received.length > 0 && input.received[0] && typeof input.received[0] === 'object'
        ? (input.received[0] as Record<string, unknown>)
        : input.received && typeof input.received === 'object'
          ? (input.received as Record<string, unknown>)
          : null;
    console.error('STATUS: DATA_NOT_RENDERED ❌');
    console.error('CAUSE: binding issue');
    console.error('RAW_DATA_KEYS:', firstEntry ? Object.keys(firstEntry) : []);
    console.error('EXPECTED_UI_KEYS:', input.expectedUiKeys || input.requiredFields || []);
    console.info('SUGGESTION: verify mapper keys, component state wiring, and required field names.');
  } else if (input.requiredFields?.length && Array.isArray(input.received)) {
    const missingField = input.received.some((entry) =>
      input.requiredFields?.some((field) => !entry || typeof entry !== 'object' || !((entry as Record<string, unknown>)[field] ?? false)),
    );
    if (missingField) {
      console.warn('STATUS: PARTIAL ⚠️');
      console.warn('DETAIL: missing required fields');
    } else {
      console.log('STATUS: HEALTHY ✅');
    }
  } else {
    console.log('STATUS: HEALTHY ✅');
  }

  console.groupEnd();
}

export default logDataFlow;
