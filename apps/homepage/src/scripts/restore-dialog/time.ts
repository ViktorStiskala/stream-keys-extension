// Time Formatting Utilities (from extension's src/core/video.ts)

import { DURATION_SECONDS } from "./config";

/**
 * Format seconds to "H:MM:SS" or "MM:SS"
 */
export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format to "30s ago", "2m 5s ago", etc.
 */
export function formatRelativeTime(totalSeconds: number): string {
  if (totalSeconds < 1) return "just now";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

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

/**
 * Calculate progress percentage for a given time
 */
export function getProgressPercent(timeSeconds: number): number {
  return Math.round((timeSeconds / DURATION_SECONDS) * 1000) / 10;
}
