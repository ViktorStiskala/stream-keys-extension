import { Debug } from '@/core/debug';

// __DEV__ is defined by vite config based on isDebugMode
declare const __DEV__: boolean;

// Initialize console forwarding in dev mode (must be early, before other logs)
if (__DEV__) {
  Debug.initConsoleForward();
}
