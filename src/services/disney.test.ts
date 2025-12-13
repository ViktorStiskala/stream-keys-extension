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
});
