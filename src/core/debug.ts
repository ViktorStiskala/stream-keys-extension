// Debug logging utility - only included in development builds via alias swapping
// In production, vite resolves @/core/debug to debug.stub.ts (no-ops)
//
// All calls to Debug methods should be wrapped in `if (__DEV__)` for dead code elimination

const DEV_SERVER_URL = 'http://localhost:5173/__debug_log';
let connectionErrorLogged = false;

// Lazy-initialized original console references
let originalConsole: {
  log: typeof console.log;
  info: typeof console.info;
  warn: typeof console.warn;
  error: typeof console.error;
} | null = null;

let consoleForwardInitialized = false;

function getOriginalConsole() {
  if (!originalConsole) {
    /* eslint-disable no-console */
    originalConsole = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };
    /* eslint-enable no-console */
  }
  return originalConsole;
}

function sendToServer(level: string, method: string, args: unknown[]): void {
  const message = args
    .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
    .join(' ');

  const payload = { level, method, source: 'extension', message };

  fetch(DEV_SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => {
    if (!connectionErrorLogged) {
      connectionErrorLogged = true;

      // Use original console to avoid infinite loop when console is patched
      getOriginalConsole().warn(
        '[StreamKeys] Debug server connection failed (CSP may be blocking):',
        err.message || err
      );
    }
  });
}

function log(...args: unknown[]): void {
  getOriginalConsole().log('[StreamKeys]', ...args);
  sendToServer('LOG', 'Debug.log', args);
}

function action(actionName: string, details?: string): void {
  const message = details ? `[Action] ${actionName} — ${details}` : `[Action] ${actionName}`;
  getOriginalConsole().log('[StreamKeys]', message);
  sendToServer('LOG', 'Debug.action', [message]);
}

const EVENT_FIELDS: Record<string, string[]> = {
  'WebNavigation.onCompleted': ['tabId', 'frameId', 'url'],
  'WebNavigation.onBeforeNavigate': ['tabId', 'frameId', 'url'],
  'tabs.onRemoved': [],
};

function event(eventName: string, details: object, context?: string): void {
  const detailsRecord = details as Record<string, unknown>;
  const fields = EVENT_FIELDS[eventName] ?? Object.keys(detailsRecord);
  const params = fields
    .filter((f) => f in detailsRecord)
    .map((f) => `${f}=${detailsRecord[f]}`)
    .join(' ');
  const message = context ? `[${eventName}] ${params} — ${context}` : `[${eventName}] ${params}`;
  getOriginalConsole().log('[StreamKeys]', message);
  sendToServer('LOG', 'Debug.event', [message]);
}

function getBrowserInfo(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/(\d+)/);
    return `Firefox ${match?.[1] ?? ''}`;
  }
  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/(\d+)/);
    return `Edge ${match?.[1] ?? ''}`;
  }
  if (ua.includes('Chrome/')) {
    const match = ua.match(/Chrome\/(\d+)/);
    return `Chrome ${match?.[1] ?? ''}`;
  }
  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/);
    return `Safari ${match?.[1] ?? ''}`;
  }
  return 'Unknown browser';
}

function initConsoleForward(): void {
  if (consoleForwardInitialized) return;
  consoleForwardInitialized = true;

  /* eslint-disable no-console */
  const browser = getBrowserInfo();
  const message = `[StreamKeys] Debug session started - ${browser} - ${new Date().toISOString()}`;

  // IMPORTANT: Capture original console methods BEFORE patching console.*.
  // Debug.log/action/event call getOriginalConsole() later; if we patch first, we'd capture patched
  // methods and end up forwarding twice (patched console + Debug.* sendToServer).
  const orig = getOriginalConsole();

  // Log startup message both to the real console and the debug server
  orig.log(message);
  sendToServer('LOG', 'console.log', [message]);

  console.log = (...args: unknown[]) => {
    sendToServer('LOG', 'console.log', args);
    orig.log(...args);
  };

  console.info = (...args: unknown[]) => {
    sendToServer('INFO', 'console.info', args);
    orig.info(...args);
  };

  console.warn = (...args: unknown[]) => {
    sendToServer('WARN', 'console.warn', args);
    orig.warn(...args);
  };

  console.error = (...args: unknown[]) => {
    sendToServer('ERROR', 'console.error', args);
    orig.error(...args);
  };
  /* eslint-enable no-console */
}

function withDebug<T extends object>(
  eventName: string,
  handler: (details: T) => void
): (details: T) => void {
  return (details: T) => {
    event(eventName, details);
    handler(details);
  };
}

export const Debug = {
  log,
  action,
  event,
  withDebug,
  initConsoleForward,
};
