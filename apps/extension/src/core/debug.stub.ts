// Debug module stub - used in production builds via alias swapping
// All methods are no-ops to enable complete dead code elimination

export const Debug = {
  log: (): void => {},
  action: (): void => {},
  event: (): void => {},
  withDebug: <T extends object>(
    _eventName: string,
    handler: (details: T) => void
  ): ((details: T) => void) => handler,
  initConsoleForward: (): void => {},
};
