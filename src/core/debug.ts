// Debug logging utility - only logs in development mode (watch mode)

// __DEV__ is defined by vite config based on isWatch
declare const __DEV__: boolean;

export const debug = (...args: unknown[]): void => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log('[StreamKeys]', ...args);
  }
};
