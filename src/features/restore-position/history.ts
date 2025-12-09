// Position history state management

import type { PositionEntry, StreamKeysVideoElement } from '@/types';
import { isPositionHistoryEnabled } from '@/core/settings';
import { formatTime, getDisneyPlaybackTime } from '@/core/video';

/**
 * Get the actual playback time, accounting for streaming services like Disney+
 * that use MediaSource where video.currentTime doesn't reflect actual position.
 */
function getActualPlaybackTime(video: StreamKeysVideoElement): number {
  // For Disney+, try to get the actual time from their progress bar
  const disneyTime = getDisneyPlaybackTime();
  if (disneyTime !== null) {
    return disneyTime;
  }
  // Fallback to standard video currentTime
  return video.currentTime;
}

// Constants
export const SEEK_MAX_HISTORY = 3;
export const SEEK_MIN_DIFF_SECONDS = 15;
export const SEEK_DEBOUNCE_MS = 5000;

// State
export interface PositionHistoryState {
  positionHistory: PositionEntry[];
  loadTimePosition: number | null;
  lastSeekTime: number;
  isKeyboardOrButtonSeek: boolean;
}

export function createPositionHistoryState(): PositionHistoryState {
  return {
    positionHistory: [],
    loadTimePosition: null,
    lastSeekTime: 0,
    isKeyboardOrButtonSeek: false,
  };
}

/**
 * Save a position to history
 */
export function savePositionToHistory(state: PositionHistoryState, time: number): void {
  if (!isPositionHistoryEnabled()) return;

  // Don't save very short positions
  if (time < SEEK_MIN_DIFF_SECONDS) return;

  // Check if this position is too close to load time
  if (
    state.loadTimePosition !== null &&
    Math.abs(state.loadTimePosition - time) < SEEK_MIN_DIFF_SECONDS
  ) {
    return;
  }

  // Check if this position is too close to ANY saved position
  const tooCloseToExisting = state.positionHistory.some(
    (entry) => Math.abs(entry.time - time) < SEEK_MIN_DIFF_SECONDS
  );
  if (tooCloseToExisting) return;

  const entry: PositionEntry = {
    time,
    label: formatTime(time),
    savedAt: Date.now(),
  };

  state.positionHistory.push(entry);

  // Keep only last SEEK_MAX_HISTORY entries
  if (state.positionHistory.length > SEEK_MAX_HISTORY) {
    state.positionHistory.shift();
  }

  console.info(`[StreamKeys] Seek position saved: ${entry.label}`);
}

/**
 * Record position before a seek (with debouncing for keyboard seeks)
 */
export function recordPositionBeforeSeek(
  state: PositionHistoryState,
  preSeekTime: number | undefined
): void {
  if (!isPositionHistoryEnabled()) return;
  if (preSeekTime === undefined || preSeekTime === null) return;

  const now = Date.now();

  // If this is a new seek sequence (more than SEEK_DEBOUNCE_MS since last seek)
  // Save the position immediately so it's available in the restore dialog
  if (now - state.lastSeekTime > SEEK_DEBOUNCE_MS) {
    savePositionToHistory(state, preSeekTime);
  }

  state.lastSeekTime = now;
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

export function getRestorePositions(state: PositionHistoryState): RestorePosition[] {
  const positions: RestorePosition[] = [];

  // Add load time position first
  if (state.loadTimePosition !== null && state.loadTimePosition >= SEEK_MIN_DIFF_SECONDS) {
    positions.push({
      time: state.loadTimePosition,
      label: formatTime(state.loadTimePosition),
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
 * Set up video time tracking for position capture
 */
export function setupVideoTracking(
  video: StreamKeysVideoElement,
  state: PositionHistoryState,
  getVideoElement: () => StreamKeysVideoElement | null
): () => void {
  if (video._streamKeysSeekListenerAdded) {
    return () => {};
  }

  video._streamKeysPlaybackStarted = false;
  video._streamKeysReadyForTracking = false;

  // Handle seeking events
  const handleSeeking = () => {
    if (!isPositionHistoryEnabled()) return;

    if (video._lastKnownTime !== undefined && video._streamKeysReadyForTracking) {
      if (state.isKeyboardOrButtonSeek) {
        // Keyboard seeks are handled by recordPositionBeforeSeek with debouncing
        return;
      }
      // UI buttons and timeline clicks: save immediately
      savePositionToHistory(state, video._lastKnownTime);
    }
  };

  // Track time updates - use actual playback time for streaming services
  const handleTimeUpdate = () => {
    if (!video.seeking) {
      video._lastKnownTime = getActualPlaybackTime(video);
    }
  };

  // Capture load time position
  const captureLoadTimeOnce = () => {
    if (state.loadTimePosition === null) {
      setTimeout(() => {
        const actualTime = getActualPlaybackTime(video);

        if (state.loadTimePosition === null && actualTime >= SEEK_MIN_DIFF_SECONDS) {
          state.loadTimePosition = actualTime;
          console.info(
            `[StreamKeys] Load time position captured: ${formatTime(state.loadTimePosition)}`
          );
        }

        setTimeout(() => {
          if (!video._streamKeysReadyForTracking) {
            video._streamKeysReadyForTracking = true;
            console.info('[StreamKeys] Ready to track seeks');
          }
        }, 500);
      }, 1000);
    }
  };

  // Set up listeners
  video.addEventListener('seeking', handleSeeking);
  video.addEventListener('timeupdate', handleTimeUpdate);
  video.addEventListener('canplay', captureLoadTimeOnce);
  video.addEventListener('playing', captureLoadTimeOnce);
  video.addEventListener('seeked', () => {
    if (!video._streamKeysReadyForTracking) {
      captureLoadTimeOnce();
    }
  });

  // Initialize if video is already loaded
  if (video.readyState >= 1) {
    video._lastKnownTime = getActualPlaybackTime(video);
  }
  if (video.readyState >= 3) {
    captureLoadTimeOnce();
  }

  video._streamKeysSeekListenerAdded = true;

  // Start RAF tracking - use actual playback time
  let trackingFrame: number | null = null;
  const track = () => {
    const currentVideo = getVideoElement();
    if (currentVideo && !currentVideo.seeking) {
      currentVideo._lastKnownTime = getActualPlaybackTime(currentVideo);
    }
    trackingFrame = requestAnimationFrame(track);
  };
  track();

  console.info('[StreamKeys] Video seek listener added');

  // Return cleanup function
  return () => {
    video.removeEventListener('seeking', handleSeeking);
    video.removeEventListener('timeupdate', handleTimeUpdate);
    if (trackingFrame !== null) {
      cancelAnimationFrame(trackingFrame);
    }
  };
}
