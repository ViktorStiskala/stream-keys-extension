import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DisneyHandler } from './disney';
import { loadFixture, resetFixture, createMockProgressBar } from '@test';

describe('DisneyHandler', () => {
  beforeEach(() => {
    resetFixture();
    DisneyHandler._test.resetCache();
  });

  afterEach(() => {
    resetFixture();
  });

  describe('with Disney+ DOM fixture', () => {
    beforeEach(() => {
      loadFixture('disney');
    });

    describe('getPlayer', () => {
      it('returns disney-web-player element', () => {
        const player = DisneyHandler._test.getPlayer();

        expect(player).not.toBeNull();
        expect(player?.tagName.toLowerCase()).toBe('disney-web-player');
      });

      it('returns element with tabindex="-1"', () => {
        const player = DisneyHandler._test.getPlayer();

        expect(player?.getAttribute('tabindex')).toBe('-1');
      });
    });

    describe('getVideo', () => {
      it('returns video element with hive-video class', () => {
        const video = DisneyHandler._test.getVideo();

        expect(video).not.toBeNull();
        expect(video?.classList.contains('hive-video')).toBe(true);
      });

      it('returns null when no player exists', () => {
        resetFixture();

        const video = DisneyHandler._test.getVideo();
        expect(video).toBeNull();
      });
    });

    describe('subtitles.getAvailable', () => {
      it('returns non-empty list of available subtitles', () => {
        const available = DisneyHandler._test.subtitles.getAvailable();

        expect(available.length).toBeGreaterThan(0);
      });

      it('excludes the off option (subtitleTrackPicker-off)', () => {
        const available = DisneyHandler._test.subtitles.getAvailable();

        // The off option has inputId 'subtitleTrackPicker-off' - verify it's excluded
        const hasOff = available.some((item) => item.inputId === 'subtitleTrackPicker-off');
        expect(hasOff).toBe(false);
      });

      it('each item has required properties: label, element, and inputId', () => {
        const available = DisneyHandler._test.subtitles.getAvailable();

        available.forEach((item) => {
          expect(item.label).toBeTruthy();
          expect(item.element).toBeInstanceOf(HTMLElement);
          expect(item.inputId).toBeTruthy();
        });
      });
    });

    describe('subtitles.getCurrentState', () => {
      it('returns false when off option is checked (subtitles off)', () => {
        // In fixture, subtitleTrackPicker-off is checked
        const state = DisneyHandler._test.subtitles.getCurrentState();
        expect(state).toBe(false);
      });

      it('returns true when another option is checked (subtitles on)', () => {
        // Uncheck the off option and check another
        const offRadio = document.querySelector<HTMLInputElement>('#subtitleTrackPicker-off');
        const englishRadio = document.querySelector<HTMLInputElement>('#subtitleTrackPicker-5');

        if (offRadio && englishRadio) {
          offRadio.checked = false;
          englishRadio.checked = true;
        }

        const state = DisneyHandler._test.subtitles.getCurrentState();
        expect(state).toBe(true);
      });
    });
  });

  /**
   * Fullscreen mode tests using disney_full.html fixture.
   * Disney+ changes video class from 'hive-video' to 'btm-media-client-element' in fullscreen.
   * The video element retains its #hivePlayer1 ID, which we use as a fallback selector.
   */
  describe('with Disney+ fullscreen DOM fixture', () => {
    beforeEach(() => {
      loadFixture('disney_full');
    });

    describe('getVideo (fullscreen fallback)', () => {
      it('returns video element by ID when hive-video class is absent', () => {
        const video = DisneyHandler._test.getVideo();

        expect(video).not.toBeNull();
        expect(video?.id).toBe('hivePlayer1');
      });

      it('returns video with btm-media-client-element class (fullscreen mode)', () => {
        const video = DisneyHandler._test.getVideo();

        expect(video).not.toBeNull();
        expect(video?.classList.contains('btm-media-client-element')).toBe(true);
        expect(video?.classList.contains('hive-video')).toBe(false);
      });

      it('returns video with blob src attribute', () => {
        const video = DisneyHandler._test.getVideo();

        expect(video).not.toBeNull();
        expect(video?.src).toMatch(/^blob:/);
      });
    });

    describe('getPlayer (fullscreen)', () => {
      it('returns disney-web-player element in fullscreen mode', () => {
        const player = DisneyHandler._test.getPlayer();

        expect(player).not.toBeNull();
        expect(player?.tagName.toLowerCase()).toBe('disney-web-player');
      });
    });
  });

  /**
   * Shadow DOM tests for getPlaybackTime and getDuration.
   *
   * These tests use createMockProgressBar() instead of the HTML fixture because:
   * 1. jsdom cannot parse Shadow DOM from static HTML fixtures
   * 2. Disney+ uses a <progress-bar> custom element with Shadow DOM containing
   *    aria-valuenow (time) and aria-valuemax (duration) attributes
   * 3. We must programmatically attach a shadow root to test this code path
   *
   * This is a necessary synthetic approach - the alternative would be to skip
   * testing Shadow DOM parsing entirely.
   */
  describe('getPlaybackTime (Shadow DOM)', () => {
    it('returns time from aria-valuenow attribute', () => {
      createMockProgressBar('120', '7200');

      const time = DisneyHandler._test.getPlaybackTime();
      expect(time).toBe(120);
    });

    it.each([
      { valuenow: '', description: 'empty string' },
      { valuenow: 'abc', description: 'non-numeric string' },
      { valuenow: '-5', description: 'negative number' },
    ])('returns null when aria-valuenow is $description', ({ valuenow }) => {
      createMockProgressBar(valuenow, '7200');

      const time = DisneyHandler._test.getPlaybackTime();
      expect(time).toBeNull();
    });

    it('returns null when progress-bar element does not exist', () => {
      // No progress bar added
      const time = DisneyHandler._test.getPlaybackTime();
      expect(time).toBeNull();
    });

    it('returns null when thumb element has no aria-valuenow', () => {
      createMockProgressBar(undefined, '7200');

      const time = DisneyHandler._test.getPlaybackTime();
      expect(time).toBeNull();
    });

    it('returns 0 when aria-valuenow is "0"', () => {
      createMockProgressBar('0', '7200');

      const time = DisneyHandler._test.getPlaybackTime();
      expect(time).toBe(0);
    });
  });

  describe('getDuration (Shadow DOM)', () => {
    it('returns duration from aria-valuemax attribute', () => {
      createMockProgressBar('120', '7200');

      const duration = DisneyHandler._test.getDuration();
      expect(duration).toBe(7200);
    });

    it.each([
      { valuemax: '', description: 'empty string' },
      { valuemax: 'abc', description: 'non-numeric string' },
      { valuemax: '-100', description: 'negative number' },
    ])('returns null when aria-valuemax is $description', ({ valuemax }) => {
      createMockProgressBar('120', valuemax);

      const duration = DisneyHandler._test.getDuration();
      expect(duration).toBeNull();
    });

    it('returns null when progress-bar element does not exist', () => {
      const duration = DisneyHandler._test.getDuration();
      expect(duration).toBeNull();
    });
  });

  /**
   * Regression test for issue where cached progress bar element becomes detached
   * from DOM (e.g., during fullscreen transitions) but still returns stale values.
   *
   * Bug: Disney+ rebuilds UI on fullscreen, detaching the cached thumb element.
   * The detached element still has old aria-valuenow value, causing stale time reads.
   * Fix: Check element.isConnected before using cached element.
   */
  describe('progress bar cache invalidation (regression)', () => {
    it('re-queries DOM when cached element is detached', () => {
      // Create initial progress bar with time 120
      const progressBar1 = createMockProgressBar('120', '7200');

      // First read - caches the thumb element
      const time1 = DisneyHandler._test.getPlaybackTime();
      expect(time1).toBe(120);

      // Simulate Disney+ UI rebuild (e.g., fullscreen transition)
      // Remove the old progress bar (detaches cached thumb element)
      progressBar1.remove();

      // Create new progress bar with different time (simulating playback progression)
      createMockProgressBar('3600', '7200');

      // Should NOT return stale cached value (120), should return new value (3600)
      const time2 = DisneyHandler._test.getPlaybackTime();
      expect(time2).toBe(3600);
    });

    it('uses cached element when still connected to DOM', () => {
      // Create progress bar
      createMockProgressBar('120', '7200');

      // First read - caches the element
      const time1 = DisneyHandler._test.getPlaybackTime();
      expect(time1).toBe(120);

      // Update the attribute value on the same element (simulating playback)
      const progressBar = document.querySelector('progress-bar');
      const thumb = progressBar?.shadowRoot?.querySelector('.progress-bar__thumb');
      thumb?.setAttribute('aria-valuenow', '240');

      // Should read updated value from same cached element
      const time2 = DisneyHandler._test.getPlaybackTime();
      expect(time2).toBe(240);
    });
  });
});
