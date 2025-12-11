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
 * Extended mock video element with controllable properties
 */
export interface MockVideoElement extends HTMLVideoElement {
  _setCurrentTime: (time: number) => void;
  _setSeeking: (seeking: boolean) => void;
  _setDuration: (duration: number) => void;
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

