// Video element utilities

import type { StreamKeysVideoElement } from '@/types';

/**
 * Configuration for creating a video element getter
 */
export interface VideoGetterConfig {
  getPlayer: () => HTMLElement | null;
  getVideo?: () => HTMLVideoElement | null;
  getPlaybackTime?: () => number | null;
  getDuration?: () => number | null;
}

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
 * Augment a video element with StreamKeys methods.
 * Adds _streamKeysGetPlaybackTime() which uses custom logic if available.
 * Adds _streamKeysGetStableTime() which returns the stable pre-seek time.
 * Adds _streamKeysGetDuration() which uses custom logic if available.
 */
function augmentVideoElement(
  video: HTMLVideoElement,
  customGetPlaybackTime?: () => number | null,
  customGetDuration?: () => number | null
): StreamKeysVideoElement {
  const augmented = video as StreamKeysVideoElement;

  // Only augment once
  if (!augmented._streamKeysGetPlaybackTime) {
    augmented._streamKeysGetPlaybackTime = () => {
      if (customGetPlaybackTime) {
        const time = customGetPlaybackTime();
        if (time !== null) return time;
      }
      return video.currentTime;
    };

    // Stable time getter with fallback chain for position restore
    augmented._streamKeysGetStableTime = () => {
      return (
        augmented._streamKeysStableTime ??
        augmented._streamKeysLastKnownTime ??
        augmented._streamKeysGetPlaybackTime?.() ??
        video.currentTime
      );
    };

    augmented._streamKeysGetDuration = () => {
      if (customGetDuration) {
        const duration = customGetDuration();
        if (duration !== null) return duration;
      }
      return video.duration;
    };
  }

  return augmented;
}

/**
 * Find a video element using fallback logic within the player
 */
function findVideoInPlayer(player: HTMLElement): HTMLVideoElement | null {
  const allVideos = player.querySelectorAll('video');

  // Priority 1: Look for video that appears to be active (visible, has duration, has src)
  for (const video of allVideos) {
    if (isActiveVideo(video)) {
      return video;
    }
  }

  // Priority 2: Video with src and visible (display not none)
  for (const video of allVideos) {
    if (video.src && video.style.display !== 'none') {
      return video;
    }
  }

  // Priority 3: Any video with src
  for (const video of allVideos) {
    if (video.src) {
      return video;
    }
  }

  // Last fallback: first video
  return player.querySelector('video');
}

/**
 * Create a video element getter with custom behavior baked in.
 * The returned function finds the video and augments it with _streamKeysGetPlaybackTime.
 */
function createVideoGetter(config: VideoGetterConfig): () => StreamKeysVideoElement | null {
  return () => {
    let video: HTMLVideoElement | null = null;

    // If custom getter is provided, use it exclusively (don't fall back to generic detection)
    // This prevents issues with services like Disney+ that have multiple video elements
    if (config.getVideo) {
      video = config.getVideo();
    } else {
      // Try to find video element within the player
      const player = config.getPlayer();
      if (player) {
        video = findVideoInPlayer(player);
      }

      // Fallback: find any video on the page
      if (!video) {
        video = document.querySelector('video');
      }
    }

    if (video) {
      return augmentVideoElement(video, config.getPlaybackTime, config.getDuration);
    }
    return null;
  };
}

/**
 * Format seconds to human-readable time string (e.g., "1:23:45" or "23:45")
 */
function formatTime(seconds: number): string {
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
function formatRelativeTime(timestamp: number): string {
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

// Public API
export const Video = {
  createGetter: createVideoGetter,
  formatTime,
  formatRelativeTime,
};
