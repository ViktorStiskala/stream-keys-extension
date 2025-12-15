// Position history state management

import type { PositionEntry, StreamKeysVideoElement } from '@/types';
import { Debug, Settings, Video } from '@/core';

// __DEV__ is defined by vite config based on isWatch
declare const __DEV__: boolean;

// Constants
export const SEEK_MAX_HISTORY = 3;
export const SEEK_MIN_DIFF_SECONDS = 15;
export const SEEK_DEBOUNCE_MS = 2000;
// Interval for scheduling stable time updates (how often we capture a value)
export const STABLE_TIME_SCHEDULE_INTERVAL_MS = 200;
// Delay before a captured value becomes "stable" (guarantees pre-seek value)
export const STABLE_TIME_DELAY_MS = 500;
// Delay before capturing load time position (allows player auto-resume to complete)
export const LOAD_TIME_CAPTURE_DELAY_MS = 1000;
// Delay after load time capture before tracking seeks (avoids capturing initial seeks)
export const READY_FOR_TRACKING_DELAY_MS = 500;

// State
export interface PositionHistoryState {
  positionHistory: PositionEntry[];
  loadTimePosition: number | null;
  lastSeekTime: number;
  isKeyboardOrButtonSeek: boolean;
}

function createPositionHistoryState(): PositionHistoryState {
  return {
    positionHistory: [],
    loadTimePosition: null,
    lastSeekTime: 0,
    isKeyboardOrButtonSeek: false,
  };
}

/**
 * Reset position history state (used when a new video is detected)
 */
function resetState(state: PositionHistoryState): void {
  state.positionHistory = [];
  state.loadTimePosition = null;
  state.lastSeekTime = 0;
  state.isKeyboardOrButtonSeek = false;
}

/**
 * Save a position to history
 * @returns true if saved, false if blocked (too short, too close to existing, etc.)
 */
function savePositionToHistory(state: PositionHistoryState, time: number): boolean {
  if (!Settings.isPositionHistoryEnabled()) return false;

  // Don't save very short positions
  if (time < SEEK_MIN_DIFF_SECONDS) return false;

  // Check if this position is too close to load time
  if (
    state.loadTimePosition !== null &&
    Math.abs(state.loadTimePosition - time) < SEEK_MIN_DIFF_SECONDS
  ) {
    return false;
  }

  // Check if this position is too close to ANY saved position
  const tooCloseToExisting = state.positionHistory.some(
    (entry) => Math.abs(entry.time - time) < SEEK_MIN_DIFF_SECONDS
  );
  if (tooCloseToExisting) return false;

  const entry: PositionEntry = {
    time,
    label: Video.formatTime(time),
    savedAt: Date.now(),
  };

  state.positionHistory.push(entry);

  // Keep only last SEEK_MAX_HISTORY entries
  if (state.positionHistory.length > SEEK_MAX_HISTORY) {
    state.positionHistory.shift();
  }

  console.info(`[StreamKeys] Seek position saved: ${entry.label}`);
  return true;
}

/**
 * Try to save position with debouncing.
 * If within debounce window, extends the window and skips saving.
 * If outside debounce window, attempts to save and starts new window if successful.
 * @returns true if debounced (skipped), false if save was attempted
 */
function debouncedSavePosition(state: PositionHistoryState, time: number): boolean {
  const now = Date.now();
  const isWithinDebounceWindow = now - state.lastSeekTime <= SEEK_DEBOUNCE_MS;

  if (isWithinDebounceWindow) {
    // Extend debounce window while actively seeking
    state.lastSeekTime = now;
    return true; // debounced
  }

  // Try to save
  const saved = savePositionToHistory(state, time);
  // Only start debounce window if we actually saved
  if (saved) {
    state.lastSeekTime = now;
  }
  return false; // not debounced (save attempted)
}

/**
 * Record position before a seek (with debouncing for keyboard seeks).
 * @returns true if the save was debounced (skipped), false if save was attempted
 */
function recordPositionBeforeSeek(
  state: PositionHistoryState,
  preSeekTime: number | undefined
): boolean {
  if (!Settings.isPositionHistoryEnabled()) return false;
  if (preSeekTime === undefined || preSeekTime === null) return false;

  return debouncedSavePosition(state, preSeekTime);
}

/**
 * Get all positions available for restore (load time + history)
 */
export interface RestorePosition {
  time: number;
  label: string;
  relativeText: string | number;
  isLoadTime: boolean;
}

function getRestorePositions(state: PositionHistoryState): RestorePosition[] {
  const positions: RestorePosition[] = [];

  // Add load time position first
  if (state.loadTimePosition !== null && state.loadTimePosition >= SEEK_MIN_DIFF_SECONDS) {
    positions.push({
      time: state.loadTimePosition,
      label: Video.formatTime(state.loadTimePosition),
      relativeText: 'load time',
      isLoadTime: true,
    });
  }

  // Add history positions (most recent first)
  const reversedHistory = [...state.positionHistory].reverse();
  reversedHistory.forEach((entry) => {
    positions.push({
      time: entry.time,
      label: entry.label,
      relativeText: entry.savedAt,
      isLoadTime: false,
    });
  });

  return positions;
}

/**
 * Set up video time tracking for position capture.
 * Uses the video's _streamKeysGetPlaybackTime() method for accurate time tracking.
 */
function setupVideoTracking(
  video: StreamKeysVideoElement,
  state: PositionHistoryState,
  getVideoElement: () => StreamKeysVideoElement | null
): () => void {
  if (video._streamKeysSeekListenerAdded) {
    return () => {};
  }

  video._streamKeysPlaybackStarted = false;
  video._streamKeysReadyForTracking = false;

  let loadTimeCaptureTimeout: number | null = null;
  let readyForTrackingTimeout: number | null = null;

  /**
   * Get the actual playback time using the video's augmented method.
   */
  const getActualPlaybackTime = (v: StreamKeysVideoElement): number => {
    return v._streamKeysGetPlaybackTime?.() ?? v.currentTime;
  };

  // Handle seeking events - use stable time (guaranteed pre-seek value)
  const handleSeeking = () => {
    if (!Settings.isPositionHistoryEnabled()) return;

    const stableTime = video._streamKeysGetStableTime?.();
    if (stableTime !== undefined && video._streamKeysReadyForTracking) {
      if (state.isKeyboardOrButtonSeek) {
        // Keyboard/button seeks are handled by recordPositionBeforeSeek with debouncing
        return;
      }

      // Timeline clicks: save directly without debouncing.
      // Each timeline click is a deliberate user action that should be recorded.
      // (Debouncing is only needed for keyboard seeks to prevent rapid key presses
      // from filling history)
      if (__DEV__) Debug.action('UI: Timeline click', `from ${Video.formatTime(stableTime)}`);
      savePositionToHistory(state, stableTime);
    }
  };

  // Track time updates - always update current time
  const handleTimeUpdate = () => {
    if (!video.seeking) {
      video._streamKeysLastKnownTime = getActualPlaybackTime(video);
    }
  };

  // Capture load time position
  const captureLoadTimeOnce = () => {
    if (state.loadTimePosition === null && loadTimeCaptureTimeout === null) {
      loadTimeCaptureTimeout = window.setTimeout(() => {
        loadTimeCaptureTimeout = null;
        const actualTime = getActualPlaybackTime(video);

        if (state.loadTimePosition === null && actualTime >= SEEK_MIN_DIFF_SECONDS) {
          state.loadTimePosition = actualTime;
          console.info(
            `[StreamKeys] Load time position captured: ${Video.formatTime(state.loadTimePosition)}`
          );
        }

        if (readyForTrackingTimeout === null) {
          readyForTrackingTimeout = window.setTimeout(() => {
            readyForTrackingTimeout = null;
            if (!video._streamKeysReadyForTracking) {
              video._streamKeysReadyForTracking = true;
              console.info('[StreamKeys] Ready to track seeks');
            }
          }, READY_FOR_TRACKING_DELAY_MS);
        }
      }, LOAD_TIME_CAPTURE_DELAY_MS);
    }
  };

  // After seek completes, sync last known time but preserve stable time
  // The stable time will be updated by the RAF loop with the proper 500ms delay
  // This ensures that rapid consecutive seeks don't corrupt the stable time
  const handleSeeked = () => {
    const currentTime = getActualPlaybackTime(video);
    video._streamKeysLastKnownTime = currentTime;
    // Note: We intentionally do NOT update _streamKeysStableTime here
    // The RAF loop will update it with proper delay, ensuring it always
    // reflects a position from 500ms ago (guaranteed pre-seek value)

    if (!video._streamKeysReadyForTracking) {
      captureLoadTimeOnce();
    }
  };

  // Set up listeners
  video.addEventListener('seeking', handleSeeking);
  video.addEventListener('timeupdate', handleTimeUpdate);
  video.addEventListener('canplay', captureLoadTimeOnce);
  video.addEventListener('playing', captureLoadTimeOnce);
  video.addEventListener('seeked', handleSeeked);

  // Initialize if video is already loaded
  if (video.readyState >= 1) {
    const initialTime = getActualPlaybackTime(video);
    video._streamKeysLastKnownTime = initialTime;
    // Initialize stable time to ensure fallback chain always has a valid value
    // This prevents the first seek from using _streamKeysLastKnownTime fallback
    video._streamKeysStableTime = initialTime;
  }
  if (video.readyState >= 3) {
    captureLoadTimeOnce();
  }

  video._streamKeysSeekListenerAdded = true;

  // Start RAF tracking with delayed stable time capture
  // _streamKeysLastKnownTime: always current (updated every frame)
  // _streamKeysStableTime: delayed by 500ms, guaranteed to be pre-seek value
  let trackingFrame: number | null = null;
  let lastStableSchedule = 0;
  let stableTimeInitialized = video._streamKeysStableTime !== undefined;

  const track = () => {
    const currentVideo = getVideoElement();
    if (currentVideo && !currentVideo.seeking) {
      const newTime = getActualPlaybackTime(currentVideo);

      // Always update current time
      currentVideo._streamKeysLastKnownTime = newTime;

      // Initialize stable time on first tracking frame if not already set
      // This ensures we always have a valid stable time before first seek
      if (!stableTimeInitialized) {
        currentVideo._streamKeysStableTime = newTime;
        stableTimeInitialized = true;
      }

      // Schedule stable time update with delay (throttled to every ~200ms)
      // The captured value is passed to setTimeout, so it's frozen at this moment
      const now = Date.now();
      if (now - lastStableSchedule >= STABLE_TIME_SCHEDULE_INTERVAL_MS) {
        const capturedTime = newTime;
        setTimeout(() => {
          // Update stable time to the value from 500ms ago
          if (currentVideo) {
            currentVideo._streamKeysStableTime = capturedTime;
          }
        }, STABLE_TIME_DELAY_MS);
        lastStableSchedule = now;
      }
    }
    trackingFrame = requestAnimationFrame(track);
  };
  track();

  console.info('[StreamKeys] Video seek listener added');

  // Return cleanup function
  return () => {
    video.removeEventListener('seeking', handleSeeking);
    video.removeEventListener('seeked', handleSeeked);
    video.removeEventListener('timeupdate', handleTimeUpdate);
    video.removeEventListener('canplay', captureLoadTimeOnce);
    video.removeEventListener('playing', captureLoadTimeOnce);
    video._streamKeysSeekListenerAdded = false;
    if (loadTimeCaptureTimeout !== null) {
      clearTimeout(loadTimeCaptureTimeout);
      loadTimeCaptureTimeout = null;
    }
    if (readyForTrackingTimeout !== null) {
      clearTimeout(readyForTrackingTimeout);
      readyForTrackingTimeout = null;
    }
    if (trackingFrame !== null) {
      cancelAnimationFrame(trackingFrame);
    }
  };
}

// Public API
export const PositionHistory = {
  createState: createPositionHistoryState,
  /** Reset state when a new video is detected */
  reset: resetState,
  save: savePositionToHistory,
  record: recordPositionBeforeSeek,
  getPositions: getRestorePositions,
  setupTracking: setupVideoTracking,
  /** Exposed for testing - save with debounce logic, returns true if debounced */
  debouncedSave: debouncedSavePosition,
};
