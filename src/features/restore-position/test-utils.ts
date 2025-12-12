/**
 * Shared test utilities for Restore Position feature tests.
 * Provides common setup, helpers, and mock configuration.
 */

import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import {
  resetFixture,
  createMockVideo,
  simulateVideoLoad,
  loadFixture,
  attachDisneyShadowDOM,
  type MockVideoElement,
} from '@test';
import { RestorePosition, type RestorePositionAPI } from './index';
import {
  LOAD_TIME_CAPTURE_DELAY_MS,
  READY_FOR_TRACKING_DELAY_MS,
  SEEK_MIN_DIFF_SECONDS,
  STABLE_TIME_DELAY_MS,
} from './history';
import { RestoreDialog } from './dialog';
import { Video } from '@/core/video';
import { Handler } from '@/handlers';
import type { StreamKeysVideoElement } from '@/types';

// Re-export commonly used imports for convenience
export {
  resetFixture,
  createMockVideo,
  simulateSeek,
  simulateVideoLoad,
  loadFixture,
  attachDisneyShadowDOM,
  type MockVideoElement,
} from '@test';
export { RestorePosition, type RestorePositionAPI } from './index';
export {
  PositionHistory,
  SEEK_MIN_DIFF_SECONDS,
  SEEK_DEBOUNCE_MS,
  LOAD_TIME_CAPTURE_DELAY_MS,
  READY_FOR_TRACKING_DELAY_MS,
  STABLE_TIME_DELAY_MS,
} from './history';
export { DIALOG_ID, CURRENT_TIME_ID, RELATIVE_TIME_CLASS, RestoreDialog } from './dialog';
export { Video } from '@/core/video';
export { Handler } from '@/handlers';
export type { StreamKeysVideoElement } from '@/types';

/**
 * Shared test context for restore position tests.
 * Contains video element, API instance, and video getter.
 */
export interface TestContext {
  video: MockVideoElement;
  restorePositionAPI: RestorePositionAPI | null;
  getVideoElement: () => StreamKeysVideoElement | null;
}

/**
 * Create the mock Settings module configuration.
 * Must be called with vi.mock() at the module level.
 */
export function createSettingsMock() {
  return {
    Settings: {
      isPositionHistoryEnabled: vi.fn(() => true),
      getSubtitlePreferences: vi.fn(() => ['English']),
    },
  };
}

/**
 * Set up common test context with video element and getter.
 * Call this in beforeEach to initialize test state.
 */
export function setupTestContext(): TestContext {
  resetFixture();
  vi.useFakeTimers();

  // Create mock video with HBO Max-like setup
  const video = createMockVideo({
    currentTime: 0,
    duration: 7200, // 2 hours
    readyState: 4,
    src: 'blob:https://play.hbomax.com/test',
  });

  // Add video to document body
  document.body.appendChild(video);

  // Create video getter once and reuse
  const getVideoElement = Video.createGetter({
    getPlayer: () => document.body,
    getVideo: () => video,
  });

  return {
    video,
    restorePositionAPI: null,
    getVideoElement,
  };
}

/**
 * Clean up test context after each test.
 * Call this in afterEach.
 */
export function cleanupTestContext(ctx: TestContext): void {
  ctx.restorePositionAPI?.cleanup();
  RestoreDialog.close();
  vi.useRealTimers();
  resetFixture();
}

/**
 * Initialize RestorePosition and wait for ready state.
 *
 * WHAT'S TESTED VS MOCKED:
 * - _streamKeysReadyForTracking: Set by REAL setTimeout code in captureLoadTimeOnce()
 * - _streamKeysStableTime: MANUALLY set - jsdom doesn't support RAF loop
 * - _streamKeysLastKnownTime: MANUALLY set - jsdom doesn't support RAF loop
 *
 * The nested setTimeout in captureLoadTimeOnce() works correctly with vitest's fake timers.
 * vitest handles nested setTimeout with a single advanceTimersByTime() call.
 *
 * The RAF loop that normally updates stable/lastKnown times doesn't run in jsdom,
 * so we must set these values manually. This is acceptable because the tests are
 * focused on the debouncing and save logic, not the RAF behavior.
 */
export async function initAndWaitForReady(ctx: TestContext): Promise<void> {
  ctx.restorePositionAPI = RestorePosition.init({ getVideoElement: ctx.getVideoElement });

  // Simulate realistic video load: starts at 0, then player seeks to resume position
  const resumePosition = SEEK_MIN_DIFF_SECONDS + 100; // e.g., 115 seconds (1:55)
  simulateVideoLoad(ctx.video, resumePosition);

  // Wait for load time capture + readyForTracking delays
  // The real code uses nested setTimeout:
  //   captureLoadTimeOnce -> setTimeout(LOAD_TIME_CAPTURE_DELAY_MS)
  //                       -> setTimeout(READY_FOR_TRACKING_DELAY_MS)
  // vitest handles nested setTimeout correctly - a single advance past both is sufficient
  vi.advanceTimersByTime(LOAD_TIME_CAPTURE_DELAY_MS + READY_FOR_TRACKING_DELAY_MS + 100);

  // MANUAL SETUP: jsdom doesn't properly support requestAnimationFrame
  // In production, the RAF loop in setupVideoTracking() updates these values every frame.
  // We must set them manually to simulate the RAF loop's behavior.
  const augmentedVideo = ctx.getVideoElement() as StreamKeysVideoElement;
  if (augmentedVideo) {
    augmentedVideo._streamKeysStableTime = augmentedVideo.currentTime;
    augmentedVideo._streamKeysLastKnownTime = augmentedVideo.currentTime;
  }
}

// =============================================================================
// Service Test Context and Setup Helpers
// =============================================================================

/**
 * Test context for service-specific tests with real DOM fixtures.
 * Used by setupHBOMaxTest() and setupDisneyPlusTest().
 */
export interface ServiceTestContext {
  name: string;
  video: MockVideoElement;
  player: HTMLElement;
  handler: { cleanup: () => void };
  getSeekButtons: () => { backward: HTMLElement | null; forward: HTMLElement | null };
  /** Disney+ only: update progress bar time */
  setProgressBarTime?: (seconds: number) => void;
  supportsDirectSeek: boolean;
}

/**
 * Set up HBO Max test using real fixture from resources/dom/hbomax.html.
 * Fixture already has buttons with data-testid attributes.
 */
export function setupHBOMaxTest(): ServiceTestContext {
  // Load real fixture from resources/dom/hbomax.html
  loadFixture('hbomax');

  const player = document.querySelector<HTMLElement>('[data-testid="playerContainer"]')!;
  const video = createMockVideo({
    currentTime: 200,
    duration: 7200,
    readyState: 4,
    src: 'blob:https://play.hbomax.com/test',
  });

  // Replace fixture's video with mock
  const existingVideo = player.querySelector('video');
  existingVideo?.replaceWith(video);

  const getSeekButtons = () => ({
    backward: document.querySelector<HTMLElement>(
      'button[data-testid="player-ux-skip-back-button"]'
    ),
    forward: document.querySelector<HTMLElement>(
      'button[data-testid="player-ux-skip-forward-button"]'
    ),
  });

  const handler = Handler.create({
    name: 'HBO Max',
    getPlayer: () => player,
    getVideo: () => video,
    getSeekButtons,
    supportsDirectSeek: true,
    getButton: (code: string) => {
      if (code === 'ArrowLeft') return getSeekButtons().backward;
      if (code === 'ArrowRight') return getSeekButtons().forward;
      return null;
    },
  });

  return { name: 'HBO Max', video, player, handler, getSeekButtons, supportsDirectSeek: true };
}

/**
 * Set up Disney+ test using real fixture from resources/dom/disney.html.
 * Fixture has empty custom elements - attach Shadow DOM after loading.
 */
export function setupDisneyPlusTest(): ServiceTestContext {
  // Load real fixture from resources/dom/disney.html
  loadFixture('disney');

  // Attach Shadow DOM to fixture's empty custom elements
  const { setProgressBarTime } = attachDisneyShadowDOM();

  const player = document.querySelector<HTMLElement>('disney-web-player')!;
  const video = createMockVideo({
    currentTime: 0,
    duration: 7200,
    readyState: 4,
    src: 'blob:https://www.disneyplus.com/test',
  });
  video.classList.add('hive-video');

  // Replace fixture's video with mock
  const existingVideo = player.querySelector('video.hive-video') || player.querySelector('video');
  existingVideo?.replaceWith(video);

  const getSeekButtons = () => ({
    backward:
      document
        .querySelector('quick-rewind')
        ?.shadowRoot?.querySelector<HTMLElement>('info-tooltip button') ?? null,
    forward:
      document
        .querySelector('quick-fast-forward')
        ?.shadowRoot?.querySelector<HTMLElement>('info-tooltip button') ?? null,
  });

  // Disney+ getPlaybackTime reads from progress bar Shadow DOM
  const getPlaybackTime = () => {
    const thumb = document
      .querySelector('progress-bar')
      ?.shadowRoot?.querySelector('.progress-bar__thumb');
    return thumb ? parseInt(thumb.getAttribute('aria-valuenow') || '0', 10) : null;
  };

  const handler = Handler.create({
    name: 'Disney+',
    getPlayer: () => player,
    getVideo: () => video,
    getPlaybackTime,
    getDuration: () => 7200,
    getSeekButtons,
    supportsDirectSeek: false,
    getButton: (code: string) => {
      if (code === 'ArrowLeft') return getSeekButtons().backward;
      if (code === 'ArrowRight') return getSeekButtons().forward;
      return null;
    },
  });

  setProgressBarTime(200);
  return {
    name: 'Disney+',
    video,
    player,
    handler,
    getSeekButtons,
    setProgressBarTime,
    supportsDirectSeek: false,
  };
}

// =============================================================================
// User Action Helpers
// =============================================================================

/**
 * Create a userEvent instance configured for fake timers.
 */
export function createUserEventInstance() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

/**
 * Press arrow key - fires realistic keydown/keypress/keyup sequence.
 */
export async function pressArrowKey(
  user: ReturnType<typeof userEvent.setup>,
  direction: 'left' | 'right'
) {
  const key = direction === 'left' ? '{ArrowLeft}' : '{ArrowRight}';
  await user.keyboard(key);
}

/**
 * Click skip button using pointerdown (matches real handler interception).
 * The handler intercepts pointerdown, not click events.
 */
export async function clickSkipButton(
  user: ReturnType<typeof userEvent.setup>,
  direction: 'backward' | 'forward',
  ctx: ServiceTestContext
) {
  const buttons = ctx.getSeekButtons();
  const button = direction === 'backward' ? buttons.backward : buttons.forward;
  if (button) {
    await user.pointer({ keys: '[MouseLeft>]', target: button });
    await user.pointer({ keys: '[/MouseLeft]', target: button });
  }
}

/**
 * Simulate timeline click (direct seeking, NOT through buttons).
 * This fires the video's seeking/seeked events directly.
 */
export function clickTimeline(video: MockVideoElement, toTime: number) {
  video._setSeeking(true);
  video.dispatchEvent(new Event('seeking'));
  video._setCurrentTime(toTime);
  video._setSeeking(false);
  video.dispatchEvent(new Event('seeked'));
}

/**
 * Advance playback and update stable time values.
 * Updates both video currentTime and Disney+ progress bar if available.
 *
 * NOTE: jsdom doesn't properly support requestAnimationFrame, so the RAF loop
 * in setupVideoTracking() that normally updates _streamKeysStableTime and
 * _streamKeysLastKnownTime doesn't run. We manually set these values to simulate
 * what the RAF loop would do in production.
 */
export function advancePlayback(
  ctx: ServiceTestContext,
  toTime: number,
  advanceMs: number = STABLE_TIME_DELAY_MS + 100
) {
  ctx.video._simulatePlayback(toTime);
  ctx.setProgressBarTime?.(toTime);
  vi.advanceTimersByTime(advanceMs);

  // Manually update stable time values since jsdom doesn't run RAF
  const augmentedVideo = ctx.video as StreamKeysVideoElement;
  augmentedVideo._streamKeysStableTime = toTime;
  augmentedVideo._streamKeysLastKnownTime = toTime;
}
