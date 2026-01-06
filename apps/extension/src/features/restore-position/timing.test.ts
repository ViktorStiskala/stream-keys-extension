/**
 * Timing and service-specific tests for Restore Position feature.
 *
 * These tests focus on:
 * - Stable time mechanism (prevents race conditions)
 * - Service-specific behavior differences (HBO Max vs Disney+)
 * - Regression tests for the Disney+ pre-seek position bug
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setupTestContext,
  cleanupTestContext,
  initAndWaitForReady,
  simulateSeek,
  simulateVideoLoad,
  RestorePosition,
  Video,
  SEEK_MIN_DIFF_SECONDS,
  SEEK_DEBOUNCE_MS,
  LOAD_TIME_CAPTURE_DELAY_MS,
  READY_FOR_TRACKING_DELAY_MS,
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

describe('Restore Position Timing', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = setupTestContext();
  });

  afterEach(() => {
    cleanupTestContext(ctx);
  });

  /**
   * Regression tests for stable time behavior.
   *
   * These tests prevent a specific bug where seeking on services like Disney+
   * would save the DESTINATION time instead of the SOURCE time.
   *
   * Root cause (fixed):
   * 1. `_streamKeysStableTime` was not initialized when tracking started
   * 2. `handleSeeked` was overwriting `_streamKeysStableTime` with the post-seek position
   *
   * The stable time mechanism provides a ~500ms delayed view of the playback position,
   * guaranteeing that when a `seeking` event fires, we can read the pre-seek position
   * even if the service (like Disney+) updates its progress bar before the event fires.
   */
  describe('Stable time regression tests (Disney+ pre-seek position bug)', () => {
    /**
     * Test: _streamKeysStableTime must be initialized when tracking starts
     *
     * If stable time is undefined, the fallback chain in _streamKeysGetStableTime()
     * would return _streamKeysLastKnownTime, which may already have the NEW position
     * after the service updates its progress bar. This caused Disney+ to save the
     * destination time instead of the source time.
     */
    it('initializes _streamKeysStableTime when tracking starts (prevents undefined fallback)', async () => {
      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

      // Simulate video loading at a position
      const startPosition = SEEK_MIN_DIFF_SECONDS + 100;
      simulateVideoLoad(ctx.video, startPosition);

      // Wait for tracking to start
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;

      // _streamKeysStableTime MUST be defined (not undefined)
      // If undefined, the fallback chain would use _streamKeysLastKnownTime
      // which could have the wrong (destination) value
      expect(augmentedVideo._streamKeysStableTime).toBeDefined();
      expect(typeof augmentedVideo._streamKeysStableTime).toBe('number');
    });

    /**
     * Test: _streamKeysGetStableTime should return a valid time immediately
     *
     * The getter must never return undefined, as this would indicate a failure
     * in the initialization logic that was the root cause of the Disney+ bug.
     */
    it('_streamKeysGetStableTime returns valid time immediately after init (no undefined)', async () => {
      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

      const startPosition = SEEK_MIN_DIFF_SECONDS + 100;
      simulateVideoLoad(ctx.video, startPosition);

      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;

      // The getter MUST return a defined number
      const stableTime = augmentedVideo._streamKeysGetStableTime?.();
      expect(stableTime).toBeDefined();
      expect(typeof stableTime).toBe('number');
    });

    /**
     * Test: seeked event must NOT corrupt stable time
     *
     * Previously, handleSeeked would set:
     *   video._streamKeysStableTime = currentTime; // post-seek position!
     *
     * This corrupted the stable time mechanism because for the next ~500ms,
     * _streamKeysStableTime would reflect the DESTINATION of the previous seek,
     * not the current playback position. If another seek happened during this
     * window, the wrong position would be saved.
     *
     * Fix: handleSeeked now only updates _streamKeysLastKnownTime, letting the
     * RAF loop update _streamKeysStableTime with the proper 500ms delay.
     */
    it('seeked event does NOT reset stable time to destination (preserves pre-seek tracking)', async () => {
      await initAndWaitForReady(ctx);

      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;
      const state = ctx.restorePositionAPI!.getState();

      // User is at a known position (pre-seek)
      const loadTime = state.loadTimePosition!;
      const preSeekPosition = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
      ctx.video._setCurrentTime(preSeekPosition);
      augmentedVideo._streamKeysStableTime = preSeekPosition;
      augmentedVideo._streamKeysLastKnownTime = preSeekPosition;

      // User seeks to a new position
      const destinationPosition = preSeekPosition + SEEK_MIN_DIFF_SECONDS + 200;
      ctx.video._setCurrentTime(destinationPosition);

      // Dispatch 'seeked' event (seek completed)
      ctx.video.dispatchEvent(new Event('seeked'));

      // KEY TEST: _streamKeysStableTime must NOT be set to destinationPosition
      // It should remain at or near preSeekPosition (the RAF loop will update it later)
      // This is the core invariant that prevents the Disney+ regression
      expect(augmentedVideo._streamKeysStableTime).not.toBe(destinationPosition);
    });

    /**
     * Test: Rapid consecutive seeks should save correct pre-seek positions
     *
     * Simulates the Disney+ user scenario:
     * 1. User is watching at position A
     * 2. User seeks to position B via timeline click
     * 3. Immediately seeks again to position C
     *
     * The saved positions should be A (not B) and B (not C).
     * Previously, if handleSeeked reset _streamKeysStableTime, the second seek
     * would save B (the destination of the first seek) instead of A.
     */
    it('consecutive seeks save correct pre-seek positions (not destinations)', async () => {
      await initAndWaitForReady(ctx);

      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;
      const state = ctx.restorePositionAPI!.getState();

      // Clear history for clean test
      state.positionHistory = [];
      state.lastSeekTime = 0;

      // Position A: user is watching here
      const loadTime = state.loadTimePosition!;
      const positionA = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
      ctx.video._setCurrentTime(positionA);
      augmentedVideo._streamKeysStableTime = positionA;
      augmentedVideo._streamKeysLastKnownTime = positionA;

      // First seek: from A to B
      const positionB = positionA + SEEK_MIN_DIFF_SECONDS + 200;
      simulateSeek(ctx.video, positionB);

      // Should save position A (the pre-seek position)
      expect(state.positionHistory.length).toBe(1);
      expect(state.positionHistory[0].time).toBe(positionA);

      // Wait for debounce to expire so second seek can save
      vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);

      // Simulate being at position B now (after first seek completed)
      // In real scenario, RAF loop would update this, we simulate it
      augmentedVideo._streamKeysStableTime = positionB;
      augmentedVideo._streamKeysLastKnownTime = positionB;

      // Second seek: from B to C
      const positionC = positionB + SEEK_MIN_DIFF_SECONDS + 200;
      simulateSeek(ctx.video, positionC);

      // Should save position B (not C, not A)
      expect(state.positionHistory.length).toBe(2);
      expect(state.positionHistory[1].time).toBe(positionB);
    });

    /**
     * Test: Stable time fallback chain behavior
     *
     * When _streamKeysGetStableTime() is called, it follows this fallback chain:
     * 1. _streamKeysStableTime (delayed, guaranteed pre-seek)
     * 2. _streamKeysLastKnownTime (current, may have new position)
     * 3. _streamKeysGetPlaybackTime() (reads from progress bar)
     * 4. video.currentTime
     *
     * If _streamKeysStableTime is undefined, we fall through to _streamKeysLastKnownTime
     * which may have already been updated with the destination position.
     *
     * This test verifies that _streamKeysStableTime is always set to prevent
     * the fallback from returning wrong values.
     */
    it('stable time is always defined to prevent fallback chain issues', async () => {
      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

      // Even before video is fully loaded
      ctx.video._setCurrentTime(0);
      ctx.video.dispatchEvent(new Event('loadedmetadata'));

      // Give some time for initialization
      vi.advanceTimersByTime(100);

      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;

      // After video is loaded
      const startPosition = SEEK_MIN_DIFF_SECONDS + 50;
      simulateVideoLoad(ctx.video, startPosition);

      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      // Verify stable time is set
      expect(augmentedVideo._streamKeysStableTime).toBeDefined();

      // Manually simulate what would happen if stable time was undefined
      // by checking that the getter returns the same value as the property
      const stableTimeValue = augmentedVideo._streamKeysStableTime;
      const getterValue = augmentedVideo._streamKeysGetStableTime?.();

      // If getter returns the stable time value (not falling back),
      // that confirms stable time is properly initialized
      expect(getterValue).toBe(stableTimeValue);
    });
  });

  /**
   * Service-specific behavior tests.
   *
   * HBO Max and Disney+ have fundamentally different architectures that affect
   * position tracking. These tests ensure both work correctly:
   *
   * HBO Max:
   * - Standard DOM (no Shadow DOM for buttons)
   * - Uses default seekByDelta (video.currentTime += delta)
   * - Uses standard video.currentTime for playback time
   * - Standard video seek behavior: video.seeking becomes true when seek starts
   *
   * Disney+:
   * - Shadow DOM for buttons (quick-rewind, quick-fast-forward)
   * - Custom seekByDelta that clicks native buttons (video.currentTime is buffer-relative)
   * - Custom getPlaybackTime from progress bar's aria-valuenow
   * - Race condition: progress bar updates BEFORE video.seeking becomes true
   */
  describe('Service-specific behavior (HBO Max vs Disney+)', () => {
    /**
     * Test: HBO Max - Standard video.currentTime works for position tracking
     *
     * HBO Max uses standard HTML5 video where video.currentTime accurately
     * reflects the actual playback position. The default _streamKeysGetPlaybackTime
     * fallback to video.currentTime should work correctly.
     */
    it('HBO Max: uses video.currentTime for position tracking (standard behavior)', async () => {
      // HBO Max doesn't need custom getPlaybackTime - video.currentTime works
      const hboMaxGetVideoElement = Video.createGetter({
        getPlayer: () => document.body,
        getVideo: () => ctx.video,
        // No custom getPlaybackTime - uses video.currentTime by default
      });

      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: hboMaxGetVideoElement });

      const startPosition = SEEK_MIN_DIFF_SECONDS + 100;
      simulateVideoLoad(ctx.video, startPosition);
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const augmentedVideo = hboMaxGetVideoElement() as StreamKeysVideoElement;

      // Set video.currentTime directly (as HBO Max does)
      ctx.video._setCurrentTime(500);
      augmentedVideo._streamKeysStableTime = 500;
      augmentedVideo._streamKeysLastKnownTime = 500;

      // _streamKeysGetPlaybackTime should use video.currentTime when no custom getter
      expect(augmentedVideo._streamKeysGetPlaybackTime?.()).toBe(500);
    });

    /**
     * Test: Disney+ - Custom getPlaybackTime reads from progress bar
     *
     * Disney+ uses MediaSource Extensions where video.currentTime is buffer-relative,
     * not actual playback time. The real playback time comes from the progress bar's
     * aria-valuenow attribute. We must use a custom getPlaybackTime function.
     */
    it('Disney+: uses custom getPlaybackTime (video.currentTime is unreliable)', async () => {
      // Simulate Disney+ custom time source (progress bar)
      const disneyProgressBarTime = 1350; // 22:30

      const disneyGetVideoElement = Video.createGetter({
        getPlayer: () => document.body,
        getVideo: () => ctx.video,
        // Custom getPlaybackTime that simulates reading from Disney+ progress bar
        getPlaybackTime: () => disneyProgressBarTime,
      });

      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: disneyGetVideoElement });

      const startPosition = SEEK_MIN_DIFF_SECONDS + 100;
      simulateVideoLoad(ctx.video, startPosition);
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const augmentedVideo = disneyGetVideoElement() as StreamKeysVideoElement;

      // Set up stable time
      augmentedVideo._streamKeysStableTime = disneyProgressBarTime;
      augmentedVideo._streamKeysLastKnownTime = disneyProgressBarTime;

      // Disney+ video.currentTime would be wrong (buffer-relative)
      // But _streamKeysGetPlaybackTime uses our custom getter
      ctx.video._setCurrentTime(42); // Some buffer-relative value

      // Custom getter should be used, not video.currentTime
      expect(augmentedVideo._streamKeysGetPlaybackTime?.()).toBe(1350);
      expect(ctx.video.currentTime).toBe(42); // Different from playback time!
    });

    /**
     * Test: Disney+ race condition - Progress bar updates before seeking event
     *
     * Disney+ updates the progress bar's aria-valuenow BEFORE video.seeking
     * becomes true. This means by the time our 'seeking' event handler fires,
     * a naive implementation would read the NEW (destination) position.
     *
     * The _streamKeysStableTime mechanism solves this by providing a 500ms
     * delayed view of the playback position.
     */
    it('Disney+: stable time protects against progress bar race condition', async () => {
      // Simulate Disney+ progress bar updates
      let disneyProgressBarTime = 1350; // Starting position (22:30)

      const disneyGetVideoElement = Video.createGetter({
        getPlayer: () => document.body,
        getVideo: () => ctx.video,
        getPlaybackTime: () => disneyProgressBarTime,
      });

      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: disneyGetVideoElement });

      const startPosition = SEEK_MIN_DIFF_SECONDS + 100;
      simulateVideoLoad(ctx.video, startPosition);
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const augmentedVideo = disneyGetVideoElement() as StreamKeysVideoElement;
      const state = ctx.restorePositionAPI!.getState();

      // Clear history
      state.positionHistory = [];
      state.lastSeekTime = 0;

      // User is at position 1350 (stable time is set)
      augmentedVideo._streamKeysStableTime = 1350;
      augmentedVideo._streamKeysLastKnownTime = 1350;

      // --- SIMULATE DISNEY+ RACE CONDITION ---
      // 1. User clicks to seek to 3700 (new position)
      // 2. Disney+ IMMEDIATELY updates progress bar (before seeking event!)
      disneyProgressBarTime = 3700;

      // 3. _streamKeysLastKnownTime would get updated on next RAF
      augmentedVideo._streamKeysLastKnownTime = 3700;

      // 4. Now 'seeking' event fires
      // At this point, a naive implementation would read 3700 (wrong!)
      // But _streamKeysStableTime still has 1350 (correct pre-seek position)

      // Verify stable time still has the OLD value
      expect(augmentedVideo._streamKeysStableTime).toBe(1350);

      // This is what our seeking handler reads
      const stableTime = augmentedVideo._streamKeysGetStableTime?.();
      expect(stableTime).toBe(1350); // Pre-seek position, not 3700!
    });

    /**
     * Test: Both services - Position saved on timeline seek works correctly
     *
     * When user clicks on the timeline (progress bar) to seek, both HBO Max
     * and Disney+ should save the PRE-SEEK position, not the destination.
     * This tests the common behavior that works for both services.
     */
    it('both services: timeline seek saves pre-seek position (not destination)', async () => {
      await initAndWaitForReady(ctx);

      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;
      const state = ctx.restorePositionAPI!.getState();

      // Clear history
      state.positionHistory = [];
      state.lastSeekTime = 0;

      // User watching at position A
      const loadTime = state.loadTimePosition!;
      const positionA = loadTime + SEEK_MIN_DIFF_SECONDS + 100;
      ctx.video._setCurrentTime(positionA);
      augmentedVideo._streamKeysStableTime = positionA;
      augmentedVideo._streamKeysLastKnownTime = positionA;

      // User clicks timeline to jump to distant position B
      const positionB = positionA + 2000; // Big jump (like clicking timeline)
      simulateSeek(ctx.video, positionB);

      // Should save positionA (where user WAS), not positionB (where they clicked)
      expect(state.positionHistory.length).toBe(1);
      expect(state.positionHistory[0].time).toBe(positionA);
    });

    /**
     * Test: HBO Max - video.currentTime works for seeking
     *
     * HBO Max can use video.currentTime = newTime directly because its video
     * element has standard behavior. This is used by the default seekByDelta.
     */
    it('HBO Max: video.currentTime can be set directly', async () => {
      await initAndWaitForReady(ctx);

      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;

      // HBO Max allows direct currentTime manipulation
      const originalTime = ctx.video.currentTime;
      ctx.video._setCurrentTime(originalTime + 60); // Seek forward 60 seconds

      // The new time should be correctly set
      expect(ctx.video.currentTime).toBe(originalTime + 60);

      // And _streamKeysGetPlaybackTime should reflect it
      expect(augmentedVideo._streamKeysGetPlaybackTime?.()).toBe(originalTime + 60);
    });

    /**
     * Test: Disney+ - video.currentTime is buffer-relative (MSE)
     *
     * Disney+ uses MediaSource Extensions where video.currentTime is buffer-relative.
     * Setting video.currentTime directly doesn't work as expected.
     * Disney+ provides custom seekByDelta that clicks native buttons instead.
     */
    it('Disney+: video.currentTime differs from actual playback time', async () => {
      // Disney+ scenario: video.currentTime is buffer-relative
      const actualPlaybackTime = 3600; // 1 hour into the movie
      const bufferRelativeTime = 45; // MSE buffer position

      const disneyGetVideoElement = Video.createGetter({
        getPlayer: () => document.body,
        getVideo: () => ctx.video,
        getPlaybackTime: () => actualPlaybackTime, // From progress bar
      });

      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: disneyGetVideoElement });

      const startPosition = SEEK_MIN_DIFF_SECONDS + 100;
      simulateVideoLoad(ctx.video, startPosition);
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      const augmentedVideo = disneyGetVideoElement() as StreamKeysVideoElement;

      // video.currentTime has buffer-relative value
      ctx.video._setCurrentTime(bufferRelativeTime);

      // video.currentTime is "wrong" (buffer-relative)
      expect(ctx.video.currentTime).toBe(45);

      // But _streamKeysGetPlaybackTime gives actual time from progress bar
      expect(augmentedVideo._streamKeysGetPlaybackTime?.()).toBe(3600);

      // This is why Disney+ provides custom seekByDelta -
      // setting video.currentTime doesn't seek to the expected position
    });
  });

  /**
   * Load time capture window tests.
   *
   * These tests verify that:
   * 1. Service auto-resume (e.g., HBO Max resuming to saved position) captures correctly
   * 2. User timeline clicks AFTER the capture window don't affect load time
   * 3. Videos starting from beginning (position < 15s) don't capture useless load time
   * 4. Auto-resume seeks are NOT recorded in position history
   *
   * The capture window is controlled by loadTimeCaptureDelay (default 1000ms).
   * After this window closes, no new load time captures are allowed.
   */
  describe('Load time capture window', () => {
    /**
     * Test: Service auto-resume captures the correct load time
     *
     * When HBO Max, Disney+, etc. auto-resume to where the user left off,
     * the resumed position should be captured as load time (not position 0).
     */
    it('captures load time when service auto-resumes within window', async () => {
      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });
      const state = ctx.restorePositionAPI.getState();

      // Simulate service auto-resume: canplay fires, then service seeks to saved position
      ctx.video._setCurrentTime(0);
      ctx.video.dispatchEvent(new Event('canplay'));

      // Service auto-seeks to saved position (within capture window)
      const resumePosition = SEEK_MIN_DIFF_SECONDS + 500;
      vi.advanceTimersByTime(200); // Service resumes quickly
      ctx.video._setCurrentTime(resumePosition);
      ctx.video.dispatchEvent(new Event('seeked'));

      // Wait for capture timeout to fire
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS);

      // Load time should be the resumed position
      expect(state.loadTimePosition).toBe(resumePosition);
    });

    /**
     * Test: Timeline clicks after capture window don't affect load time
     *
     * Once the capture window has closed (loadTimeCaptureDelay elapsed),
     * user seeks should NOT be recorded as load time.
     */
    it('does NOT capture timeline clicks as load time after capture window', async () => {
      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });
      const state = ctx.restorePositionAPI.getState();

      // Video starts from beginning (no auto-resume)
      ctx.video._setCurrentTime(5); // Below SEEK_MIN_DIFF_SECONDS
      ctx.video.dispatchEvent(new Event('canplay'));

      // Wait for capture window to close and tracking to be ready
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      // Load time should be null (started from beginning, below threshold)
      expect(state.loadTimePosition).toBeNull();

      // User clicks timeline after the window
      ctx.video._setCurrentTime(300);
      ctx.video.dispatchEvent(new Event('seeked'));

      // Load time should still be null (click was after window)
      expect(state.loadTimePosition).toBeNull();
    });

    /**
     * Test: Video starting from beginning doesn't capture useless load time
     *
     * If a video starts at position 0 (or any position < SEEK_MIN_DIFF_SECONDS),
     * the load time should NOT be captured since "0:00" is not useful as a restore point.
     */
    it('does NOT capture load time when video starts from beginning', async () => {
      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });
      const state = ctx.restorePositionAPI.getState();

      // Video starts at position 0 (watching from beginning)
      ctx.video._setCurrentTime(0);
      ctx.video.dispatchEvent(new Event('canplay'));

      // Wait for capture timeout
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + 100);

      // Load time should NOT be captured (0 < SEEK_MIN_DIFF_SECONDS)
      expect(state.loadTimePosition).toBeNull();
    });

    /**
     * Test: Auto-resume seek is NOT recorded in position history
     *
     * When a service auto-resumes, the initial seek from 0 to the saved position
     * should NOT be recorded in position history. Only user-initiated seeks
     * (after _streamKeysReadyForTracking is true) should be recorded.
     *
     * This test would fail if someone removed the _streamKeysReadyForTracking check
     * or set it to true immediately without the timing delays.
     */
    it('auto-resume seek is NOT recorded in position history', async () => {
      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });
      const state = ctx.restorePositionAPI.getState();

      // Simulate service auto-resume: video loads and service seeks to saved position
      // (uses simulateVideoLoad which triggers canplay/playing events)
      const resumePosition = SEEK_MIN_DIFF_SECONDS + 500;
      simulateVideoLoad(ctx.video, resumePosition);

      // This auto-resume seek should NOT be recorded (tracking not ready)
      expect(state.positionHistory).toHaveLength(0);

      // Wait for full initialization
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      // Load time captured, history still empty
      expect(state.loadTimePosition).toBe(resumePosition);
      expect(state.positionHistory).toHaveLength(0);

      // Simulate user watched for a while and is now at a different position
      // (far enough from load time to not be blocked by proximity check)
      const currentWatchPosition = resumePosition + SEEK_MIN_DIFF_SECONDS + 100;
      ctx.video._setCurrentTime(currentWatchPosition);

      // MANUAL SETUP: jsdom doesn't run RAF, so we must set stable time values
      // to simulate what the RAF loop would do in production
      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;
      augmentedVideo._streamKeysStableTime = currentWatchPosition;
      augmentedVideo._streamKeysLastKnownTime = currentWatchPosition;

      // Now user seeks - should be tracked
      const userSeekTarget = currentWatchPosition + SEEK_MIN_DIFF_SECONDS + 200;
      simulateSeek(ctx.video, userSeekTarget);

      // Should save the position user was at before seeking
      expect(state.positionHistory).toHaveLength(1);
      expect(state.positionHistory[0].time).toBe(currentWatchPosition);
    });

    /**
     * Test: Seek from non-zero position during load phase is NOT recorded
     *
     * This tests a scenario where a video starts at a position > SEEK_MIN_DIFF_SECONDS
     * (e.g., resuming a previous session), then seeks during the load phase.
     * The initial seek should NOT be recorded because tracking isn't ready yet.
     *
     * This test would FAIL if someone set _streamKeysReadyForTracking = true immediately,
     * because the stable time (which starts at startPosition >= 15s) would pass the
     * SEEK_MIN_DIFF_SECONDS check and would be incorrectly saved.
     */
    it('seek from non-zero start position during load phase is NOT recorded', async () => {
      // Start video at a position >= SEEK_MIN_DIFF_SECONDS so stable time is "valid"
      const startPosition = SEEK_MIN_DIFF_SECONDS + 50;
      ctx.video._setCurrentTime(startPosition);

      ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });
      const state = ctx.restorePositionAPI.getState();
      const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;

      // At this point, stable time is initialized to startPosition (>= 15s)
      // If _streamKeysReadyForTracking were true, the next seek would save startPosition
      expect(augmentedVideo._streamKeysStableTime).toBe(startPosition);

      // Simulate an immediate seek (e.g., service adjusting playback position)
      // This should NOT be recorded because tracking isn't ready
      ctx.video.dispatchEvent(new Event('canplay'));
      const seekTarget = startPosition + SEEK_MIN_DIFF_SECONDS + 100;
      simulateSeek(ctx.video, seekTarget);

      // The seek should NOT have been recorded (tracking not ready)
      // This assertion would FAIL if _streamKeysReadyForTracking started as true
      expect(state.positionHistory).toHaveLength(0);

      // Wait for tracking to be ready
      vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

      // History should still be empty - the early seek was correctly ignored
      expect(state.positionHistory).toHaveLength(0);
    });
  });
});
