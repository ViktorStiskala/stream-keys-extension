function hbomaxMain() {
  console.info('[StreamKeys] HBO Max extension loaded');

  // Get button with fallback selectors
  const getButton = (primarySelector, fallbackSelector) => {
    return document.querySelector(primarySelector) || document.querySelector(fallbackSelector);
  };

  // Button selectors with fallbacks
  const getPlayPauseButton = () => {
    return getButton(
      'button[data-testid="player-ux-play-pause-button"]',
      '[class^="ControlsFooterBottomMiddle"] button:nth-child(2)'
    );
  };

  const getFullscreenButton = () => {
    return getButton(
      'button[data-testid="player-ux-fullscreen-button"]',
      '[class^="ControlsFooterBottomRight"] button:last-child'
    );
  };

  // Global key handler - captures keys regardless of focus
  const handleGlobalKeys = (e) => {
    // Skip if user is typing in an input/textarea
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }

    // Map keys to their button getter functions
    const keyMap = {
      'Space': getPlayPauseButton,
      'KeyF': getFullscreenButton,
    };

    const getButtonFn = keyMap[e.code];
    if (!getButtonFn) {
      return;
    }

    const button = getButtonFn();
    if (!button) {
      const buttonName = e.code === 'Space' ? 'play/pause' : 'fullscreen';
      console.warn(`[StreamKeys] ${buttonName} button not found`);
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    button.click();
  };

  // Use capture phase to intercept before any other handlers
  window.addEventListener('keydown', handleGlobalKeys, true);

  // Helper to focus player overlay
  const focusPlayer = () => {
    const overlay = document.querySelector('#overlay-root');
    if (overlay && document.hasFocus()) {
      overlay.focus();
    }
  };

  // Create invisible overlay to capture click for user activation
  const createClickOverlay = () => {
    // Remove any existing overlay
    const existing = document.getElementById('keyboard-activation-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'keyboard-activation-overlay';
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      background: transparent !important;
      cursor: default !important;
      pointer-events: auto !important;
    `;
    
    // Remove overlay on click and focus player
    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.remove();
      focusPlayer();
    }, { once: true, capture: true });
    
    // Append to app-root to be above HBO Max layer structure, fallback to body
    const appRoot = document.getElementById('app-root');
    (appRoot || document.body).appendChild(overlay);
  };

  // Track fullscreen state for focus restoration
  let currentFullscreenElement = null;
  let playerKeyListenerAdded = false;
  let wasInFullscreen = false;
  
  const handleFullscreenChange = () => {
    const fullscreenEl = document.fullscreenElement || document.webkitFullscreenElement;
    
    // Remove listener from previous fullscreen element
    if (currentFullscreenElement) {
      currentFullscreenElement.removeEventListener('keydown', handleGlobalKeys, true);
      currentFullscreenElement = null;
    }

    if (fullscreenEl) {
      // Entering fullscreen - add listener to fullscreen element
      currentFullscreenElement = fullscreenEl;
      currentFullscreenElement.addEventListener('keydown', handleGlobalKeys, true);
      setTimeout(focusPlayer, 100);
      wasInFullscreen = true;
    } else if (wasInFullscreen) {
      // Exiting fullscreen - show invisible overlay to capture click for user activation
      wasInFullscreen = false;
      setTimeout(() => {
        createClickOverlay();
        focusPlayer();
        console.info('[StreamKeys] Fullscreen exit: Click to focus overlay added');
      }, 100);
    }
  };
  
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

  // Setup player for keyboard control
  const setupPlayer = () => {
    const playerContainer = document.querySelector('div[data-testid="playerContainer"]');
    const overlay = document.querySelector('#overlay-root');
    
    if (!playerContainer || !overlay) return;
    
    // Add keydown listener directly to player container
    if (!playerKeyListenerAdded) {
      playerContainer.addEventListener('keydown', handleGlobalKeys, true);
      playerKeyListenerAdded = true;
    }
  };
  
  // Throttled mousemove handler to restore focus
  let lastMouseMoveTime = 0;
  const handleMouseMove = () => {
    const now = Date.now();
    if (now - lastMouseMoveTime < 500) return;
    lastMouseMoveTime = now;
    focusPlayer();
  };
  
  // Setup player periodically
  setInterval(() => {
    setupPlayer();
    
    const playerContainer = document.querySelector('div[data-testid="playerContainer"]');
    if (playerContainer && !playerContainer._mouseListenerAdded) {
      playerContainer.addEventListener('mousemove', handleMouseMove);
      playerContainer._mouseListenerAdded = true;
    }
  }, 1000);
}

hbomaxMain();

