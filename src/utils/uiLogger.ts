type UILogPayload = {
  component?: string;
  action?: string;
  expected?: string;
  context?: string;
  success?: boolean;
  status?: 'working' | 'not_working' | 'partial';
  reason?: string;
  diagnostics?: {
    handlerExecuted?: boolean;
    apiCalled?: boolean;
    stateChanged?: boolean;
    uiUpdated?: boolean;
  };
};

const UI_DEDUP_WINDOW_MS = 1000;
const uiLogCache = new Map<string, number>();
const CUSTOMER_ROUTES = ['/customer', '/discover', '/pharmacy', '/cart', '/checkout', '/orders'];

const shouldMuteCustomerConsole = (): boolean => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname || '';
  return CUSTOMER_ROUTES.some((route) => path.startsWith(route));
};

export function logUI(actionName: string, payload: UILogPayload): void {
  if (shouldMuteCustomerConsole()) return;
  const component = payload.component || 'UnknownComponent';
  const action = payload.action || payload.context || actionName;
  const expected = payload.expected || 'should trigger handler and update UI';
  const status: 'working' | 'not_working' | 'partial' =
    payload.status || (payload.success === false ? 'not_working' : 'working');
  const diagnostics = payload.diagnostics;
  const cause =
    status === 'working'
      ? null
      : diagnostics?.handlerExecuted === false
        ? 'NO_HANDLER'
        : diagnostics?.apiCalled === false
          ? 'NO_API_CALL'
          : diagnostics?.stateChanged === false
            ? 'NO_STATE_CHANGE'
            : diagnostics?.uiUpdated === false
              ? 'NO_UI_UPDATE'
              : 'UNKNOWN';
  const dedupeKey = `${component}:${actionName}:${action}:${status}:${payload.reason || ''}`;
  const now = Date.now();
  const lastLoggedAt = uiLogCache.get(dedupeKey);
  if (lastLoggedAt && now - lastLoggedAt < UI_DEDUP_WINDOW_MS) {
    return;
  }
  uiLogCache.set(dedupeKey, now);

  console.group(`[UI][${actionName}]`);
  console.log('COMPONENT:', component);
  console.log('ACTION:', action);
  console.log('EXPECTED:', expected);

  if (status === 'working') {
    console.log('RESULT: ✅ WORKING');
  } else if (status === 'partial') {
    console.warn('RESULT: ⚠️ PARTIAL');
  } else {
    console.warn('RESULT: ❌ NOT_WORKING');
    console.warn('CAUSE:', cause);
    if (payload.reason) {
      console.warn('REASON:', payload.reason);
    }
    const suggestion =
      cause === 'NO_HANDLER'
        ? 'Attach onClick handler.'
        : cause === 'NO_API_CALL'
          ? 'Ensure click path triggers required API.'
          : cause === 'NO_STATE_CHANGE'
            ? 'Ensure state setter is called after action.'
            : cause === 'NO_UI_UPDATE'
              ? 'Ensure render uses updated state.'
              : 'Add diagnostics for handler/api/state/ui checks.';
    console.info('[SUGGESTION]', suggestion);
  }
  console.groupEnd();
}

export default logUI;
