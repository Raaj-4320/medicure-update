type OrderTracePayload = Record<string, unknown>;

const TRACE_KEY = 'medicure_order_trace_v1';
const TRACE_LIMIT = 300;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readTraceBuffer(): Array<{ time: string; event: string; payload: OrderTracePayload }> {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(TRACE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTraceBuffer(entries: Array<{ time: string; event: string; payload: OrderTracePayload }>): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(TRACE_KEY, JSON.stringify(entries.slice(-TRACE_LIMIT)));
  } catch {
    // ignore storage overflow errors
  }
}

export function logOrderTrace(event: string, payload: OrderTracePayload = {}): void {
  const entry = {
    time: new Date().toISOString(),
    event,
    payload,
  };
  const next = [...readTraceBuffer(), entry];
  writeTraceBuffer(next);
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.groupCollapsed(`[ORDER_TRACE] ${event}`);
    console.log(entry);
    console.groupEnd();
  }
}

export function getOrderTrace(): Array<{ time: string; event: string; payload: OrderTracePayload }> {
  return readTraceBuffer();
}

