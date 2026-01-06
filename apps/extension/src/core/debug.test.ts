import { describe, it, expect, vi, afterEach } from 'vitest';

/* eslint-disable no-console */
describe('Debug console forwarding', () => {
  const realConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  afterEach(() => {
    console.log = realConsole.log;
    console.info = realConsole.info;
    console.warn = realConsole.warn;
    console.error = realConsole.error;

    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('captures original console before patching so Debug.log forwards only once', async () => {
    // Stub fetch used by sendToServer()
    const fetchMock = vi.fn((..._args: unknown[]) => Promise.resolve({} as Response));
    vi.stubGlobal('fetch', fetchMock);

    // Replace console methods so we can detect what Debug binds and calls
    const origLog = vi.fn();
    const origInfo = vi.fn();
    const origWarn = vi.fn();
    const origError = vi.fn();
    console.log = origLog as unknown as typeof console.log;
    console.info = origInfo as unknown as typeof console.info;
    console.warn = origWarn as unknown as typeof console.warn;
    console.error = origError as unknown as typeof console.error;

    const { Debug } = await import('@/core/debug');

    Debug.initConsoleForward();

    // Clear startup calls so we only count what Debug.log triggers.
    fetchMock.mockClear();
    origLog.mockClear();

    Debug.log('hello');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.body).toBeTruthy();
    const body = JSON.parse(init!.body as string) as {
      method: string;
      message: string;
    };
    expect(body.method).toBe('Debug.log');
    expect(body.message).toContain('hello');

    // And ensure it logged to the *original* console (not the patched one)
    expect(origLog).toHaveBeenCalled();
  });
});
/* eslint-enable no-console */
