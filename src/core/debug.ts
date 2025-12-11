// Debug logging utility - only used in development mode (watch mode)
// All calls to Debug methods should be wrapped in `if (__DEV__)` for dead code elimination

const DEV_SERVER_URL = 'http://localhost:5173/__debug_log';

// Track if we've logged a connection error (avoid spam)
let connectionErrorLogged = false;

/**
 * Send log to dev server.
 * Tries fetch first, falls back to posting via window message for CSP-restricted pages.
 */
function sendToServer(level: string, args: unknown[]): void {
  const message = args
    .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
    .join(' ');

  const payload = { level, source: 'extension', message };

  fetch(DEV_SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => {
    // Log connection errors once to help diagnose issues
    if (!connectionErrorLogged) {
      connectionErrorLogged = true;
      // Use original console to avoid infinite loop

      console.warn(
        '[StreamKeys] Debug server connection failed (CSP may be blocking):',
        err.message || err
      );
    }
  });
}

function log(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log('[StreamKeys]', ...args);
  sendToServer('LOG', args);
}

function initConsoleForward(): void {
  /* eslint-disable no-console */
  console.log('[StreamKeys] Console forwarding initialized to', DEV_SERVER_URL);

  const orig = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  console.log = (...args: unknown[]) => {
    sendToServer('LOG', args);
    orig.log.apply(console, args);
  };

  console.info = (...args: unknown[]) => {
    sendToServer('INFO', args);
    orig.info.apply(console, args);
  };

  console.warn = (...args: unknown[]) => {
    sendToServer('WARN', args);
    orig.warn.apply(console, args);
  };

  console.error = (...args: unknown[]) => {
    sendToServer('ERROR', args);
    orig.error.apply(console, args);
  };
  /* eslint-enable no-console */
}

// Public API
export const Debug = {
  log,
  initConsoleForward,
};
