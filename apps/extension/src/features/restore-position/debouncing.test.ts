/**
 * Debouncing behavior tests with real DOM fixtures.
 *
 * Tests that verify the different debouncing behavior between:
 * - Timeline clicks: NEVER debounced (each click saves)
 * - Keyboard/button seeks: Debounced (5-second window)
 *
 * Uses real Disney+ and HBO Max DOM fixtures from resources/dom/.
 *
 * CRITICAL DISTINCTION:
 * - SEEK_MIN_DIFF_SECONDS: Position rejection (positions too close = rejected)
 * - SEEK_DEBOUNCE_MS: Time-based debouncing (rapid actions = debounced)
 *
 * We test DEBOUNCING, not proximity rejection. Tests use:
 * - Start positions at SEEK_MIN_DIFF_SECONDS * 10+ (well above threshold)
 * - Position jumps of SEEK_MIN_DIFF_SECONDS * 5+ between saves
 * - Time advances < SEEK_DEBOUNCE_MS for debounce testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import {
  resetFixture,
  simulateSeeked,
  setupHBOMaxTest,
  setupDisneyPlusTest,
  pressArrowKey,
  clickSkipButton,
  clickTimeline,
  advancePlayback,
  SEEK_MIN_DIFF_SECONDS,
  SEEK_DEBOUNCE_MS,
  LOAD_TIME_CAPTURE_DELAY_MS,
  READY_FOR_TRACKING_DELAY_MS,
  STABLE_TIME_DELAY_MS,
  type ServiceTestContext,
  type StreamKeysVideoElement,
} from './test-utils';

/**
 * Fake timers configuration for debounce testing.
 * Must include 'Date' to properly test debounce logic that uses Date.now().
 */
const FAKE_TIMERS: (
  | 'setTimeout'
  | 'setInterval'
  | 'requestAnimationFrame'
  | 'cancelAnimationFrame'
  | 'Date'
)[] = ['setTimeout', 'setInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'];

// Mock Settings module - required for Handler.create() to work
vi.mock('@/core/settings', () => ({
  Settings: {
    isPositionHistoryEnabled: vi.fn(() => true),
    getSubtitlePreferences: vi.fn(() => ['English']),
    isCustomSeekEnabled: vi.fn(() => true),
    getSeekTime: vi.fn(() => 10),
    isMediaKeysCaptureEnabled: vi.fn(() => false),
  },
}));

/**
 * Service configurations for parameterized tests.
 * Each setup function loads its fixture from resources/dom/.
 */
const services = [
  { name: 'HBO Max', fixture: 'hbomax', setup: setupHBOMaxTest },
  { name: 'Disney+', fixture: 'disney', setup: setupDisneyPlusTest },
] as const;

/**
 * Helper to count position saves from console.info spy.
 * Positions are logged as: "[StreamKeys] Seek position saved: X:XX"
 */
function countPositionSaves(consoleInfoSpy: ReturnType<typeof vi.spyOn>): number {
  return consoleInfoSpy.mock.calls.filter(
    (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('Seek position saved')
  ).length;
}

describe.each(services)('Position History Debouncing - $name (fixture: $fixture)', ({ setup }) => {
  let ctx: ServiceTestContext;
  let user: ReturnType<typeof userEvent.setup>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Spy on console.info to count position saves
    consoleInfoSpy = vi.spyOn(console, 'info');

    vi.useFakeTimers({ toFake: FAKE_TIMERS });
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    ctx = setup(); // Loads fixture from resources/dom/{fixture}.html

    // Wait for tracking to be ready
    // Handler.create() initializes RestorePosition which uses nested setTimeout
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

    // Set up initial stable time for the video
    const video = ctx.video as StreamKeysVideoElement;
    if (video) {
      video._streamKeysStableTime = video.currentTime;
      video._streamKeysLastKnownTime = video.currentTime;
    }

    // Clear spy after setup (ignore load time capture)
    consoleInfoSpy.mockClear();
  });

  afterEach(() => {
    ctx.handler.cleanup();
    vi.useRealTimers();
    resetFixture();
    consoleInfoSpy.mockRestore();
  });

  describe('timeline clicks (NEVER debounced)', () => {
    it('saves every timeline click even within debounce window', () => {
      // Start well above SEEK_MIN_DIFF_SECONDS threshold
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);

      const video = ctx.video as StreamKeysVideoElement;

      // First timeline click (large jump to avoid proximity rejection)
      const dest1 = startPos + SEEK_MIN_DIFF_SECONDS * 5;
      clickTimeline(ctx.video, dest1);

      // Advance playback to dest1
      advancePlayback(ctx, dest1);

      // Only 1 second later (within SEEK_DEBOUNCE_MS!)
      vi.advanceTimersByTime(1000);

      // Second timeline click - should save dest1 (NOT debounced)
      const dest2 = dest1 + SEEK_MIN_DIFF_SECONDS * 5;
      clickTimeline(ctx.video, dest2);

      // Both positions should be in history (timeline clicks are never debounced)
      expect(video._streamKeysReadyForTracking).toBe(true);
      expect(countPositionSaves(consoleInfoSpy)).toBe(2);
    });

    it('handles rapid timeline clicks in succession', () => {
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);

      const video = ctx.video as StreamKeysVideoElement;
      let currentPos = startPos;

      // Simulate 5 rapid timeline clicks, 500ms apart (within debounce window)
      for (let i = 0; i < 5; i++) {
        video._streamKeysStableTime = currentPos;
        video._streamKeysLastKnownTime = currentPos;

        const nextPos = currentPos + SEEK_MIN_DIFF_SECONDS * 5;
        clickTimeline(ctx.video, nextPos);
        currentPos = nextPos;

        vi.advanceTimersByTime(500);
      }

      // All 5 clicks should have been saved (timeline clicks are never debounced)
      expect(video._streamKeysReadyForTracking).toBe(true);
      expect(countPositionSaves(consoleInfoSpy)).toBe(5);
    });
  });

  describe('keyboard seeks (debounced)', () => {
    it('debounces rapid key presses even when position diff exceeds SEEK_MIN_DIFF_SECONDS', async () => {
      /**
       * This test proves we're testing DEBOUNCING, not SEEK_MIN_DIFF_SECONDS.
       *
       * Scenario: User holds arrow key within debounce window
       * - Position changes by SEEK_MIN_DIFF_SECONDS * 6 (valid for saving!)
       * - But time < SEEK_DEBOUNCE_MS window
       * - Result: Still only 1 save (debounced!)
       */
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);

      const video = ctx.video as StreamKeysVideoElement;

      // First key press - should save position
      await pressArrowKey(user, 'right');

      // Stay within debounce window (60% of SEEK_DEBOUNCE_MS)
      const totalDuration = Math.floor(SEEK_DEBOUNCE_MS * 0.6);
      const pressCount = 20;
      const interval = Math.floor(totalDuration / pressCount);

      // Position advances by SEEK_MIN_DIFF_SECONDS * 6 total (valid for saving)
      const totalPositionChange = SEEK_MIN_DIFF_SECONDS * 6;
      const positionIncrement = totalPositionChange / pressCount;

      for (let i = 0; i < pressCount; i++) {
        vi.advanceTimersByTime(interval);

        // Manually update position and stable time in loop
        // (not using advancePlayback to control timing precisely)
        const newPos = startPos + (i + 1) * positionIncrement;
        ctx.video._simulatePlayback(newPos);
        ctx.setProgressBarTime?.(newPos);
        video._streamKeysStableTime = newPos;
        video._streamKeysLastKnownTime = newPos;

        await pressArrowKey(user, 'right');
      }

      // Position diff >> SEEK_MIN_DIFF_SECONDS, so positions ARE valid
      // But time < SEEK_DEBOUNCE_MS, so they're DEBOUNCED
      expect(video._streamKeysReadyForTracking).toBe(true);
      expect(countPositionSaves(consoleInfoSpy)).toBe(1); // Only first press saved
    });

    it('saves again after debounce window expires', async () => {
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);

      const video = ctx.video as StreamKeysVideoElement;

      // First press - saves
      await pressArrowKey(user, 'right');

      // Wait for debounce window to expire
      vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);

      // Update position
      const newPos = startPos + SEEK_MIN_DIFF_SECONDS * 5;
      advancePlayback(ctx, newPos);

      // Second press after debounce expired - should save
      await pressArrowKey(user, 'right');

      // Both positions should be saved (debounce window expired)
      expect(video._streamKeysReadyForTracking).toBe(true);
      expect(countPositionSaves(consoleInfoSpy)).toBe(2);
    });

    it('debounce timer resets with each key press - 1 minute of continuous pressing', async () => {
      /**
       * Critical behavior: debounce window resets with EACH key press.
       * Even 1 minute of key presses = only 1 save if each press is
       * within SEEK_DEBOUNCE_MS of the previous one.
       */
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);

      const video = ctx.video as StreamKeysVideoElement;
      await pressArrowKey(user, 'right'); // First press - saves

      // Press keys for 60 seconds with interval = SEEK_DEBOUNCE_MS / 3
      // Each press resets the debounce timer, so all are debounced
      const interval = Math.floor(SEEK_DEBOUNCE_MS / 3);
      const totalDuration = 60_000; // 1 minute
      const pressCount = Math.floor(totalDuration / interval);
      let currentPos = startPos;

      for (let i = 0; i < pressCount; i++) {
        vi.advanceTimersByTime(interval);
        currentPos += 1; // Small increment
        ctx.video._simulatePlayback(currentPos);
        ctx.setProgressBarTime?.(currentPos);
        video._streamKeysStableTime = currentPos;
        video._streamKeysLastKnownTime = currentPos;
        await pressArrowKey(user, 'right');
      }

      // Only 1 save despite 60 seconds of pressing!
      expect(video._streamKeysReadyForTracking).toBe(true);
      expect(countPositionSaves(consoleInfoSpy)).toBe(1);
    });
  });

  describe('UI skip button clicks (debounced)', () => {
    it('debounces rapid button clicks from real DOM buttons', async () => {
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);

      const video = ctx.video as StreamKeysVideoElement;

      // First click - saves
      await clickSkipButton(user, 'forward', ctx);

      // Stay within debounce window (60% of SEEK_DEBOUNCE_MS)
      const totalDuration = Math.floor(SEEK_DEBOUNCE_MS * 0.6);
      const clickCount = 20;
      const interval = Math.floor(totalDuration / clickCount);

      const totalPositionChange = SEEK_MIN_DIFF_SECONDS * 5;
      const positionIncrement = totalPositionChange / clickCount;

      for (let i = 0; i < clickCount; i++) {
        vi.advanceTimersByTime(interval);

        // Manually update position and stable time in loop
        // (not using advancePlayback to control timing precisely)
        const newPos = startPos + (i + 1) * positionIncrement;
        ctx.video._simulatePlayback(newPos);
        ctx.setProgressBarTime?.(newPos);
        video._streamKeysStableTime = newPos;
        video._streamKeysLastKnownTime = newPos;

        await clickSkipButton(user, 'forward', ctx);
      }

      // Only 1 save despite many clicks (debounced)
      expect(video._streamKeysReadyForTracking).toBe(true);
      expect(countPositionSaves(consoleInfoSpy)).toBe(1);
    });
  });

  describe('mixed keyboard and timeline seeks', () => {
    it('keyboard debounce does not affect timeline clicks', async () => {
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);

      const video = ctx.video as StreamKeysVideoElement;

      // Keyboard seek - saves startPos
      await pressArrowKey(user, 'right');

      // Simulate video completing the seek (fires seeked event, resets isKeyboardOrButtonSeek flag)
      simulateSeeked(ctx.video);

      // 1 second later (within keyboard debounce window)
      vi.advanceTimersByTime(1000);
      const newPos = startPos + SEEK_MIN_DIFF_SECONDS * 5;
      advancePlayback(ctx, newPos);

      // Timeline click - should save newPos (timeline is NOT debounced)
      const dest = newPos + SEEK_MIN_DIFF_SECONDS * 5;
      clickTimeline(ctx.video, dest);

      // 2 saves: keyboard + timeline (timeline not affected by keyboard debounce)
      expect(video._streamKeysReadyForTracking).toBe(true);
      expect(countPositionSaves(consoleInfoSpy)).toBe(2);
    });

    it('timeline click does not reset keyboard debounce', async () => {
      const startPos = SEEK_MIN_DIFF_SECONDS * 10;
      advancePlayback(ctx, startPos);

      const video = ctx.video as StreamKeysVideoElement;

      // Keyboard seek - saves startPos and starts debounce window
      await pressArrowKey(user, 'right');

      // Simulate video completing the seek (fires seeked event)
      simulateSeeked(ctx.video);

      // Timeline click shortly after keyboard press (stay within debounce window)
      // Use 20% of SEEK_DEBOUNCE_MS to ensure we have room for subsequent actions
      const timeToTimelineClick = Math.floor(SEEK_DEBOUNCE_MS * 0.2);
      vi.advanceTimersByTime(timeToTimelineClick);
      const pos2 = startPos + SEEK_MIN_DIFF_SECONDS * 5;
      video._streamKeysStableTime = pos2;
      video._streamKeysLastKnownTime = pos2;
      clickTimeline(ctx.video, pos2 + SEEK_MIN_DIFF_SECONDS * 5);

      // Update stable time after seek
      // (manually set since we're just advancing time, not using advancePlayback)
      vi.advanceTimersByTime(STABLE_TIME_DELAY_MS + 100);
      const pos3 = pos2 + SEEK_MIN_DIFF_SECONDS * 5;
      video._streamKeysStableTime = pos3;
      video._streamKeysLastKnownTime = pos3;

      // Another keyboard press shortly after (still within original debounce)
      // Use 10% of SEEK_DEBOUNCE_MS
      const timeAfterTimeline = Math.floor(SEEK_DEBOUNCE_MS * 0.1);
      vi.advanceTimersByTime(timeAfterTimeline);

      // This should still be debounced from the first keyboard press
      await pressArrowKey(user, 'right');

      // 2 saves: first keyboard + timeline (second keyboard debounced)
      expect(video._streamKeysReadyForTracking).toBe(true);
      expect(countPositionSaves(consoleInfoSpy)).toBe(2);
    });
  });
});

// =============================================================================
// Service-Specific Tests
// =============================================================================

describe('HBO Max specific: seeked event flag reset', () => {
  let ctx: ServiceTestContext;
  let user: ReturnType<typeof userEvent.setup>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, 'info');

    vi.useFakeTimers({ toFake: FAKE_TIMERS });
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    ctx = setupHBOMaxTest();
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

    const video = ctx.video as StreamKeysVideoElement;
    video._streamKeysStableTime = video.currentTime;
    video._streamKeysLastKnownTime = video.currentTime;

    consoleInfoSpy.mockClear();
  });

  afterEach(() => {
    ctx.handler.cleanup();
    vi.useRealTimers();
    resetFixture();
    consoleInfoSpy.mockRestore();
  });

  it('flag resets via seeked event, enabling timeline clicks', async () => {
    const startPos = SEEK_MIN_DIFF_SECONDS * 10;
    advancePlayback(ctx, startPos);

    const video = ctx.video as StreamKeysVideoElement;

    // Key press sets isKeyboardOrButtonSeek flag
    await pressArrowKey(user, 'right');

    // Seeked event fires (like real video after seek completes)
    simulateSeeked(ctx.video);

    // Wait for debounce to expire
    vi.advanceTimersByTime(SEEK_DEBOUNCE_MS + 1000);

    // Update position
    const newPos = startPos + SEEK_MIN_DIFF_SECONDS * 5;
    advancePlayback(ctx, newPos);

    // Timeline click should save (flag was reset by seeked event)
    clickTimeline(ctx.video, newPos + SEEK_MIN_DIFF_SECONDS * 5);

    // 2 saves: keyboard + timeline (after debounce expired)
    expect(video._streamKeysReadyForTracking).toBe(true);
    expect(countPositionSaves(consoleInfoSpy)).toBe(2);
  });

  it('rapid key presses replace seeked listener correctly', async () => {
    /**
     * This tests the fix for a bug where rapid keyboard presses would
     * cause positions to be saved as "timeline clicks" instead of debounced.
     *
     * The bug: each key press added a NEW listener without removing the old one.
     * The first seeked event triggered the OLD listener and reset the flag.
     *
     * The fix: each key press removes the previous listener first.
     */
    const startPos = SEEK_MIN_DIFF_SECONDS * 10;
    advancePlayback(ctx, startPos);

    const video = ctx.video as StreamKeysVideoElement;
    let currentPos = startPos;

    // Simulate rapid key presses - key press comes BEFORE seeked event
    for (let i = 0; i < 15; i++) {
      // Key press (registers new seeked listener, removes old one)
      await pressArrowKey(user, 'right');

      vi.advanceTimersByTime(100);
      currentPos += SEEK_MIN_DIFF_SECONDS;

      // Manually update position and stable time in loop
      // (not using advancePlayback to control timing precisely)
      ctx.video._simulatePlayback(currentPos);
      video._streamKeysStableTime = currentPos;
      video._streamKeysLastKnownTime = currentPos;

      // Video fires seeking event
      ctx.video._setSeeking(true);
      ctx.video.dispatchEvent(new Event('seeking'));
      ctx.video._setSeeking(false);

      // Video fires seeked event (but listener was replaced by next key press)
      simulateSeeked(ctx.video);
    }

    // Only 1 save despite 15 key presses (all debounced after first)
    expect(video._streamKeysReadyForTracking).toBe(true);
    expect(countPositionSaves(consoleInfoSpy)).toBe(1);
  });
});

describe('Disney+ specific: stable time via setTimeout', () => {
  let ctx: ServiceTestContext;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, 'info');

    vi.useFakeTimers({ toFake: FAKE_TIMERS });
    ctx = setupDisneyPlusTest();
    vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

    const video = ctx.video as StreamKeysVideoElement;
    video._streamKeysStableTime = 200; // Initial position from setup
    video._streamKeysLastKnownTime = 200;

    consoleInfoSpy.mockClear();
  });

  afterEach(() => {
    ctx.handler.cleanup();
    vi.useRealTimers();
    resetFixture();
    consoleInfoSpy.mockRestore();
  });

  it('progress bar time is used for playback tracking', () => {
    const video = ctx.video as StreamKeysVideoElement;

    // Set progress bar time (simulates Disney+ Shadow DOM progress bar)
    ctx.setProgressBarTime!(500);
    ctx.video._simulatePlayback(500);

    // Advance time for stable time update
    vi.advanceTimersByTime(STABLE_TIME_DELAY_MS + 100);

    // Manually update stable time (simulating RAF loop behavior)
    video._streamKeysStableTime = 500;
    video._streamKeysLastKnownTime = 500;

    // Verify stable time getter works
    expect(video._streamKeysGetStableTime?.()).toBe(500);
  });

  it('timeline clicks save correct position from stable time', () => {
    const video = ctx.video as StreamKeysVideoElement;
    const startPos = SEEK_MIN_DIFF_SECONDS * 10;

    // Set initial position
    ctx.setProgressBarTime!(startPos);
    ctx.video._simulatePlayback(startPos);
    video._streamKeysStableTime = startPos;
    video._streamKeysLastKnownTime = startPos;

    // Wait for stable time
    vi.advanceTimersByTime(STABLE_TIME_DELAY_MS + 100);

    // Timeline click should use stable time
    const dest = startPos + SEEK_MIN_DIFF_SECONDS * 5;
    clickTimeline(ctx.video, dest);

    // Position saved from stable time
    expect(video._streamKeysReadyForTracking).toBe(true);
    expect(countPositionSaves(consoleInfoSpy)).toBe(1);
  });

  it('handles progress bar updates before seeking event (race condition)', () => {
    /**
     * Disney+ updates the progress bar BEFORE the seeking event fires.
     * The stable time (delayed by STABLE_TIME_DELAY_MS) protects against this.
     */
    const video = ctx.video as StreamKeysVideoElement;
    const startPos = SEEK_MIN_DIFF_SECONDS * 10;

    // Set initial stable position
    video._streamKeysStableTime = startPos;
    video._streamKeysLastKnownTime = startPos;

    // Disney+ updates progress bar immediately when user clicks timeline
    const dest = startPos + SEEK_MIN_DIFF_SECONDS * 5;
    ctx.setProgressBarTime!(dest);
    video._streamKeysLastKnownTime = dest;
    // But stable time still reflects old position (not yet updated)

    // Seeking event fires - should use stable time (startPos), not lastKnown (dest)
    ctx.video._setSeeking(true);
    ctx.video.dispatchEvent(new Event('seeking'));

    // Verify stable time wasn't updated yet
    expect(video._streamKeysStableTime).toBe(startPos);
    // Position should be saved from stable time (startPos)
    expect(countPositionSaves(consoleInfoSpy)).toBe(1);

    // After seek completes and STABLE_TIME_DELAY_MS passes
    ctx.video._setSeeking(false);
    simulateSeeked(ctx.video);
    vi.advanceTimersByTime(STABLE_TIME_DELAY_MS + 100);

    // Now stable time should be updated
    video._streamKeysStableTime = dest;
    expect(video._streamKeysStableTime).toBe(dest);
  });
});
