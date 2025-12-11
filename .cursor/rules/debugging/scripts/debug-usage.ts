// ✅ CORRECT: Entire block removed in production
if (__DEV__) {
  Debug.initConsoleForward();
  Debug.log('Player initialized', player);
}

// ❌ WRONG: Call remains in production (function just exits early)
Debug.initConsoleForward();
