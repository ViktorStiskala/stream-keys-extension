// Restore Dialog State Management

import type { Position } from "./types";
import {
  initialPositions,
  INITIAL_VIDEO_SECONDS,
  getRandomVideoSeconds,
  formatTimeForConfig,
} from "./config";

// ============================================================================
// State
// ============================================================================

let positions: Position[] = [...initialPositions];
let userSavedPosition: Position | null = null;
let currentVideoSeconds = INITIAL_VIDEO_SECONDS;
let isDialogOpen = true;
let bannerTimeout: ReturnType<typeof setTimeout> | null = null;

// ============================================================================
// Getters
// ============================================================================

export function getPositions(): Position[] {
  return positions;
}

export function getUserSavedPosition(): Position | null {
  return userSavedPosition;
}

export function getCurrentVideoSeconds(): number {
  return currentVideoSeconds;
}

export function getIsDialogOpen(): boolean {
  return isDialogOpen;
}

export function getBannerTimeout(): ReturnType<typeof setTimeout> | null {
  return bannerTimeout;
}

// ============================================================================
// Setters
// ============================================================================

export function setUserSavedPosition(pos: Position | null): void {
  userSavedPosition = pos;
}

export function setCurrentVideoSeconds(seconds: number): void {
  currentVideoSeconds = seconds;
}

export function setIsDialogOpen(open: boolean): void {
  isDialogOpen = open;
}

export function setBannerTimeout(
  timeout: ReturnType<typeof setTimeout> | null,
): void {
  bannerTimeout = timeout;
}

// ============================================================================
// Position Management
// ============================================================================

export function addPosition(pos: Position, afterLoadTime = true): void {
  if (afterLoadTime) {
    const loadTimeIndex = positions.findIndex((p) => p.isLoadTime);
    positions.splice(loadTimeIndex + 1, 0, pos);
  } else {
    positions.push(pos);
  }
}

export function removePosition(index: number): void {
  positions.splice(index, 1);
}

export function getHistoryPositionCount(): number {
  return positions.filter((p) => !p.isLoadTime && !p.isUserSaved).length;
}

export function getOldestHistoryPositionIndex(): number {
  for (let i = positions.length - 1; i >= 0; i--) {
    if (!positions[i].isLoadTime && !positions[i].isUserSaved) {
      return i;
    }
  }
  return -1;
}

export function findSimilarPositionIndex(
  timeSeconds: number,
  threshold = 15,
): number {
  return positions.findIndex(
    (p) =>
      !p.isLoadTime &&
      !p.isUserSaved &&
      Math.abs(p.timeSeconds - timeSeconds) < threshold,
  );
}

// ============================================================================
// Reset
// ============================================================================

export function resetState(): void {
  // Generate new random time
  currentVideoSeconds = getRandomVideoSeconds();

  // Keep only load time position, updated with new time
  positions = [
    {
      time: formatTimeForConfig(currentVideoSeconds),
      timeSeconds: currentVideoSeconds,
      label: "load time",
      isLoadTime: true,
    },
  ];
  userSavedPosition = null;
}
