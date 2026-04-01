export type LogCategory =
  | 'ORDER_FLOW'
  | 'PRODUCT_MUTATION'
  | 'PAGE_LOAD_ROUTE'
  | 'RENDER_ERROR'
  | 'FIREBASE_QUERY'
  | 'AUTH_PROFILE_PHARMACY'
  | 'UI_ACTION'
  | 'SYSTEM_WARNING';

export type LogStatus = 'start' | 'success' | 'failure' | 'warning';

type LogEntry = {
  category: LogCategory;
  event: string;
  status: LogStatus;
  page?: string;
  route?: string;
  scope?: string;
  message: string;
  ids?: {
    orderId?: string;
    pharmacyId?: string;
    customerId?: string;
    productId?: string;
    sellerId?: string;
  };
  meta?: Record<string, unknown>;
  error?: {
    name?: string;
    message: string;
    code?: string;
    stackTop?: string;
  };
  timestamp: string;
};

const isEnabled = (): boolean =>
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true';

const shortError = (error: unknown): LogEntry['error'] | undefined => {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stackTop: error.stack?.split('\n').slice(0, 2).join(' | '),
    };
  }
  return { message: String(error) };
};

const labelMap: Record<LogCategory, string> = {
  ORDER_FLOW: 'ORDER',
  PRODUCT_MUTATION: 'PRODUCT',
  PAGE_LOAD_ROUTE: 'PAGE',
  RENDER_ERROR: 'RENDER',
  FIREBASE_QUERY: 'QUERY',
  AUTH_PROFILE_PHARMACY: 'AUTH',
  UI_ACTION: 'UI',
  SYSTEM_WARNING: 'WARN',
};

export const appLogger = {
  log(input: Omit<LogEntry, 'timestamp'>) {
    if (!isEnabled()) return;
    const entry: LogEntry = { ...input, timestamp: new Date().toISOString() };
    const prefix = `[${labelMap[entry.category]}][${entry.status.toUpperCase()}]`;
    const printer = entry.status === 'failure' ? console.error : entry.status === 'warning' ? console.warn : console.log;

    console.groupCollapsed(`${prefix} ${entry.event}`);
    printer(entry.message);
    console.log({
      category: entry.category,
      page: entry.page,
      route: entry.route || (typeof window !== 'undefined' ? window.location.pathname : ''),
      scope: entry.scope,
      ids: entry.ids,
      meta: entry.meta,
      error: entry.error,
      timestamp: entry.timestamp,
    });
    console.groupEnd();
  },
  errorSummary(error: unknown) {
    return shortError(error);
  },
};

export function registerGlobalErrorHandlers(): void {
  if (!isEnabled() || typeof window === 'undefined') return;
  if ((window as Window & { __medicureGlobalHandlers?: boolean }).__medicureGlobalHandlers) return;
  (window as Window & { __medicureGlobalHandlers?: boolean }).__medicureGlobalHandlers = true;

  window.addEventListener('error', (event) => {
    appLogger.log({
      category: 'RENDER_ERROR',
      event: 'window_uncaught_error',
      status: 'failure',
      page: 'global',
      scope: 'window',
      message: 'Uncaught runtime error reached window listener.',
      meta: { filename: event.filename, lineno: event.lineno, colno: event.colno },
      error: appLogger.errorSummary(event.error || event.message),
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    appLogger.log({
      category: 'RENDER_ERROR',
      event: 'window_unhandled_rejection',
      status: 'failure',
      page: 'global',
      scope: 'window',
      message: 'Unhandled promise rejection captured.',
      error: appLogger.errorSummary(event.reason),
    });
  });
}
