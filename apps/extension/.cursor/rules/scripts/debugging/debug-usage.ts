// ✅ RECOMMENDED: Wrap in __DEV__ for complete removal in production
if (__DEV__) {
  Debug.initConsoleForward();
  Debug.log('Player initialized', player);
  Debug.action('Key: ArrowLeft', `seek backward ${seekTime}s`);
}

// ✅ ALSO OK: Direct call (becomes no-op in production)
// Use when simplicity is preferred and no argument computation
Debug.log('Simple message');

// ⚠️ AVOID: Expensive argument evaluation still happens in production
Debug.log('State:', JSON.stringify(complexState));

// ✅ FIX: Wrap to avoid argument evaluation
if (__DEV__) {
  Debug.log('State:', JSON.stringify(complexState));
}
