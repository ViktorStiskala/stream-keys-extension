/**
 * Integration tests for Restore Position feature.
 *
 * Tests the full feature with real DOM fixtures and simulated video events:
 * - Position History tracking with video events
 * - Restore Dialog UI rendering and behavior
 * - Keyboard interactions
 * - Full integration flow (seek -> save -> dialog -> restore)
 *
 * For timing-specific tests (stable time, service-specific behavior),
 * see timing.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setupTestContext,
  cleanupTestContext,
  initAndWaitForReady,
  loadFixture,
  simulateSeek,
  PositionHistory,
  RestorePosition,
  Video,
  SEEK_MIN_DIFF_SECONDS,
  SEEK_DEBOUNCE_MS,
  LOAD_TIME_CAPTURE_DELAY_MS,
  DIALOG_ID,
  CURRENT_TIME_ID,
  RELATIVE_TIME_CLASS,
  type TestContext,
  type StreamKeysVideoElement,
} from './test-utils';

// Mock Settings module
vi.mock('@/core/settings', () => ({
  Settings: {
    isPositionHistoryEnabled: vi.fn(() => true),
    getSubtitlePreferences: vi.fn(() => ['English']),
  },
}));

describe('Restore Position Integration', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = setupTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  describe('Position History with real video events', () => {
    it('captures resumed position as load time (not initial 0:00)', async () => {
      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

      // Video loads at 0:00 initially
      ctx.video._setCurrentTime(0);
      ctx.video.dispatchEvent(new Event('canplay'));

      // Player auto-resumes to saved position (simulating streaming service behavior)
      const resumePosition = SEEK_MIN_DIFF_SECONDS + 100; // 115 seconds
      simulateSeek(ctx.video, resumePosition);

      // Wait for load time capture delay
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + 100);

      const state = ctx.restorePositionAPI.getState();
      // Load time should be the resumed position, not 0
      expect(state.loadTimePosition).toBe(resumePosition);
    });

    it('does NOT capture load time if position is below threshold', async () => {
      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

      // Video stays at position below threshold
      ctx.video._setCurrentTime(SEEK_MIN_DIFF_SECONDS - 5);
      ctx.video.dispatchEvent(new Event('canplay'));

      // Wait for load time capture delay
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + 100);

      const state = ctx.restorePositionAPI.getState();
      expect(state.loadTimePosition).toBeNull();
    });

    it('does NOT save position during initial resume seek (readyForTracking = false)', async () => {
      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

      // Video loads at 0:00
      ctx.video._setCurrentTime(0);
      ctx.video.dispatchEvent(new Event('canplay'));

      // Player auto-resumes - this should NOT save to history
      const resumePosition = SEEK_MIN_DIFF_SECONDS + 100;
      simulateSeek(ctx.video, resumePosition);

      const state = ctx.restorePositionAPI.getState();
      // No positions should be in history (initial seek is not tracked)
      expect(state.positionHistory).toHaveLength(0);
    });

    it('saves position on seeking event when ready for tracking', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;

      // Verify video is properly set up
      expect(augmentedVideo._streamKeysReadyForTracking).toBe(true);
      expect(augmentedVideo._streamKeysGetStableTime).toBeDefined();

      // First, advance video time away from load time position
      // (positions too close to load time are blocked)
      const loadTime = state.loadTimePosition!;
      const preSeekPosition = loadTime + SEEK_MIN_DIFF_SECONDS + 50;
      ctx.video._setCurrentTime(preSeekPosition);

      // Set stable time to current position (this is what RAF loop does)
      augmentedVideo._streamKeysStableTime = preSeekPosition;
      augmentedVideo._streamKeysLastKnownTime = preSeekPosition;

      // Verify stable time getter works
      const stableTime = augmentedVideo._streamKeysGetStableTime?.();
      expect(stableTime).toBe(preSeekPosition);

      // User initiates seek to a new position
      const newPosition = preSeekPosition + SEEK_MIN_DIFF_SECONDS + 100;
      simulateSeek(ctx.video, newPosition);

      // The pre-seek position should be saved
      expect(state.positionHistory.length).toBeGreaterThanOrEqual(1);
      expect(state.positionHistory[0].time).toBe(preSeekPosition);
    });

    it('debounces rapid keyboard/button seeks (but not timeline seeks)', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;

      // Clear history for clean test
      state.positionHistory = [];

      // Start from a position that's far from load time
      const loadTime = state.loadTimePosition!;
      const startPosition = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
      ctx.video._setCurrentTime(startPosition);
      augmentedVideo._streamKeysStableTime = startPosition;
      augmentedVideo._streamKeysLastKnownTime = startPosition;

      // First keyboard seek - should save the start position
      ctx.restorePositionAPI!.setKeyboardSeek(true);
      ctx.restorePositionAPI!.recordBeforeSeek(startPosition);
      ctx.restorePositionAPI!.setKeyboardSeek(false);
      expect(state.positionHistory.length).toBe(1);
      expect(state.positionHistory[0].time).toBe(startPosition);

      // Rapid keyboard seeks within debounce window - should NOT save additional entries
      const position2 = startPosition + SEEK_MIN_DIFF_SECONDS + 50;
      augmentedVideo._streamKeysStableTime = position2;
      vi.advanceTimersByTime(1000); // Still within 5s window

      ctx.restorePositionAPI!.setKeyboardSeek(true);
      ctx.restorePositionAPI!.recordBeforeSeek(position2);
      ctx.restorePositionAPI!.setKeyboardSeek(false);

      // Should still have only 1 entry (second was debounced)
      expect(state.positionHistory.length).toBe(1);

      // Wait for debounce to expire
      vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);

      // New keyboard seek should now save
      const position3 = position2 + SEEK_MIN_DIFF_SECONDS + 50;
      augmentedVideo._streamKeysStableTime = position3;

      ctx.restorePositionAPI!.setKeyboardSeek(true);
      ctx.restorePositionAPI!.recordBeforeSeek(position3);
      ctx.restorePositionAPI!.setKeyboardSeek(false);

      expect(state.positionHistory.length).toBe(2);
      expect(state.positionHistory[1].time).toBe(position3);
    });

    it('timeline seeks are NOT debounced (each click saves)', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;

      // Clear history for clean test
      state.positionHistory = [];

      // Start from a position that's far from load time
      const loadTime = state.loadTimePosition!;
      const startPosition = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
      ctx.video._setCurrentTime(startPosition);
      augmentedVideo._streamKeysStableTime = startPosition;
      augmentedVideo._streamKeysLastKnownTime = startPosition;

      // First timeline seek
      const position1 = startPosition + SEEK_MIN_DIFF_SECONDS + 50;
      simulateSeek(ctx.video, position1);
      expect(state.positionHistory.length).toBe(1);

      // Update stable time
      augmentedVideo._streamKeysStableTime = position1;
      augmentedVideo._streamKeysLastKnownTime = position1;

      // Second timeline seek 1s later - should STILL save (no debounce for timeline)
      vi.advanceTimersByTime(1000);
      const position2 = position1 + SEEK_MIN_DIFF_SECONDS + 50;
      simulateSeek(ctx.video, position2);

      // Both positions should be saved
      expect(state.positionHistory.length).toBe(2);
      expect(state.positionHistory[0].time).toBe(startPosition);
      expect(state.positionHistory[1].time).toBe(position1);
    });

    it('keyboard seek uses recordBeforeSeek and sets flag correctly', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      const currentPosition = ctx.video.currentTime;

      // Simulate keyboard seek flow
      ctx.restorePositionAPI!.setKeyboardSeek(true);
      expect(state.isKeyboardOrButtonSeek).toBe(true);

      // Record position before seek
      ctx.restorePositionAPI!.recordBeforeSeek(currentPosition);

      // The flag should still be true
      expect(state.isKeyboardOrButtonSeek).toBe(true);

      // Reset flag (as would happen on seeked event)
      ctx.restorePositionAPI!.setKeyboardSeek(false);
      expect(state.isKeyboardOrButtonSeek).toBe(false);
    });
  });

  describe('Restore Dialog UI', () => {
    beforeEach(async () => {
      loadFixture('hbomax');
      // Re-append video to the fixture
      const playerContainer = document.querySelector('[data-testid="playerContainer"]');
      if (playerContainer) {
        playerContainer.appendChild(ctx.video);
      } else {
        document.body.appendChild(ctx.video);
      }
    });

    it('dialog appears when openDialog is called', async () => {
      await initAndWaitForReady(ctx);

      // Save a position so dialog has something to show
      const state = ctx.restorePositionAPI!.getState();
      const position = SEEK_MIN_DIFF_SECONDS + 200;
      PositionHistory.save(state, position);

      // Open dialog
      ctx.restorePositionAPI!.openDialog();

      const dialog = document.getElementById(DIALOG_ID);
      expect(dialog).not.toBeNull();
    });

    it('dialog does NOT appear when no positions are saved', async () => {
      await initAndWaitForReady(ctx);

      // Clear any positions
      const state = ctx.restorePositionAPI!.getState();
      state.loadTimePosition = null;
      state.positionHistory = [];

      // Try to open dialog
      ctx.restorePositionAPI!.openDialog();

      const dialog = document.getElementById(DIALOG_ID);
      expect(dialog).toBeNull();
    });

    it('displays correct number of position entries', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      // Save positions far enough apart
      const basePosition = SEEK_MIN_DIFF_SECONDS + 100;
      PositionHistory.save(state, basePosition);
      vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1);
      PositionHistory.save(state, basePosition + SEEK_MIN_DIFF_SECONDS + 50);

      // Should have load time + 2 saved positions
      const expectedCount =
        (state.loadTimePosition !== null ? 1 : 0) + state.positionHistory.length;

      ctx.restorePositionAPI!.openDialog();

      const dialog = document.getElementById(DIALOG_ID);
      const positionButtons = dialog?.querySelectorAll('button');
      // Subtract 1 for the close button
      const positionEntryCount = (positionButtons?.length ?? 1) - 1;

      expect(positionEntryCount).toBe(expectedCount);
    });

    it('displays correct time labels for positions', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      // Clear existing and add specific positions
      state.positionHistory = [];
      state.loadTimePosition = null;

      // Save position at exactly 100 seconds (1:40)
      const testPosition = 100;
      PositionHistory.save(state, testPosition);

      ctx.restorePositionAPI!.openDialog();

      const dialog = document.getElementById(DIALOG_ID);
      expect(dialog).not.toBeNull();

      // Check that the time label is correct
      const expectedLabel = Video.formatTime(testPosition); // "1:40"
      expect(dialog?.textContent).toContain(expectedLabel);
    });

    it('displays progress bar with correct width percentage', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      state.positionHistory = [];
      state.loadTimePosition = null;

      // Video duration is 7200s, save position at 3600s (50%)
      const halfwayPosition = 3600;
      PositionHistory.save(state, halfwayPosition);

      ctx.restorePositionAPI!.openDialog();

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
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      // Add a position so dialog shows
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 100);

      // Set video to specific time
      const testTime = 500; // 8:20
      ctx.video._setCurrentTime(testTime);

      ctx.restorePositionAPI!.openDialog();

      // Advance timer to trigger dialog update
      vi.advanceTimersByTime(100);

      const currentTimeEl = document.getElementById(CURRENT_TIME_ID);
      expect(currentTimeEl).not.toBeNull();

      const expectedTimeString = Video.formatTime(testTime); // "8:20"
      expect(currentTimeEl?.textContent).toBe(expectedTimeString);
    });

    /**
     * Regression test for issue where dialog shows 0:00 when _streamKeysGetPlaybackTime
     * returns null (e.g., Disney+ with hidden controls).
     *
     * Bug: Dialog used only _streamKeysGetPlaybackTime ?? 0, ignoring _streamKeysLastKnownTime.
     * For Disney+, when controls are hidden, the progress bar is not accessible,
     * so getPlaybackTime returns null, and video.currentTime is buffer-relative (~0s).
     * Fix: Added _streamKeysGetDisplayTime() method with fallback to _streamKeysLastKnownTime.
     */
    it('uses _streamKeysGetDisplayTime which falls back to _streamKeysLastKnownTime (regression)', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      // Add a position so dialog shows
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 100);

      // Simulate Disney+ scenario:
      // - _streamKeysGetPlaybackTime returns null (controls hidden)
      // - video.currentTime returns a small buffer-relative value
      // - _streamKeysLastKnownTime has the real playback time
      const realPlaybackTime = 1800; // 30:00
      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;

      // Set last known time (captured when controls were visible)
      augmentedVideo._streamKeysLastKnownTime = realPlaybackTime;

      // Make _streamKeysGetPlaybackTime return null (simulating hidden controls)
      augmentedVideo._streamKeysGetPlaybackTime = () => null;

      // Update _streamKeysGetDisplayTime to use the fallback (since we modified _streamKeysGetPlaybackTime)
      augmentedVideo._streamKeysGetDisplayTime = () =>
        augmentedVideo._streamKeysGetPlaybackTime?.() ??
        augmentedVideo._streamKeysLastKnownTime ??
        0;

      // video.currentTime is buffer-relative (small value)
      ctx.video._setCurrentTime(5);

      ctx.restorePositionAPI!.openDialog();

      // Advance timer to trigger dialog update
      vi.advanceTimersByTime(100);

      const currentTimeEl = document.getElementById(CURRENT_TIME_ID);
      expect(currentTimeEl).not.toBeNull();

      // Should show the last known time (30:00), NOT buffer time (0:05) or 0:00
      const expectedTimeString = Video.formatTime(realPlaybackTime); // "30:00"
      expect(currentTimeEl?.textContent).toBe(expectedTimeString);
    });

    it('shows load time position with "load time" label', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      // Ensure we have a load time position
      expect(state.loadTimePosition).not.toBeNull();

      ctx.restorePositionAPI!.openDialog();

      const dialog = document.getElementById(DIALOG_ID);
      expect(dialog?.textContent).toContain('load time');
    });

    it('shows relative time for history positions', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      state.positionHistory = [];

      // Save a position
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 200);

      ctx.restorePositionAPI!.openDialog();

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
        playerContainer.appendChild(ctx.video);
      } else {
        document.body.appendChild(ctx.video);
      }
    });

    it('closes dialog on ESC key', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 100);

      ctx.restorePositionAPI!.openDialog();
      expect(document.getElementById(DIALOG_ID)).not.toBeNull();

      // Dispatch ESC key
      const escEvent = new KeyboardEvent('keydown', {
        code: 'Escape',
        key: 'Escape',
        bubbles: true,
      });
      const handled = ctx.restorePositionAPI!.handleDialogKeys(escEvent);

      expect(handled).toBe(true);
      expect(document.getElementById(DIALOG_ID)).toBeNull();
    });

    it('closes dialog on R key', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 100);

      ctx.restorePositionAPI!.openDialog();
      expect(document.getElementById(DIALOG_ID)).not.toBeNull();

      // Dispatch R key
      const rEvent = new KeyboardEvent('keydown', {
        code: 'KeyR',
        key: 'r',
        bubbles: true,
      });
      const handled = ctx.restorePositionAPI!.handleDialogKeys(rEvent);

      expect(handled).toBe(true);
      expect(document.getElementById(DIALOG_ID)).toBeNull();
    });

    it('selects position on number key press', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      state.positionHistory = [];
      state.loadTimePosition = null;

      // Save a position at 100 seconds
      const targetPosition = SEEK_MIN_DIFF_SECONDS + 100;
      PositionHistory.save(state, targetPosition);

      ctx.restorePositionAPI!.openDialog();

      // Press '1' to select first history position
      // Key 0 is reserved for load time, history starts at 1 (when no user saved position)
      const keyEvent = new KeyboardEvent('keydown', {
        code: 'Digit1',
        key: '1',
        bubbles: true,
      });
      const handled = ctx.restorePositionAPI!.handleDialogKeys(keyEvent);

      expect(handled).toBe(true);
      // Dialog should close after selection
      expect(document.getElementById(DIALOG_ID)).toBeNull();
      // Video should seek to the position
      expect(ctx.video.currentTime).toBe(targetPosition);
    });

    it('does NOT close dialog on modifier + key', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 100);

      ctx.restorePositionAPI!.openDialog();
      expect(document.getElementById(DIALOG_ID)).not.toBeNull();

      // Dispatch Cmd+R (should not close)
      const cmdREvent = new KeyboardEvent('keydown', {
        code: 'KeyR',
        key: 'r',
        metaKey: true,
        bubbles: true,
      });
      const handled = ctx.restorePositionAPI!.handleDialogKeys(cmdREvent);

      expect(handled).toBe(false);
      expect(document.getElementById(DIALOG_ID)).not.toBeNull();
    });
  });

  describe('Full integration flow', () => {
    beforeEach(async () => {
      loadFixture('hbomax');
      const playerContainer = document.querySelector('[data-testid="playerContainer"]');
      if (playerContainer) {
        playerContainer.appendChild(ctx.video);
      } else {
        document.body.appendChild(ctx.video);
      }
    });

    it('seek -> save -> dialog -> restore cycle', async () => {
      // 1. Initialize and wait for ready
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;
      const loadTimePosition = state.loadTimePosition;
      expect(loadTimePosition).not.toBeNull();

      // 2. Move to a position far from load time and set stable time
      const preSeekPosition = loadTimePosition! + SEEK_MIN_DIFF_SECONDS + 100;
      ctx.video._setCurrentTime(preSeekPosition);
      augmentedVideo._streamKeysStableTime = preSeekPosition;
      augmentedVideo._streamKeysLastKnownTime = preSeekPosition;

      // 3. User seeks to a new position
      const userSeekTarget = preSeekPosition + SEEK_MIN_DIFF_SECONDS + 500;
      simulateSeek(ctx.video, userSeekTarget);

      // 4. Verify position was saved
      expect(state.positionHistory.length).toBeGreaterThan(0);

      // 5. Wait for debounce and seek again
      vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);
      augmentedVideo._streamKeysStableTime = userSeekTarget;
      augmentedVideo._streamKeysLastKnownTime = userSeekTarget;
      const secondSeekTarget = userSeekTarget + SEEK_MIN_DIFF_SECONDS + 200;
      simulateSeek(ctx.video, secondSeekTarget);

      // 6. Open dialog
      ctx.restorePositionAPI!.openDialog();
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
      ctx.restorePositionAPI!.handleDialogKeys(keyEvent);

      // 9. Verify video was restored
      expect(ctx.video.currentTime).toBe(firstPosition.time);
      expect(document.getElementById(DIALOG_ID)).toBeNull();
    });

    it('toggle dialog with R key', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      PositionHistory.save(state, SEEK_MIN_DIFF_SECONDS + 100);

      // Open dialog
      ctx.restorePositionAPI!.openDialog();
      expect(ctx.restorePositionAPI!.isDialogOpen()).toBe(true);

      // Close with R key
      const closeEvent = new KeyboardEvent('keydown', {
        code: 'KeyR',
        key: 'r',
        bubbles: true,
      });
      ctx.restorePositionAPI!.handleDialogKeys(closeEvent);
      expect(ctx.restorePositionAPI!.isDialogOpen()).toBe(false);
    });
  });

  describe('Video change detection', () => {
    it('clears position history when video source changes (Disney+ pattern)', async () => {
      await initAndWaitForReady(ctx);

      const state = ctx.restorePositionAPI!.getState();
      const loadTime = state.loadTimePosition!;

      // Save positions far from load time (load time is ~115s)
      // Need to be at least SEEK_MIN_DIFF_SECONDS (15s) apart from load time and each other
      PositionHistory.save(state, loadTime + 50);
      PositionHistory.save(state, loadTime + 100);
      expect(state.positionHistory.length).toBe(2);
      expect(state.loadTimePosition).not.toBeNull();

      // Simulate video source change (like navigating to new video on Disney+)
      // Disney+ reuses the same video element but changes the blob src
      ctx.video.src = 'blob:https://disneyplus.com/new-video-' + Date.now();
      ctx.video.dispatchEvent(new Event('loadedmetadata'));

      // Wait for setup interval to detect the change
      vi.advanceTimersByTime(1100);

      // History from previous video should be cleared
      expect(state.positionHistory.length).toBe(0);

      // Load time position is recaptured for the new video (correct behavior)
      // The same video element is reused, so it recaptures based on current playback
      expect(state.loadTimePosition).not.toBeNull();
    });

    it('clears position history when video element changes (HBO Max pattern)', async () => {
      // HBO Max creates a new video element when navigating to a new video
      // We need a mutable video reference to test this pattern

      // Create first video
      let currentVideo: StreamKeysVideoElement = document.createElement(
        'video'
      ) as unknown as StreamKeysVideoElement;
      currentVideo.src = 'blob:https://play.hbomax.com/video-1';
      Object.defineProperty(currentVideo, 'duration', { value: 7200, writable: true });
      Object.defineProperty(currentVideo, 'readyState', { value: 4, writable: true });
      currentVideo.currentTime = SEEK_MIN_DIFF_SECONDS + 100; // Resume position
      document.body.appendChild(currentVideo);

      // Create getter that returns the mutable currentVideo reference
      const getVideoElement = Video.createGetter({
        getPlayer: () => document.body,
        getVideo: () => currentVideo,
      });

      // Initialize restore position with mutable getter
      const api = RestorePosition.init({ getVideoElement });

      // Simulate video ready
      currentVideo.dispatchEvent(new Event('canplay'));
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + 600);

      const state = api.getState();
      const loadTime = state.loadTimePosition!;

      // Save a position
      PositionHistory.save(state, loadTime + 50);
      expect(state.positionHistory.length).toBe(1);
      expect(state.loadTimePosition).not.toBeNull();

      // HBO Max pattern: Remove old video, create new video element
      const oldVideo = currentVideo;
      oldVideo.remove();

      // Create new video element (HBO Max does this when navigating)
      currentVideo = document.createElement('video') as unknown as StreamKeysVideoElement;
      currentVideo.src = 'blob:https://play.hbomax.com/video-2-different';
      Object.defineProperty(currentVideo, 'duration', { value: 3600, writable: true });
      Object.defineProperty(currentVideo, 'readyState', { value: 4, writable: true });
      currentVideo.currentTime = 60; // New video starts at 1:00
      document.body.appendChild(currentVideo);

      // Wait for setup interval to detect the new video element
      vi.advanceTimersByTime(1100);

      // History from previous video should be cleared
      expect(state.positionHistory.length).toBe(0);

      // Load time position is recaptured for the new video (60s)
      // This is correct behavior - the new video's position is captured
      expect(state.loadTimePosition).toBe(60);

      // Cleanup
      api.cleanup();
      currentVideo.remove();
    });
  });
});
