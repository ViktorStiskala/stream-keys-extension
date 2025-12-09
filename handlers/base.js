// Base handler with shared functionality for all streaming services
// Service handlers call createHandler(config) with service-specific configuration

function createHandler(config) {
  console.info(`[StreamKeys] ${config.name} extension loaded`);

  // State
  let currentFullscreenElement = null;
  let playerKeyListenerAdded = false;
  let lastMouseMoveTime = 0;

  // Position history state
  let positionHistory = []; // Array of { time: number, label: string }
  const SEEK_MAX_HISTORY = 3;
  const SEEK_MIN_DIFF_SECONDS = 10; // Minimum difference between saved positions
  let lastSeekTime = 0;
  const SEEK_DEBOUNCE_MS = 5000; // 5 seconds - rapid seeks within this window are grouped
  let loadTimePosition = null; // Position when video started playing (captured after initial load)

  // Get settings from injected global
  const getSettings = () => window.__streamKeysSettings || {};
  const getSubtitlePreferences = () => getSettings().subtitleLanguages || [];
  const isPositionHistoryEnabled = () => getSettings().positionHistoryEnabled !== false;

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
  // Position History & Restore
  // ============================================

  const getVideoElement = () => {
    // Try to find video element within the player
    const player = config.getPlayer();
    if (player) {
      const video = player.querySelector('video');
      if (video) return video;
    }
    // Fallback: find any video on the page
    return document.querySelector('video');
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const savePositionToHistory = (time) => {
    if (!isPositionHistoryEnabled()) return;
    
    // Don't save very short positions
    if (time < SEEK_MIN_DIFF_SECONDS) return;
    
    // Check if this position is too close to load time
    if (loadTimePosition !== null && Math.abs(loadTimePosition - time) < SEEK_MIN_DIFF_SECONDS) {
      return;
    }
    
    // Check if this position is too close to ANY saved position
    // This prevents overwriting restore options when user restores to a nearby position
    const tooCloseToExisting = positionHistory.some(entry => 
      Math.abs(entry.time - time) < SEEK_MIN_DIFF_SECONDS
    );
    if (tooCloseToExisting) return;

    const entry = {
      time: time,
      label: formatTime(time),
      savedAt: Date.now()
    };

    positionHistory.push(entry);
    
    // Keep only last SEEK_MAX_HISTORY entries
    if (positionHistory.length > SEEK_MAX_HISTORY) {
      positionHistory.shift();
    }
    
    console.info(`[StreamKeys] Seek position saved: ${entry.label}`);
  };

  // Record position before any seek (keyboard or UI)
  // This implements debouncing: rapid seeks only save the position before the first seek
  // Position is saved immediately and available in the restore dialog right away
  const recordPositionBeforeSeek = (preSeekTime) => {
    if (!isPositionHistoryEnabled()) return;
    if (preSeekTime === undefined || preSeekTime === null) return;

    const now = Date.now();

    // If this is a new seek sequence (more than SEEK_DEBOUNCE_MS since last seek)
    // Save the position immediately so it's available in the restore dialog
    if (now - lastSeekTime > SEEK_DEBOUNCE_MS) {
      savePositionToHistory(preSeekTime);
    }
    // Otherwise we're in an active seek sequence - don't save (position from first seek is already saved)

    lastSeekTime = now;
  };

  // Restore dialog state
  let restoreDialog = null;
  let dialogUpdateInterval = null;

  const formatRelativeTime = (timestamp) => {
    const totalSeconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (totalSeconds < 1) return 'just now';
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      // For hours, don't show seconds
      if (minutes > 0) {
        return `${hours}h ${minutes}m ago`;
      }
      return `${hours}h ago`;
    }
    
    if (minutes > 0) {
      if (seconds > 0) {
        return `${minutes}m ${seconds}s ago`;
      }
      return `${minutes}m ago`;
    }
    
    return `${seconds}s ago`;
  };

  const closeRestoreDialog = () => {
    if (dialogUpdateInterval) {
      clearInterval(dialogUpdateInterval);
      dialogUpdateInterval = null;
    }
    if (restoreDialog) {
      restoreDialog.remove();
      restoreDialog = null;
    }
  };

  const restorePosition = (time) => {
    const video = getVideoElement();
    if (video) {
      video.currentTime = time;
      showBanner(`Restored to ${formatTime(time)}`);
    }
  };

  const createRestoreDialog = () => {
    // Toggle behavior - close if already open
    if (restoreDialog) {
      closeRestoreDialog();
      return;
    }

    restoreDialog = document.createElement('div');
    restoreDialog.id = 'streamkeys-restore-dialog';
    restoreDialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 24px 32px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 2147483647;
      min-width: 300px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    // Header with title and close button
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    `;

    const title = document.createElement('div');
    title.textContent = 'Restore Position';
    title.style.cssText = `
      font-size: 18px;
      font-weight: 600;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      font-size: 26px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      margin-top: -5px;
      transition: color 0.2s;
    `;
    closeButton.onmouseenter = () => closeButton.style.color = 'white';
    closeButton.onmouseleave = () => closeButton.style.color = 'rgba(255, 255, 255, 0.6)';
    closeButton.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeRestoreDialog();
    };

    header.appendChild(title);
    header.appendChild(closeButton);
    restoreDialog.appendChild(header);

    // Current time display
    const currentTimeContainer = document.createElement('div');
    currentTimeContainer.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      margin-bottom: 12px;
    `;

    const currentTimeLabel = document.createElement('span');
    currentTimeLabel.textContent = 'Current time';
    currentTimeLabel.style.cssText = `
      font-size: 14px;
      color: rgba(255, 255, 255, 0.6);
    `;

    const currentTimeValue = document.createElement('span');
    currentTimeValue.id = 'streamkeys-current-time';
    currentTimeValue.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    `;

    currentTimeContainer.appendChild(currentTimeLabel);
    currentTimeContainer.appendChild(currentTimeValue);
    restoreDialog.appendChild(currentTimeContainer);

    // Position list
    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    // Get video duration for progress bar calculation
    const video = getVideoElement();
    const videoDuration = video ? video.duration : 0;

    // Helper to create a position item
    const createPositionItem = (keyNumber, time, timeText, relativeTimeText, isLoadTime = false) => {
      const item = document.createElement('button');
      item.style.cssText = `
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px 16px 16px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        color: white;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.2s;
        text-align: left;
        overflow: hidden;
      `;
      item.onmouseenter = () => item.style.background = 'rgba(255, 255, 255, 0.2)';
      item.onmouseleave = () => item.style.background = 'rgba(255, 255, 255, 0.1)';

      const keyHint = document.createElement('span');
      keyHint.textContent = `${keyNumber}`;
      keyHint.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        font-size: 14px;
        font-weight: 600;
        flex-shrink: 0;
      `;

      const timeLabel = document.createElement('span');
      timeLabel.textContent = timeText;
      timeLabel.style.cssText = `
        flex: 1;
        font-variant-numeric: tabular-nums;
      `;

      const relativeTime = document.createElement('span');
      if (!isLoadTime) {
        relativeTime.className = 'streamkeys-relative-time';
        relativeTime.dataset.savedAt = relativeTimeText;
      } else {
        relativeTime.textContent = relativeTimeText;
      }
      relativeTime.style.cssText = `
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        flex-shrink: 0;
      `;

      // Progress bar showing position in video
      const progressBar = document.createElement('div');
      const progressPercent = videoDuration > 0 ? (time / videoDuration) * 100 : 0;
      progressBar.style.cssText = `
        position: absolute;
        bottom: 4px;
        left: 16px;
        right: 16px;
        height: 3px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        overflow: hidden;
      `;

      const progressFill = document.createElement('div');
      progressFill.style.cssText = `
        width: ${progressPercent}%;
        height: 100%;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 2px;
      `;
      progressBar.appendChild(progressFill);

      item.appendChild(keyHint);
      item.appendChild(timeLabel);
      item.appendChild(relativeTime);
      item.appendChild(progressBar);

      item.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        restorePosition(time);
        closeRestoreDialog();
      };

      return item;
    };

    // Build list of all positions to show
    const allPositions = [];
    
    // Add load time position first (only if >= SEEK_MIN_DIFF_SECONDS)
    if (loadTimePosition !== null && loadTimePosition >= SEEK_MIN_DIFF_SECONDS) {
      allPositions.push({
        time: loadTimePosition,
        label: formatTime(loadTimePosition),
        relativeText: 'load time',
        isLoadTime: true
      });
    }

    // Add history positions (most recent first)
    const reversedHistory = [...positionHistory].reverse();
    reversedHistory.forEach(entry => {
      allPositions.push({
        time: entry.time,
        label: entry.label,
        relativeText: entry.savedAt,
        isLoadTime: false
      });
    });

    // Show message if no positions available
    if (allPositions.length === 0) {
      closeRestoreDialog();
      showBanner('No saved positions');
      return;
    }

    // Create items for each position (keys start from 0)
    allPositions.forEach((pos, index) => {
      const item = createPositionItem(index, pos.time, pos.label, pos.relativeText, pos.isLoadTime);
      list.appendChild(item);
    });

    restoreDialog.appendChild(list);

    // Hint text
    const maxKey = allPositions.length - 1;
    const hint = document.createElement('div');
    hint.textContent = maxKey === 0 ? 'Press 0 to select, Esc or R to close' : `Press 0-${maxKey} to select, Esc or R to close`;
    hint.style.cssText = `
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      margin-top: 16px;
      text-align: center;
    `;
    restoreDialog.appendChild(hint);

    document.body.appendChild(restoreDialog);

    // Update function for current time and relative times
    const updateDialogTimes = () => {
      // Update current time
      const video = getVideoElement();
      const currentTimeEl = document.getElementById('streamkeys-current-time');
      if (video && currentTimeEl) {
        currentTimeEl.textContent = formatTime(video.currentTime);
      }

      // Update relative times
      const relativeTimeEls = document.querySelectorAll('.streamkeys-relative-time');
      relativeTimeEls.forEach(el => {
        const savedAt = parseInt(el.dataset.savedAt, 10);
        if (savedAt) {
          el.textContent = formatRelativeTime(savedAt);
        }
      });
    };

    // Initial update
    updateDialogTimes();

    // Start interval for updates while dialog is open
    dialogUpdateInterval = setInterval(updateDialogTimes, 300);
  };

  const handleRestoreDialogKeys = (e) => {
    if (!restoreDialog) return false;

    // Don't intercept events with modifier keys (allow Cmd+R, Ctrl+R for page reload, etc.)
    if (e.metaKey || e.ctrlKey) return false;

    // Handle Escape - close dialog and prevent fullscreen exit
    if (e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeRestoreDialog();
      return true;
    }

    // Handle R key - close dialog
    if (e.code === 'KeyR') {
      e.preventDefault();
      e.stopPropagation();
      closeRestoreDialog();
      return true;
    }

    // Handle number keys 0-3
    const keyNum = parseInt(e.key, 10);
    if (keyNum >= 0 && keyNum <= 3) {
      e.preventDefault();
      e.stopPropagation();
      
      // Build the same positions array as the dialog
      const allPositions = [];
      if (loadTimePosition !== null && loadTimePosition >= SEEK_MIN_DIFF_SECONDS) {
        allPositions.push({ time: loadTimePosition });
      }
      const reversedHistory = [...positionHistory].reverse();
      reversedHistory.forEach(entry => {
        allPositions.push({ time: entry.time });
      });
      
      const position = allPositions[keyNum];
      if (position) {
        restorePosition(position.time);
        closeRestoreDialog();
      }
      return true;
    }

    return false;
  };

  // ============================================
  // Key Handling
  // ============================================

  const handleGlobalKeys = (e) => {
    // Handle restore dialog keys first - must capture ESC before it exits fullscreen
    if (handleRestoreDialogKeys(e)) {
      return;
    }

    // Don't intercept events with modifier keys (allow Cmd+Shift+C for dev tools, etc.)
    // Exception: allow plain Escape key handling even without this check
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

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

    // Handle position restore dialog
    if (e.code === 'KeyR' && isPositionHistoryEnabled()) {
      e.preventDefault();
      e.stopPropagation();
      createRestoreDialog();
      return;
    }

    // Handle other keys via config
    const button = config.getButton(e.code);
    if (!button) {
      return;
    }

    // Record position before keyboard skip actions (debounced)
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      const video = getVideoElement();
      if (video) {
        recordPositionBeforeSeek(video.currentTime);
      }
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

  // Handle video seeking events (for UI buttons and timeline clicks)
  // Uses the same debouncing as keyboard seeks
  const handleVideoSeeking = () => {
    if (!isPositionHistoryEnabled()) return;
    
    const video = getVideoElement();
    // Only record seeks after the video has been playing for a bit
    // This prevents recording the initial resume position when video loads
    if (video && video._lastKnownTime !== undefined && video._streamKeysReadyForTracking) {
      recordPositionBeforeSeek(video._lastKnownTime);
    }
  };

  // Track current time periodically to know position before seek
  const trackVideoTime = () => {
    const video = getVideoElement();
    if (video && !video.seeking) {
      video._lastKnownTime = video.currentTime;
    }
  };

  // Setup video event listeners
  const setupVideoListeners = () => {
    const video = getVideoElement();
    if (video && !video._streamKeysSeekListenerAdded) {
      // Track when the video started playing to ignore initial resume seeks
      video._streamKeysPlaybackStarted = false;
      video._streamKeysReadyForTracking = false;
      
      video.addEventListener('seeking', handleVideoSeeking);
      
      // Also track time when video metadata loads or time updates
      // This ensures we have _lastKnownTime set before any early seeks
      video.addEventListener('loadedmetadata', () => {
        video._lastKnownTime = video.currentTime;
      });
      video.addEventListener('timeupdate', () => {
        if (!video.seeking) {
          video._lastKnownTime = video.currentTime;
        }
      });
      
      // Mark video as ready for tracking after it has been playing for 2 seconds
      // This prevents recording the initial resume position
      // Also capture the load time position after a short delay to let player settle
      video.addEventListener('playing', () => {
        if (!video._streamKeysPlaybackStarted) {
          video._streamKeysPlaybackStarted = true;
          
          // Capture load time position after 500ms to let player settle on final position
          setTimeout(() => {
            if (loadTimePosition === null && video.currentTime >= SEEK_MIN_DIFF_SECONDS) {
              loadTimePosition = video.currentTime;
              console.info(`[StreamKeys] Load time position captured: ${formatTime(loadTimePosition)}`);
            }
          }, 500);
          
          setTimeout(() => {
            video._streamKeysReadyForTracking = true;
            console.info('[StreamKeys] Ready to track seeks');
          }, 2000);
        }
      });
      
      // Initialize _lastKnownTime immediately if video is already loaded
      if (video.readyState >= 1) {
        video._lastKnownTime = video.currentTime;
      }
      
      video._streamKeysSeekListenerAdded = true;
      console.info('[StreamKeys] Video seek listener added');
    }
  };

  // Try to setup video listeners immediately and frequently at first
  const earlySetup = () => {
    setupVideoListeners();
    trackVideoTime();
  };
  
  // Run setup immediately
  earlySetup();
  
  // Run setup frequently during the first few seconds to catch early video loads
  const earlySetupInterval = setInterval(earlySetup, 100);
  setTimeout(() => clearInterval(earlySetupInterval), 5000);

  // Setup player periodically
  setInterval(() => {
    setupPlayer();
    setupVideoListeners();
    trackVideoTime();

    const player = config.getPlayer();
    if (player && !player._mouseListenerAdded) {
      player.addEventListener('mousemove', handleMouseMove);
      player._mouseListenerAdded = true;
    }
  }, 1000);
}

// Export for use by service handlers
window.StreamKeys = { createHandler };

