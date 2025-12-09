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
 * Get the video element from the player or page.
 * If a custom getVideo function is provided (from handler config), use it first.
 */
export function getVideoElement(
  getPlayer: () => HTMLElement | null,
  customGetVideo?: () => HTMLVideoElement | null
): StreamKeysVideoElement | null {
  // Try custom getter first (service-specific video selection)
  if (customGetVideo) {
    const video = customGetVideo();
    if (video) {
      return video as StreamKeysVideoElement;
    }
  }

  // Try to find video element within the player
  const player = getPlayer();
  if (player) {
    const allVideos = player.querySelectorAll('video');

    // Priority 1: Look for video that appears to be active (visible, has duration, has src)
    for (const video of allVideos) {
      if (isActiveVideo(video)) {
        return video as StreamKeysVideoElement;
      }
    }

    // Priority 2: Video with src and visible (display not none)
    for (const video of allVideos) {
      if (video.src && video.style.display !== 'none') {
        return video as StreamKeysVideoElement;
      }
    }

    // Priority 3: Any video with src
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
