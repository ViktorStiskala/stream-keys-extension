// Video element utilities

import type { StreamKeysVideoElement } from '@/types';

/**
 * Check if a video element is likely the active/playing video
 */
function isActiveVideo(video: HTMLVideoElement): boolean {
  // Check if video is visible
  const isVisible = video.style.display !== 'none' && video.offsetParent !== null;
  // Check if video has meaningful duration (not 0 or NaN)
  const hasDuration = video.duration > 0 && !isNaN(video.duration);
  // Check if video has a src
  const hasSrc = !!video.src;

  return isVisible && hasDuration && hasSrc;
}

/**
 * Get the video element from the player or page
 */
export function getVideoElement(
  getPlayer: () => HTMLElement | null
): StreamKeysVideoElement | null {
  // Try to find video element within the player
  const player = getPlayer();
  if (player) {
    const allVideos = player.querySelectorAll('video');

    // Priority 1: Look for hive-video class (Disney+ specific active video)
    for (const video of allVideos) {
      if (video.classList.contains('hive-video')) {
        return video as StreamKeysVideoElement;
      }
    }

    // Priority 2: Look for video that appears to be active (visible, has duration, has src)
    for (const video of allVideos) {
      if (isActiveVideo(video)) {
        return video as StreamKeysVideoElement;
      }
    }

    // Priority 3: Video with src and visible (display not none)
    for (const video of allVideos) {
      if (video.src && video.style.display !== 'none') {
        return video as StreamKeysVideoElement;
      }
    }

    // Priority 4: Any video with src
    for (const video of allVideos) {
      if (video.src) {
        return video as StreamKeysVideoElement;
      }
    }

    // Last fallback: first video
    const video = player.querySelector('video');
    if (video) {
      return video as StreamKeysVideoElement;
    }
  }
  // Fallback: find any video on the page
  return document.querySelector('video') as StreamKeysVideoElement | null;
}

// Cache for Disney progress bar element
let disneyProgressBarCache: { element: Element | null; lastCheck: number } | null = null;
const DISNEY_CACHE_TTL = 5000; // Re-check every 5 seconds
let disneyTimeLoggedOnce = false;

/**
 * Try to get Disney+ actual playback time from their progress bar.
 * Disney+ uses MediaSource which means video.currentTime is relative to buffer,
 * not actual content position. The real time is in the progress bar's aria-valuenow.
 */
export function getDisneyPlaybackTime(): number | null {
  // Disney stores the actual time in the progress bar's aria-valuenow attribute
  // The progress-bar element uses Shadow DOM with a .progress-bar__thumb element
  // that has aria-valuenow in seconds

  const now = Date.now();

  // Helper to get time from progress bar thumb
  const getTimeFromThumb = (thumb: Element | null): number | null => {
    if (!thumb) return null;
    const valueNow = thumb.getAttribute('aria-valuenow');
    if (valueNow) {
      const seconds = parseInt(valueNow, 10);
      if (!isNaN(seconds) && seconds >= 0) {
        return seconds;
      }
    }
    return null;
  };

  // Try to use cached element first
  if (disneyProgressBarCache && now - disneyProgressBarCache.lastCheck < DISNEY_CACHE_TTL) {
    const time = getTimeFromThumb(disneyProgressBarCache.element);
    if (time !== null) {
      return time;
    }
  }

  // Find progress-bar element and access its shadow DOM
  const progressBar = document.querySelector('progress-bar');
  if (progressBar?.shadowRoot) {
    const thumb = progressBar.shadowRoot.querySelector('.progress-bar__thumb');
    const time = getTimeFromThumb(thumb);
    if (time !== null) {
      // Cache the thumb element
      disneyProgressBarCache = { element: thumb, lastCheck: now };
      if (!disneyTimeLoggedOnce) {
        disneyTimeLoggedOnce = true;
        console.info('[StreamKeys] Found Disney progress bar (aria-valuenow)');
      }
      return time;
    }
  }

  // Update cache to indicate we didn't find it
  disneyProgressBarCache = { element: null, lastCheck: now };
  return null;
}

/**
 * Format seconds to human-readable time string (e.g., "1:23:45" or "23:45")
 */
export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp to relative time string (e.g., "2m 30s ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const totalSeconds = Math.floor((Date.now() - timestamp) / 1000);

  if (totalSeconds < 1) return 'just now';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
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
}
