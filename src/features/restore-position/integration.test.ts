/**
 * Integration tests for Restore Position feature
 * Tests the full feature with real DOM fixtures and simulated video events
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadFixture,
  resetFixture,
  createMockVideo,
  simulateSeek,
  simulateVideoLoad,
  type MockVideoElement,
} from '@test';
import { RestorePosition, type RestorePositionAPI } from './index';
import { PositionHistory, SEEK_MIN_DIFF_SECONDS, SEEK_DEBOUNCE_MS } from './history';
import { DIALOG_ID, CURRENT_TIME_ID, RELATIVE_TIME_CLASS, RestoreDialog } from './dialog';
import { Video } from '@/core/video';
import type { StreamKeysVideoElement } from '@/types';

// Mock Settings module
vi.mock('@/core/settings', () => ({
  Settings: {
    isPositionHistoryEnabled: vi.fn(() => true),
    getSubtitlePreferences: vi.fn(() => ['English']),
  },
}));

// Timing constants from history.ts (not exported, so we mirror them here)
const LOAD_TIME_CAPTURE_DELAY_MS = 1000;
const READY_FOR_TRACKING_DELAY_MS = 500;

describe('Restore Position Integration', () => {
  let video: MockVideoElement;
  let restorePositionAPI: RestorePositionAPI;
  let getVideoElement: () => StreamKeysVideoElement | null;

  beforeEach(() => {
    resetFixture();
    vi.useFakeTimers();

    // Create mock video with HBO Max-like setup
    video = createMockVideo({
      currentTime: 0,
      duration: 7200, // 2 hours
      readyState: 4,
      src: 'blob:https://play.hbomax.com/test',
    });

    // Add video to document body
    document.body.appendChild(video);

    // Create video getter once and reuse
    getVideoElement = Video.createGetter({
      getPlayer: () => document.body,
      getVideo: () => video,
    });
  });

  afterEach(() => {
    restorePositionAPI?.cleanup();
    RestoreDialog.close();
    vi.useRealTimers();
    resetFixture();
  });

  /**
   * Helper to initialize RestorePosition and wait for ready state
   */
  async function initAndWaitForReady(): Promise<void> {
    restorePositionAPI = RestorePosition.init({ getVideoElement });

    // Simulate realistic video load: starts at 0, then player seeks to resume position
    const resumePosition = SEEK_MIN_DIFF_SECONDS + 100; // e.g., 115 seconds (1:55)
    simulateVideoLoad(video, resumePosition);

    // Wait for load time capture (1000ms) + readyForTracking (500ms)
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

    // Ensure video element has stable time set (normally done by RAF loop)
    const augmentedVideo = getVideoElement() as StreamKeysVideoElement;
    if (augmentedVideo) {
      augmentedVideo._streamKeysStableTime = augmentedVideo.currentTime;
      augmentedVideo._streamKeysLastKnownTime = augmentedVideo.currentTime;
      // Ensure readyForTracking flag is set (normally set by setTimeout in captureLoadTimeOnce)
      augmentedVideo._streamKeysReadyForTracking = true;
    }
  }

  describe('Position History with real video events', () => {
    it('captures resumed position as load time (not initial 0:00)', async () => {
      restorePositionAPI = RestorePosition.init({ getVideoElement });

      // Video loads at 0:00 initially
      video._setCurrentTime(0);
      video.dispatchEvent(new Event('canplay'));

      // Player auto-resumes to saved position (simulating streaming service behavior)
      const resumePosition = SEEK_MIN_DIFF_SECONDS + 100; // 115 seconds
      simulateSeek(video, resumePosition);

      // Wait for load time capture delay
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + 100);

      const state = restorePositionAPI.getState();
      // Load time should be the resumed position, not 0
      expect(state.loadTimePosition).toBe(resumePosition);
    });

    it('does NOT capture load time if position is below threshold', async () => {
      restorePositionAPI = RestorePosition.init({ getVideoElement });

      // Video stays at position below threshold
      video._setCurrentTime(SEEK_MIN_DIFF_SECONDS - 5);
      video.dispatchEvent(new Event('canplay'));

      // Wait for load time capture delay
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + 100);

      const state = restorePositionAPI.getState();
      expect(state.loadTimePosition).toBeNull();
    });

    it('does NOT save position during initial resume seek (readyForTracking = false)', async () => {
      restorePositionAPI = RestorePosition.init({ getVideoElement });

      // Video loads at 0:00
      video._setCurrentTime(0);
      video.dispatchEvent(new Event('canplay'));

      // Player auto-resumes - this should NOT save to history
      const resumePosition = SEEK_MIN_DIFF_SECONDS + 100;
      simulateSeek(video, resumePosition);

      const state = restorePositionAPI.getState();
      // No positions should be in history (initial seek is not tracked)
      expect(state.positionHistory).toHaveLength(0);
    });

    it('saves position on seeking event when ready for tracking', async () => {
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      const augmentedVideo = getVideoElement() as StreamKeysVideoElement;

      // Verify video is properly set up
      expect(augmentedVideo._streamKeysReadyForTracking).toBe(true);
      expect(augmentedVideo._streamKeysGetStableTime).toBeDefined();

      // First, advance video time away from load time position
      // (positions too close to load time are blocked)
      const loadTime = state.loadTimePosition!;
      const preSeekPosition = loadTime + SEEK_MIN_DIFF_SECONDS + 50;
      video._setCurrentTime(preSeekPosition);

      // Set stable time to current position (this is what RAF loop does)
      augmentedVideo._streamKeysStableTime = preSeekPosition;
      augmentedVideo._streamKeysLastKnownTime = preSeekPosition;

      // Verify stable time getter works
      const stableTime = augmentedVideo._streamKeysGetStableTime?.();
      expect(stableTime).toBe(preSeekPosition);

      // User initiates seek to a new position
      const newPosition = preSeekPosition + SEEK_MIN_DIFF_SECONDS + 100;
      simulateSeek(video, newPosition);

      // The pre-seek position should be saved
      expect(state.positionHistory.length).toBeGreaterThanOrEqual(1);
      expect(state.positionHistory[0].time).toBe(preSeekPosition);
    });

    it('debounces rapid seek events', async () => {
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      const augmentedVideo = getVideoElement() as StreamKeysVideoElement;
      const initialHistoryLength = state.positionHistory.length;

      // Start from a position that's far from load time
      const loadTime = state.loadTimePosition!;
      const startPosition = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
      video._setCurrentTime(startPosition);
      augmentedVideo._streamKeysStableTime = startPosition;
      augmentedVideo._streamKeysLastKnownTime = startPosition;

      // First seek - should save the start position
      const position1 = startPosition + SEEK_MIN_DIFF_SECONDS + 50;
      simulateSeek(video, position1);
      const afterFirstSeek = state.positionHistory.length;
      expect(afterFirstSeek).toBe(initialHistoryLength + 1);

      // Update stable time to current position
      augmentedVideo._streamKeysStableTime = position1;
      augmentedVideo._streamKeysLastKnownTime = position1;

      // Rapid seeks within debounce window - should NOT save additional entries
      vi.advanceTimersByTime(1000); // Still within 5s window
      const position2 = position1 + SEEK_MIN_DIFF_SECONDS + 50;
      simulateSeek(video, position2);

      augmentedVideo._streamKeysStableTime = position2;
      augmentedVideo._streamKeysLastKnownTime = position2;
      vi.advanceTimersByTime(1000);
      const position3 = position2 + SEEK_MIN_DIFF_SECONDS + 50;
      simulateSeek(video, position3);

      // Should still have same number as after first seek (others debounced)
      expect(state.positionHistory.length).toBe(afterFirstSeek);

      // Wait for debounce to expire
      vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);
      augmentedVideo._streamKeysStableTime = position3;
      augmentedVideo._streamKeysLastKnownTime = position3;

      // New seek should now save
      const position4 = position3 + SEEK_MIN_DIFF_SECONDS + 50;
      simulateSeek(video, position4);

      expect(state.positionHistory.length).toBe(afterFirstSeek + 1);
    });

    it('keyboard seek uses recordBeforeSeek and sets flag correctly', async () => {
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      const currentPosition = video.currentTime;

      // Simulate keyboard seek flow
      restorePositionAPI.setKeyboardSeek(true);
      expect(state.isKeyboardOrButtonSeek).toBe(true);

      // Record position before seek
      restorePositionAPI.recordBeforeSeek(currentPosition);

      // The flag should still be true
      expect(state.isKeyboardOrButtonSeek).toBe(true);

      // Reset flag (as would happen on seeked event)
      restorePositionAPI.setKeyboardSeek(false);
      expect(state.isKeyboardOrButtonSeek).toBe(false);
    });
  });

  describe('Restore Dialog UI', () => {
    beforeEach(async () => {
      loadFixture('hbomax');
      // Re-append video to the fixture
      const playerContainer = document.querySelector('[data-testid="playerContainer"]');
      if (playerContainer) {
        playerContainer.appendChild(video);
      } else {
        document.body.appendChild(video);
      }
    });

    it('dialog appears when openDialog is called', async () => {
      await initAndWaitForReady();

      // Save a position so dialog has something to show
      const state = restorePositionAPI.getState();
      const position = SEEK_MIN_DIFF_SECONDS + 200;
      PositionHistory.save(state, position);

      // Open dialog
      restorePositionAPI.openDialog();

      const dialog = document.getElementById(DIALOG_ID);
      expect(dialog).not.toBeNull();
    });

    it('dialog does NOT appear when no positions are saved', async () => {
      await initAndWaitForReady();

      // Clear any positions
      const state = restorePositionAPI.getState();
      state.loadTimePosition = null;
      state.positionHistory = [];

      // Try to open dialog
      restorePositionAPI.openDialog();

      const dialog = document.getElementById(DIALOG_ID);
      expect(dialog).toBeNull();
    });

    it('displays correct number of position entries', async () => {
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      // Save positions far enough apart
      const basePosition = SEEK_MIN_DIFF_SECONDS + 100;
      PositionHistory.save(state, basePosition);
      vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1);
      PositionHistory.save(state, basePosition + SEEK_MIN_DIFF_SECONDS + 50);

      // Should have load time + 2 saved positions
      const expectedCount =
        (state.loadTimePosition !== null ? 1 : 0) + state.positionHistory.length;

      restorePositionAPI.openDialog();

      const dialog = document.getElementById(DIALOG_ID);
      const positionButtons = dialog?.querySelectorAll('button');
      // Subtract 1 for the close button
      const positionEntryCount = (positionButtons?.length ?? 1) - 1;

      expect(positionEntryCount).toBe(expectedCount);
    });

    it('displays correct time labels for positions', async () => {
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      // Clear existing and add specific positions
      state.positionHistory = [];
      state.loadTimePosition = null;

      // Save position at exactly 100 seconds (1:40)
      const testPosition = 100;
      PositionHistory.save(state, testPosition);

      restorePositionAPI.openDialog();

      const dialog = document.getElementById(DIALOG_ID);
      expect(dialog).not.toBeNull();

      // Check that the time label is correct
      const expectedLabel = Video.formatTime(testPosition); // "1:40"
      expect(dialog?.textContent).toContain(expectedLabel);
    });

    it('displays progress bar with correct width percentage', async () => {
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      state.positionHistory = [];
      state.loadTimePosition = null;

      // Video duration is 7200s, save position at 3600s (50%)
      const halfwayPosition = 3600;
      PositionHistory.save(state, halfwayPosition);

      restorePositionAPI.openDialog();

      const dialog = document.getElementById(DIALOG_ID);
      expect(dialog).not.toBeNull();

      // Find progress fill element (div inside progress bar)
      // The structure is: button > div (progress bar) > div (fill)
      const buttons = dialog?.querySelectorAll('button');
      const progressFill = Array.from(buttons || [])
        .map((btn) => btn.querySelector('div > div') as HTMLElement)
        .find((fill) => fill?.style.width);

      expect(progressFill).toBeDefined();
      expect(progressFill!.style.width).toBe('50%');
    });

    it('displays current time correctly', async () => {
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      // Add a position so dialog shows
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 100);

      // Set video to specific time
      const testTime = 500; // 8:20
      video._setCurrentTime(testTime);

      restorePositionAPI.openDialog();

      // Advance timer to trigger dialog update
      vi.advanceTimersByTime(100);

      const currentTimeEl = document.getElementById(CURRENT_TIME_ID);
      expect(currentTimeEl).not.toBeNull();

      const expectedTimeString = Video.formatTime(testTime); // "8:20"
      expect(currentTimeEl?.textContent).toBe(expectedTimeString);
    });

    it('shows load time position with "load time" label', async () => {
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      // Ensure we have a load time position
      expect(state.loadTimePosition).not.toBeNull();

      restorePositionAPI.openDialog();

      const dialog = document.getElementById(DIALOG_ID);
      expect(dialog?.textContent).toContain('load time');
    });

    it('shows relative time for history positions', async () => {
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      state.positionHistory = [];

      // Save a position
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 200);

      restorePositionAPI.openDialog();

      // Advance time to trigger update
      vi.advanceTimersByTime(100);

      const relativeTimeEls = document.querySelectorAll(`.${RELATIVE_TIME_CLASS}`);
      expect(relativeTimeEls.length).toBeGreaterThan(0);

      // The relative time should show something like "just now" or "Xs ago"
      const relativeText = relativeTimeEls[0]?.textContent;
      expect(relativeText).toMatch(/just now|ago/);
    });
  });

  describe('Keyboard interactions', () => {
    beforeEach(async () => {
      loadFixture('hbomax');
      const playerContainer = document.querySelector('[data-testid="playerContainer"]');
      if (playerContainer) {
        playerContainer.appendChild(video);
      } else {
        document.body.appendChild(video);
      }
    });

    it('closes dialog on ESC key', async () => {
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 100);

      restorePositionAPI.openDialog();
      expect(document.getElementById(DIALOG_ID)).not.toBeNull();

      // Dispatch ESC key
      const escEvent = new KeyboardEvent('keydown', {
        code: 'Escape',
        key: 'Escape',
        bubbles: true,
      });
      const handled = restorePositionAPI.handleDialogKeys(escEvent);

      expect(handled).toBe(true);
      expect(document.getElementById(DIALOG_ID)).toBeNull();
    });

    it('closes dialog on R key', async () => {
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 100);

      restorePositionAPI.openDialog();
      expect(document.getElementById(DIALOG_ID)).not.toBeNull();

      // Dispatch R key
      const rEvent = new KeyboardEvent('keydown', {
        code: 'KeyR',
        key: 'r',
        bubbles: true,
      });
      const handled = restorePositionAPI.handleDialogKeys(rEvent);

      expect(handled).toBe(true);
      expect(document.getElementById(DIALOG_ID)).toBeNull();
    });

    it('selects position on number key press', async () => {
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      state.positionHistory = [];
      state.loadTimePosition = null;

      // Save a position at 100 seconds
      const targetPosition = SEEK_MIN_DIFF_SECONDS + 100;
      PositionHistory.save(state, targetPosition);

      restorePositionAPI.openDialog();

      // Press '0' to select first position
      const keyEvent = new KeyboardEvent('keydown', {
        code: 'Digit0',
        key: '0',
        bubbles: true,
      });
      const handled = restorePositionAPI.handleDialogKeys(keyEvent);

      expect(handled).toBe(true);
      // Dialog should close after selection
      expect(document.getElementById(DIALOG_ID)).toBeNull();
      // Video should seek to the position
      expect(video.currentTime).toBe(targetPosition);
    });

    it('does NOT close dialog on modifier + key', async () => {
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 100);

      restorePositionAPI.openDialog();
      expect(document.getElementById(DIALOG_ID)).not.toBeNull();

      // Dispatch Cmd+R (should not close)
      const cmdREvent = new KeyboardEvent('keydown', {
        code: 'KeyR',
        key: 'r',
        metaKey: true,
        bubbles: true,
      });
      const handled = restorePositionAPI.handleDialogKeys(cmdREvent);

      expect(handled).toBe(false);
      expect(document.getElementById(DIALOG_ID)).not.toBeNull();
    });
  });

  describe('Full integration flow', () => {
    beforeEach(async () => {
      loadFixture('hbomax');
      const playerContainer = document.querySelector('[data-testid="playerContainer"]');
      if (playerContainer) {
        playerContainer.appendChild(video);
      } else {
        document.body.appendChild(video);
      }
    });

    it('seek -> save -> dialog -> restore cycle', async () => {
      // 1. Initialize and wait for ready
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      const augmentedVideo = getVideoElement() as StreamKeysVideoElement;
      const loadTimePosition = state.loadTimePosition;
      expect(loadTimePosition).not.toBeNull();

      // 2. Move to a position far from load time and set stable time
      const preSeekPosition = loadTimePosition! + SEEK_MIN_DIFF_SECONDS + 100;
      video._setCurrentTime(preSeekPosition);
      augmentedVideo._streamKeysStableTime = preSeekPosition;
      augmentedVideo._streamKeysLastKnownTime = preSeekPosition;

      // 3. User seeks to a new position
      const userSeekTarget = preSeekPosition + SEEK_MIN_DIFF_SECONDS + 500;
      simulateSeek(video, userSeekTarget);

      // 4. Verify position was saved
      expect(state.positionHistory.length).toBeGreaterThan(0);

      // 5. Wait for debounce and seek again
      vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);
      augmentedVideo._streamKeysStableTime = userSeekTarget;
      augmentedVideo._streamKeysLastKnownTime = userSeekTarget;
      const secondSeekTarget = userSeekTarget + SEEK_MIN_DIFF_SECONDS + 200;
      simulateSeek(video, secondSeekTarget);

      // 6. Open dialog
      restorePositionAPI.openDialog();
      const dialog = document.getElementById(DIALOG_ID);
      expect(dialog).not.toBeNull();

      // 7. Verify dialog shows the positions
      const positions = PositionHistory.getPositions(state);
      expect(positions.length).toBeGreaterThan(0);

      // 8. Press '0' to restore to first position (load time)
      const firstPosition = positions[0];
      const keyEvent = new KeyboardEvent('keydown', {
        code: 'Digit0',
        key: '0',
        bubbles: true,
      });
      restorePositionAPI.handleDialogKeys(keyEvent);

      // 9. Verify video was restored
      expect(video.currentTime).toBe(firstPosition.time);
      expect(document.getElementById(DIALOG_ID)).toBeNull();
    });

    it('toggle dialog with R key', async () => {
      await initAndWaitForReady();

      const state = restorePositionAPI.getState();
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 100);

      // Open dialog
      restorePositionAPI.openDialog();
      expect(restorePositionAPI.isDialogOpen()).toBe(true);

      // Close with R key
      const closeEvent = new KeyboardEvent('keydown', {
        code: 'KeyR',
        key: 'r',
        bubbles: true,
      });
      restorePositionAPI.handleDialogKeys(closeEvent);
      expect(restorePositionAPI.isDialogOpen()).toBe(false);
    });
  });
});
