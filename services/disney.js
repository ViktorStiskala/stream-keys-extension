function disneyMain() {
  console.info('[StreamKeys] Disney+ extension loaded');

  const getShadowRootButton = (body, selector) => {
    return body.querySelector(selector)?.shadowRoot?.querySelector("info-tooltip button");
  }

  // Global key handler - captures keys regardless of focus
  const handleGlobalKeys = (e) => {
    // Skip if user is typing in an input/textarea
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }

    // Map keys to their target buttons
    const keyMap = {
      'Space': 'toggle-play-pause',
      'KeyF': 'toggle-fullscreen',
    };

    const targetSelector = keyMap[e.code];
    if (!targetSelector) {
      return;
    }

    const button = getShadowRootButton(document.body, targetSelector);
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

  // Remove outline from player and video
  const removeOutline = () => {
    const player = document.body.querySelector("disney-web-player");
    const video = player?.querySelector("video");
    
    player?.style?.setProperty("outline", "0", "important");
    video?.style?.setProperty("outline", "0", "important");
  };

  // Helper to focus player
  const focusPlayer = () => {
    const player = document.body.querySelector("disney-web-player");
    if (player && document.hasFocus()) {
      player.setAttribute('tabindex', '-1');
      player.focus();
      removeOutline();
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
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 2147483647;
      background: transparent;
      cursor: default;
    `;
    
    // Remove overlay on click and focus player
    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.remove();
      focusPlayer();
    }, { once: true });
    
    document.body.appendChild(overlay);
  };

  // Track fullscreen state for focus restoration
  let currentFullscreenElement = null;
  let playerKeyListenerAdded = false;
  
  document.addEventListener('fullscreenchange', () => {
    // Remove listener from previous fullscreen element
    if (currentFullscreenElement) {
      currentFullscreenElement.removeEventListener('keydown', handleGlobalKeys, true);
      currentFullscreenElement = null;
    }

    if (document.fullscreenElement) {
      // Entering fullscreen - add listener to fullscreen element
      currentFullscreenElement = document.fullscreenElement;
      currentFullscreenElement.addEventListener('keydown', handleGlobalKeys, true);
      setTimeout(focusPlayer, 100);
    } else {
      // Exiting fullscreen - show invisible overlay to capture click for user activation
      setTimeout(() => {
        createClickOverlay();
        focusPlayer();
        console.info('[StreamKeys] Fullscreen exit: Click to focus overlay added');
      }, 100);
    }
  });

  // Setup player for keyboard control
  const setupPlayer = () => {
    const player = document.body.querySelector("disney-web-player");
    
    if (!player) return;
    
    removeOutline();
    player.setAttribute('tabindex', '-1');
    
    // Add keydown listener directly to player
    if (!playerKeyListenerAdded) {
      player.addEventListener('keydown', handleGlobalKeys, true);
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
    
    const player = document.body.querySelector("disney-web-player");
    if (player && !player._mouseListenerAdded) {
      player.addEventListener('mousemove', handleMouseMove);
      player._mouseListenerAdded = true;
    }
  }, 1000);
}

disneyMain();

