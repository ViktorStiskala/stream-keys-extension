// Base handler with shared functionality for all streaming services
// Service handlers call createHandler(config) with service-specific configuration

function createHandler(config) {
  console.info(`[StreamKeys] ${config.name} extension loaded`);

  // State
  let currentFullscreenElement = null;
  let playerKeyListenerAdded = false;
  let lastMouseMoveTime = 0;

  // Get settings from injected global
  const getSettings = () => window.__streamKeysSettings || {};
  const getSubtitlePreferences = () => getSettings().subtitleLanguages || [];

  // ============================================
  // Banner Notification
  // ============================================
  
  let bannerTimeout = null;
  
  const showBanner = (message) => {
    // Remove existing banner
    const existing = document.getElementById('streamkeys-banner');
    if (existing) {
      existing.remove();
      clearTimeout(bannerTimeout);
    }

    const banner = document.createElement('div');
    banner.id = 'streamkeys-banner';
    banner.textContent = message;
    banner.style.cssText = `
      position: fixed;
      bottom: 25%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.6);
      color: white;
      padding: 20px 40px;
      border-radius: 10px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 22px;
      font-weight: 600;
      z-index: 2147483647;
      pointer-events: none;
      opacity: 1;
      transition: opacity 0.3s ease-out;
    `;

    document.body.appendChild(banner);

    // Fade out after 1.5 seconds
    bannerTimeout = setTimeout(() => {
      banner.style.opacity = '0';
      setTimeout(() => banner.remove(), 300);
    }, 1500);
  };

  // ============================================
  // Subtitle Toggle Logic
  // ============================================

  const findMatchingLanguage = (preferences, available) => {
    // Search through preferences in priority order
    for (const pref of preferences) {
      const prefNormalized = pref.trim().toLowerCase();
      const match = available.find(item => 
        item.label.trim().toLowerCase() === prefNormalized
      );
      if (match) return match;
    }
    return null;
  };

  const toggleSubtitles = () => {
    if (!config.subtitles) return;

    const preferences = getSubtitlePreferences();
    
    // If no preferences configured, do nothing
    if (preferences.length === 0) {
      return;
    }

    const isOn = config.subtitles.getCurrentState();

    if (isOn) {
      // Turn off subtitles
      config.subtitles.turnOff();
      showBanner('Captions: Off');
    } else {
      // Find matching language from preferences
      const available = config.subtitles.getAvailable();
      const match = findMatchingLanguage(preferences, available);
      
      if (match) {
        config.subtitles.selectLanguage(match);
        showBanner(match.label);
      } else {
        showBanner('Captions: Language not found, check extension settings');
      }
    }
  };

  // ============================================
  // Key Handling
  // ============================================

  const handleGlobalKeys = (e) => {
    // Skip if user is typing in an input/textarea
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
      return;
    }

    // Handle subtitle toggle
    if (e.code === 'KeyC') {
      e.preventDefault();
      e.stopPropagation();
      toggleSubtitles();
      return;
    }

    // Handle other keys via config
    const button = config.getButton(e.code);
    if (!button) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    button.click();
  };

  // Use capture phase to intercept before any other handlers
  window.addEventListener('keydown', handleGlobalKeys, true);

  // ============================================
  // Focus Management
  // ============================================

  const focusPlayer = () => {
    const player = config.getPlayer();
    if (player && document.hasFocus()) {
      if (config.setupPlayerFocus) {
        config.setupPlayerFocus(player);
      } else {
        player.setAttribute('tabindex', '-1');
        player.focus();
      }
    }
  };

  // ============================================
  // Click Overlay for Fullscreen Exit
  // ============================================

  const createClickOverlay = () => {
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

    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.remove();
      focusPlayer();
    }, { once: true, capture: true });

    // Append to config-specified container or body
    const container = config.getOverlayContainer ? config.getOverlayContainer() : document.body;
    container.appendChild(overlay);
  };

  // ============================================
  // Fullscreen Handling
  // ============================================

  let wasInFullscreen = false;

  const handleFullscreenChange = () => {
    const fullscreenEl = document.fullscreenElement || document.webkitFullscreenElement;

    // Remove listener from previous fullscreen element
    if (currentFullscreenElement) {
      currentFullscreenElement.removeEventListener('keydown', handleGlobalKeys, true);
      currentFullscreenElement = null;
    }

    if (fullscreenEl) {
      // Entering fullscreen
      currentFullscreenElement = fullscreenEl;
      currentFullscreenElement.addEventListener('keydown', handleGlobalKeys, true);
      setTimeout(focusPlayer, 100);
      wasInFullscreen = true;
    } else if (wasInFullscreen) {
      // Exiting fullscreen
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

  // ============================================
  // Player Setup
  // ============================================

  const setupPlayer = () => {
    const player = config.getPlayer();
    if (!player) return;

    if (config.onPlayerSetup) {
      config.onPlayerSetup(player);
    }

    // Add keydown listener directly to player
    if (!playerKeyListenerAdded) {
      player.addEventListener('keydown', handleGlobalKeys, true);
      playerKeyListenerAdded = true;
    }
  };

  // Throttled mousemove handler to restore focus
  const handleMouseMove = () => {
    const now = Date.now();
    if (now - lastMouseMoveTime < 500) return;
    lastMouseMoveTime = now;
    focusPlayer();
  };

  // Setup player periodically
  setInterval(() => {
    setupPlayer();

    const player = config.getPlayer();
    if (player && !player._mouseListenerAdded) {
      player.addEventListener('mousemove', handleMouseMove);
      player._mouseListenerAdded = true;
    }
  }, 1000);
}

// Export for use by service handlers
window.StreamKeys = { createHandler };

