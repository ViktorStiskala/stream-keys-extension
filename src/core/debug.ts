// Debug logging utility - only used in development mode (watch mode)
// All calls to Debug methods should be wrapped in `if (__DEV__)` for dead code elimination
//
// IMPORTANT: The Debug export is conditionally defined based on __DEV__.
// In production, all methods are no-ops to enable complete dead code elimination
// of the actual debug implementation (including string literals like 'Debug.log').

// __DEV__ is defined by vite config based on isWatch
declare const __DEV__: boolean;

// ============================================================================
// Production stub - all no-ops, allows complete dead code elimination
// ============================================================================
const DebugStub = {
  log: (): void => {},
  action: (): void => {},
  event: (): void => {},
  withDebug: <T extends object>(
    _eventName: string,
    handler: (details: T) => void
  ): ((details: T) => void) => handler,
  initConsoleForward: (): void => {},
};

// ============================================================================
// Development implementation - full logging functionality
// ============================================================================
function createDebugImpl() {
  const DEV_SERVER_URL = 'http://localhost:5173/__debug_log';
  let connectionErrorLogged = false;

  // Lazy-initialized original console references
  let originalConsole: {
    log: typeof console.log;
    info: typeof console.info;
    warn: typeof console.warn;
    error: typeof console.error;
  } | null = null;

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
        // eslint-disable-next-line no-console
        console.warn(
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
    /* eslint-disable no-console */
    const browser = getBrowserInfo();
    console.log(`[StreamKeys] Debug session started - ${browser} - ${new Date().toISOString()}`);

    const orig = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    console.log = (...args: unknown[]) => {
      sendToServer('LOG', 'console.log', args);
      orig.log.apply(console, args);
    };

    console.info = (...args: unknown[]) => {
      sendToServer('INFO', 'console.info', args);
      orig.info.apply(console, args);
    };

    console.warn = (...args: unknown[]) => {
      sendToServer('WARN', 'console.warn', args);
      orig.warn.apply(console, args);
    };

    console.error = (...args: unknown[]) => {
      sendToServer('ERROR', 'console.error', args);
      orig.error.apply(console, args);
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

  return {
    log,
    action,
    event,
    withDebug,
    initConsoleForward,
  };
}

// ============================================================================
// Conditional export - stub in production, full implementation in dev
// ============================================================================
export const Debug = __DEV__ ? createDebugImpl() : DebugStub;
