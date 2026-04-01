type FlowStatus = 'success' | 'partial' | 'fail';

type FlowInput = {
  expected?: unknown;
  received?: unknown;
  success?: boolean;
  status?: FlowStatus;
  error?: unknown;
  step?: 'START' | 'RESULT';
  requiredFields?: string[];
  renderedCount?: number;
  expectedKeys?: string[];
  suggestion?: string;
  partialType?: 'NOT_IMPLEMENTED' | 'DATA_MISSING' | 'UI_INCOMPLETE';
  allowEmpty?: boolean;
};

const FLOW_DEDUP_WINDOW_MS = 1500;
const flowLogCache = new Map<string, number>();
const CUSTOMER_ROUTES = ['/customer', '/discover', '/pharmacy', '/cart', '/checkout', '/orders'];

const shouldMuteCustomerConsole = (): boolean => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname || '';
  return CUSTOMER_ROUTES.some((route) => path.startsWith(route));
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasRequiredFields = (value: unknown, requiredFields: string[]): boolean => {
  if (!isObject(value)) return false;
  return requiredFields.every((field) => value[field] !== undefined && value[field] !== null && value[field] !== '');
};

const inferStatus = (input: FlowInput): FlowStatus => {
  if (input.status) return input.status;
  if (input.success === false || input.error) return 'fail';

  const received = input.received;
  if (!input.allowEmpty) {
    if (Array.isArray(received) && received.length === 0) return 'fail';
    if (isObject(received) && 'count' in received && Number((received as Record<string, unknown>).count) === 0) return 'fail';
  }
  if (input.requiredFields?.length && !hasRequiredFields(received, input.requiredFields)) return 'partial';

  return 'success';
};

type FlowCause =
  | 'NO_DATA'
  | 'INVALID_SCHEMA'
  | 'BINDING_FAILURE'
  | 'JOIN_FAILURE'
  | 'SILENT_FAILURE'
  | 'DATA_MISSING'
  | 'NOT_IMPLEMENTED'
  | 'UI_INCOMPLETE';

const detectFlowCause = (input: FlowInput, status: FlowStatus): FlowCause | null => {
  if (status === 'success') return null;
  if (status === 'partial' && input.partialType) return input.partialType;
  if (input.received === undefined && !input.error) return 'SILENT_FAILURE';
  if (Array.isArray(input.received) && input.received.length === 0) return 'NO_DATA';
  if (isObject(input.received) && 'count' in input.received && Number(input.received.count) === 0) return 'NO_DATA';
  if (input.requiredFields?.length && !hasRequiredFields(input.received, input.requiredFields)) return 'INVALID_SCHEMA';
  if (typeof input.renderedCount === 'number' && input.renderedCount === 0) {
    const hasApiData =
      (Array.isArray(input.received) && input.received.length > 0) ||
      (isObject(input.received) && 'count' in input.received && Number(input.received.count) > 0);
    if (hasApiData) return 'BINDING_FAILURE';
  }
  if (isObject(input.received) && 'joinedCount' in input.received && Number(input.received.joinedCount) === 0) return 'JOIN_FAILURE';
  return 'DATA_MISSING';
};

const suggestionByCause: Record<FlowCause, string> = {
  NO_DATA: 'Verify filters/IDs and ensure source collection has data.',
  INVALID_SCHEMA: 'Ensure required fields exist and are mapped before marking success.',
  BINDING_FAILURE: 'Check UI mapping keys and rendered list bindings.',
  JOIN_FAILURE: 'Verify join keys and ID compatibility between collections.',
  SILENT_FAILURE: 'Add explicit error handling/logging in catch blocks and async returns.',
  DATA_MISSING: 'Load missing data before rendering dependent UI.',
  NOT_IMPLEMENTED: 'Mark feature path as not implemented until handler/API is wired.',
  UI_INCOMPLETE: 'Complete UI state update and render logic after action/API success.',
};

export const logFlow = (name: string, input: FlowInput): void => {
  if (shouldMuteCustomerConsole()) return;
  const status = inferStatus(input);
  const cause = detectFlowCause(input, status);
  const step = input.step || 'RESULT';
  const dedupeKey = `${name}:${step}:${status}:${JSON.stringify(input.received ?? null)}`;
  const now = Date.now();
  const lastLoggedAt = flowLogCache.get(dedupeKey);
  if (lastLoggedAt && now - lastLoggedAt < FLOW_DEDUP_WINDOW_MS) {
    return;
  }
  flowLogCache.set(dedupeKey, now);

  console.group(`[FLOW][${name}]`);
  console.log('STEP:', step);
  console.log('EXPECT:', input.expected ?? null);
  console.log('RESULT:', input.received ?? null);

  if (status === 'success') {
    console.log('STATUS: ✅ SUCCESS');
  } else if (status === 'partial') {
    console.warn('STATUS: ⚠️ PARTIAL');
  } else {
    console.error('STATUS: ❌ FAIL');
    if (input.error) {
      console.error('REASON:', input.error);
    }
  }

  console.groupEnd();

  if (cause) {
    console.group('[ERROR][FLOW]');
    console.error('CAUSE:', cause);
    console.error('DETAIL:', input.error ?? input.received ?? 'No details');
    console.info('[SUGGESTION]', input.suggestion || suggestionByCause[cause]);
    console.groupEnd();
  }
};

export const logError = (area: string, input: { type: 'UI' | 'API' | 'DATA' | 'JOIN'; detail: string }): void => {
  if (shouldMuteCustomerConsole()) return;
  console.group(`[ERROR][${area}]`);
  console.error('TYPE:', input.type);
  console.error('DETAIL:', input.detail);
  console.groupEnd();
};

export const logTraceFlow = (name: string, traceId: string, input?: { stage?: string; detail?: unknown }): void => {
  const isDev = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  if (!isDev || shouldMuteCustomerConsole()) return;
  console.group(`[TRACE][FLOW][${name}]`);
  console.log('TRACE_ID:', traceId);
  if (input?.stage) {
    console.log('STAGE:', input.stage);
  }
  if (input?.detail !== undefined) {
    console.log('DETAIL:', input.detail);
  }
  console.groupEnd();
};

export const validateDataBinding = (params: {
  area: string;
  dataCount: number;
  renderedCount: number;
  expectedKeys: string[];
  sample?: unknown;
}): void => {
  if (shouldMuteCustomerConsole()) return;
  if (params.dataCount > 0 && params.renderedCount === 0) {
    console.group('[ERROR][DATA_BINDING]');
    console.error('CAUSE:', 'UI not mapping API result');
    console.error('DETAIL:', {
      expectedKeys: params.expectedKeys,
      sampleKeys: isObject(params.sample) ? Object.keys(params.sample) : [],
    });
    console.info('[SUGGESTION]', `Check binding keys in ${params.area}`);
    console.groupEnd();
  }
};

export const checkExpectations = (params: {
  page: string;
  expected: string[];
  result: Record<string, unknown>;
}): void => {
  if (shouldMuteCustomerConsole()) return;
  const missing = params.expected.filter((key) => {
    const value = params.result[key];
    if (Array.isArray(value)) return value.length === 0;
    return value === null || value === undefined || value === false || value === '';
  });
  if (missing.length > 0) {
    console.group('[ERROR][EXPECTATION]');
    console.error('MISSING:', missing);
    console.error('CAUSE:', 'DATA_NOT_LOADED');
    console.info('[SUGGESTION]', `Ensure ${missing.join(', ')} is loaded in ${params.page}`);
    console.groupEnd();
  }
};

export const logRouteState = (params: {
  route: string;
  state: 'ok' | 'blocked' | 'error';
  reason?: string;
  detail?: unknown;
}): void => {
  if (shouldMuteCustomerConsole()) return;
  const method = params.state === 'error' ? console.error : params.state === 'blocked' ? console.warn : console.info;
  console.group(`[ROUTE][${params.route}]`);
  method('STATE:', params.state.toUpperCase());
  if (params.reason) method('REASON:', params.reason);
  if (params.detail !== undefined) console.log('DETAIL:', params.detail);
  console.groupEnd();
};

export const validateRequiredFields = (
  payload: Record<string, unknown>,
  required: string[],
): { ok: boolean; missing: string[] } => {
  const missing = required.filter((key) => {
    const value = payload[key];
    return value === undefined || value === null || value === '';
  });

  return { ok: missing.length === 0, missing };
};

export default logFlow;
