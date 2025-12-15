import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Load a DOM fixture from resources/dom/ into the document
 */
export function loadFixture(name: 'disney' | 'hbomax'): void {
  const html = readFileSync(resolve(__dirname, `resources/dom/${name}.html`), 'utf-8');
  document.documentElement.innerHTML = html;
}

/**
 * Reset the document to a clean state
 */
export function resetFixture(): void {
  document.documentElement.innerHTML = '';
  document.documentElement.removeAttribute('data-streamkeys-disney');
  document.documentElement.removeAttribute('data-streamkeys-hbomax');
}

/**
 * Create a mock progress-bar element with Shadow DOM for Disney+ tests
 */
export function createMockProgressBar(valuenow?: string, valuemax?: string): HTMLElement {
  const progressBar = document.createElement('progress-bar');

  // Attach shadow DOM
  const shadow = progressBar.attachShadow({ mode: 'open' });

  // Create thumb element
  const thumb = document.createElement('div');
  thumb.className = 'progress-bar__thumb';

  if (valuenow !== undefined) {
    thumb.setAttribute('aria-valuenow', valuenow);
  }
  if (valuemax !== undefined) {
    thumb.setAttribute('aria-valuemax', valuemax);
  }

  shadow.appendChild(thumb);
  document.body.appendChild(progressBar);

  return progressBar;
}

/**
 * Attach Shadow DOM to Disney+ custom elements from the fixture.
 * Call AFTER loadFixture('disney') - the fixture has empty custom elements.
 *
 * The fixture contains:
 * - <quick-rewind class="quick-rewind"></quick-rewind>
 * - <quick-fast-forward class="quick-fast-forward"></quick-fast-forward>
 * - <progress-bar></progress-bar>
 *
 * Real Disney+ has shadowRoot with info-tooltip > button inside control elements.
 */
export function attachDisneyShadowDOM(): {
  backwardButton: HTMLButtonElement;
  forwardButton: HTMLButtonElement;
  setProgressBarTime: (seconds: number) => void;
} {
  // Attach Shadow DOM to quick-rewind
  const quickRewind = document.querySelector('quick-rewind');
  if (quickRewind && !quickRewind.shadowRoot) {
    const shadow = quickRewind.attachShadow({ mode: 'open' });
    const infoTooltip = document.createElement('info-tooltip');
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    infoTooltip.appendChild(button);
    shadow.appendChild(infoTooltip);
  }

  // Attach Shadow DOM to quick-fast-forward
  const quickFastForward = document.querySelector('quick-fast-forward');
  if (quickFastForward && !quickFastForward.shadowRoot) {
    const shadow = quickFastForward.attachShadow({ mode: 'open' });
    const infoTooltip = document.createElement('info-tooltip');
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    infoTooltip.appendChild(button);
    shadow.appendChild(infoTooltip);
  }

  // Attach Shadow DOM to progress-bar
  const progressBar = document.querySelector('progress-bar');
  let thumb: HTMLDivElement | null = null;
  if (progressBar && !progressBar.shadowRoot) {
    const shadow = progressBar.attachShadow({ mode: 'open' });
    thumb = document.createElement('div');
    thumb.className = 'progress-bar__thumb';
    thumb.setAttribute('aria-valuenow', '200');
    thumb.setAttribute('aria-valuemax', '7200');
    shadow.appendChild(thumb);
  } else {
    thumb = progressBar?.shadowRoot?.querySelector('.progress-bar__thumb') ?? null;
  }

  return {
    backwardButton: quickRewind?.shadowRoot?.querySelector(
      'info-tooltip button'
    ) as HTMLButtonElement,
    forwardButton: quickFastForward?.shadowRoot?.querySelector(
      'info-tooltip button'
    ) as HTMLButtonElement,
    setProgressBarTime: (seconds: number) => {
      thumb?.setAttribute('aria-valuenow', String(seconds));
    },
  };
}

/**
 * Extended mock video element with controllable properties
 */
export interface MockVideoElement extends HTMLVideoElement {
  _setCurrentTime: (time: number) => void;
  _setSeeking: (seeking: boolean) => void;
  _setDuration: (duration: number) => void;
  /** Simulate playback - updates currentTime and fires timeupdate */
  _simulatePlayback: (toTime: number) => void;
}

/**
 * Create a mock video element with controllable properties and event dispatching.
 * Simulates real video element behavior for integration testing.
 */
export function createMockVideo(options?: {
  currentTime?: number;
  duration?: number;
  readyState?: number;
  src?: string;
}): MockVideoElement {
  const video = document.createElement('video') as MockVideoElement;
  let _currentTime = options?.currentTime ?? 0;
  let _duration = options?.duration ?? 3600;
  let _seeking = false;
  const _readyState = options?.readyState ?? 4;

  // Override properties with getters/setters
  Object.defineProperty(video, 'currentTime', {
    get: () => _currentTime,
    set: (v: number) => {
      _currentTime = v;
    },
    configurable: true,
  });

  Object.defineProperty(video, 'duration', {
    get: () => _duration,
    configurable: true,
  });

  Object.defineProperty(video, 'seeking', {
    get: () => _seeking,
    configurable: true,
  });

  Object.defineProperty(video, 'readyState', {
    get: () => _readyState,
    configurable: true,
  });

  // Set src if provided
  if (options?.src) {
    video.src = options.src;
  }

  // Helper methods for tests to control internal state
  video._setCurrentTime = (time: number) => {
    _currentTime = time;
  };
  video._setSeeking = (seeking: boolean) => {
    _seeking = seeking;
  };
  video._setDuration = (duration: number) => {
    _duration = duration;
  };
  video._simulatePlayback = (toTime: number) => {
    _currentTime = toTime;
    video.dispatchEvent(new Event('timeupdate'));
  };

  return video;
}

/**
 * Simulate a seek event sequence (seeking -> seeked).
 * Mimics real video player behavior when user seeks.
 */
export function simulateSeek(video: MockVideoElement, toTime: number): void {
  video._setSeeking(true);
  video.dispatchEvent(new Event('seeking'));
  video._setCurrentTime(toTime);
  video._setSeeking(false);
  video.dispatchEvent(new Event('seeked'));
}

/**
 * Simulate just the seeked event (seek completion).
 * Use when the seek was initiated elsewhere (e.g., keyboard handler)
 * and you only need to signal completion.
 */
export function simulateSeeked(video: MockVideoElement): void {
  video.dispatchEvent(new Event('seeked'));
}

/**
 * Simulate the realistic video load sequence:
 * 1. Video loads at 0:00
 * 2. Fires canplay event
 * 3. Player auto-seeks to resume position (like streaming services do)
 * 4. Fires seeking/seeked for the resume
 */
export function simulateVideoLoad(
  video: MockVideoElement,
  resumePosition: number
): void {
  // Initial load at 0:00
  video._setCurrentTime(0);
  video.dispatchEvent(new Event('canplay'));
  video.dispatchEvent(new Event('playing'));

  // Simulate player auto-resume to last position
  if (resumePosition > 0) {
    simulateSeek(video, resumePosition);
  }
}

