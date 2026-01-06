import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BBCHandler } from './bbc';
import { resetFixture, createBBCShadowDOM, type BBCShadowDOMElements } from '@test';

describe('BBCHandler', () => {
  beforeEach(() => {
    resetFixture();
  });

  afterEach(() => {
    resetFixture();
  });

  describe('without fixture (null safety)', () => {
    it('getPlayer returns null when smp-toucan-player does not exist', () => {
      const player = BBCHandler._test.getPlayer();
      expect(player).toBeNull();
    });

    it('getVideo returns null when player does not exist', () => {
      const video = BBCHandler._test.getVideo();
      expect(video).toBeNull();
    });

    it('getButton returns null when player does not exist', () => {
      const button = BBCHandler._test.getButton('Space');
      expect(button).toBeNull();
    });

    it('getSeekButtons returns null buttons when player does not exist', () => {
      const buttons = BBCHandler._test.getSeekButtons();
      expect(buttons.backward).toBeNull();
      expect(buttons.forward).toBeNull();
    });

    it('subtitles.getAvailable returns empty array when player does not exist', () => {
      const available = BBCHandler._test.subtitles.getAvailable();
      expect(available).toEqual([]);
    });

    it('subtitles.getCurrentState returns false when player does not exist', () => {
      const state = BBCHandler._test.subtitles.getCurrentState();
      expect(state).toBe(false);
    });
  });

  describe('with BBC Shadow DOM', () => {
    let elements: BBCShadowDOMElements;

    beforeEach(() => {
      elements = createBBCShadowDOM();
    });

    describe('getPlayer', () => {
      it('returns smp-video-layout element', () => {
        const player = BBCHandler._test.getPlayer();

        expect(player).not.toBeNull();
        expect(player?.tagName.toLowerCase()).toBe('smp-video-layout');
      });

      it('returns the same element as created by helper', () => {
        const player = BBCHandler._test.getPlayer();
        expect(player).toBe(elements.videoLayout);
      });
    });

    describe('getVideo', () => {
      it('returns video element', () => {
        const video = BBCHandler._test.getVideo();

        expect(video).not.toBeNull();
        expect(video?.tagName.toLowerCase()).toBe('video');
      });

      it('returns the same element as created by helper', () => {
        const video = BBCHandler._test.getVideo();
        expect(video).toBe(elements.video);
      });

      it('video has correct id', () => {
        const video = BBCHandler._test.getVideo();
        expect(video?.id).toBe('smpVideoElement');
      });
    });

    describe('getButton', () => {
      it('returns play/pause button for Space key', () => {
        const button = BBCHandler._test.getButton('Space');

        expect(button).not.toBeNull();
        expect(button).toBe(elements.playPauseButton);
      });

      it('returns fullscreen button for KeyF', () => {
        const button = BBCHandler._test.getButton('KeyF');

        expect(button).not.toBeNull();
        expect(button).toBe(elements.fullscreenButton);
      });

      it('returns null for unknown key code', () => {
        const button = BBCHandler._test.getButton('KeyX');
        expect(button).toBeNull();
      });

      it('returns null for ArrowLeft (not directly mapped in BBC)', () => {
        const button = BBCHandler._test.getButton('ArrowLeft');
        expect(button).toBeNull();
      });
    });

    describe('getSeekButtons', () => {
      it('returns backward button', () => {
        const buttons = BBCHandler._test.getSeekButtons();

        expect(buttons.backward).not.toBeNull();
        expect(buttons.backward).toBe(elements.backwardButton);
      });

      it('returns forward button', () => {
        const buttons = BBCHandler._test.getSeekButtons();

        expect(buttons.forward).not.toBeNull();
        expect(buttons.forward).toBe(elements.forwardButton);
      });
    });

    describe('subtitles.getAvailable', () => {
      it('returns array with one item', () => {
        const available = BBCHandler._test.subtitles.getAvailable();

        expect(available).toHaveLength(1);
      });

      it('item has label "Captions: On"', () => {
        const available = BBCHandler._test.subtitles.getAvailable();

        expect(available[0].label).toBe('Captions: On');
      });

      it('item has element pointing to toggle', () => {
        const available = BBCHandler._test.subtitles.getAvailable();

        expect(available[0].element).toBe(elements.subtitleToggle);
      });
    });

    describe('subtitles.getCurrentState', () => {
      it('returns false when aria-checked is "false"', () => {
        elements.setSubtitlesOn(false);

        const state = BBCHandler._test.subtitles.getCurrentState();
        expect(state).toBe(false);
      });

      it('returns true when aria-checked is "true"', () => {
        elements.setSubtitlesOn(true);

        const state = BBCHandler._test.subtitles.getCurrentState();
        expect(state).toBe(true);
      });
    });

    describe('subtitles initial state from options', () => {
      it('creates with subtitles off by default', () => {
        // elements already created with default (off)
        const state = BBCHandler._test.subtitles.getCurrentState();
        expect(state).toBe(false);
      });

      it('creates with subtitles on when option is true', () => {
        resetFixture();
        createBBCShadowDOM({ subtitlesOn: true });

        const state = BBCHandler._test.subtitles.getCurrentState();
        expect(state).toBe(true);
      });
    });
  });

  describe('helper functions', () => {
    describe('getShadowRoot', () => {
      it('returns null for null input', () => {
        const result = BBCHandler._test.getShadowRoot(null);
        expect(result).toBeNull();
      });

      it('returns shadowRoot when available', () => {
        const element = document.createElement('div');
        const shadow = element.attachShadow({ mode: 'open' });

        const result = BBCHandler._test.getShadowRoot(element);
        expect(result).toBe(shadow);
      });

      it('returns null for element without shadow', () => {
        const element = document.createElement('div');

        const result = BBCHandler._test.getShadowRoot(element);
        expect(result).toBeNull();
      });
    });

    describe('getNestedShadow', () => {
      it('traverses single level correctly', () => {
        const parent = document.createElement('div');
        const child = document.createElement('custom-element');
        const childShadow = child.attachShadow({ mode: 'open' });
        parent.appendChild(child);
        document.body.appendChild(parent);

        const result = BBCHandler._test.getNestedShadow(document, 'custom-element');
        expect(result).toBe(childShadow);
      });

      it('traverses multiple levels correctly', () => {
        // Create nested structure: level1 [shadow] → level2 [shadow]
        const level1 = document.createElement('level-one');
        const level1Shadow = level1.attachShadow({ mode: 'open' });

        const level2 = document.createElement('level-two');
        const level2Shadow = level2.attachShadow({ mode: 'open' });
        level1Shadow.appendChild(level2);

        document.body.appendChild(level1);

        const result = BBCHandler._test.getNestedShadow(document, 'level-one', 'level-two');
        expect(result).toBe(level2Shadow);
      });

      it('returns null if any level fails', () => {
        const level1 = document.createElement('level-one');
        level1.attachShadow({ mode: 'open' });
        // level1 shadow is empty - no level-two inside

        document.body.appendChild(level1);

        const result = BBCHandler._test.getNestedShadow(document, 'level-one', 'level-two');
        expect(result).toBeNull();
      });

      it('returns null if element exists but has no shadow', () => {
        const element = document.createElement('no-shadow');
        document.body.appendChild(element);

        const result = BBCHandler._test.getNestedShadow(document, 'no-shadow');
        expect(result).toBeNull();
      });
    });

    describe('getSubtitlesToggleShadow', () => {
      it('returns null when player does not exist', () => {
        const result = BBCHandler._test.getSubtitlesToggleShadow();
        expect(result).toBeNull();
      });

      it('returns shadow root when BBC DOM exists', () => {
        createBBCShadowDOM();

        const result = BBCHandler._test.getSubtitlesToggleShadow();
        expect(result).not.toBeNull();
        expect(result).toBeInstanceOf(ShadowRoot);
      });
    });

    describe('getSubtitlesToggle', () => {
      it('returns null when player does not exist', () => {
        const result = BBCHandler._test.getSubtitlesToggle();
        expect(result).toBeNull();
      });

      it('returns .toggle element when BBC DOM exists', () => {
        const elements = createBBCShadowDOM();

        const result = BBCHandler._test.getSubtitlesToggle();
        expect(result).toBe(elements.subtitleToggle);
      });

      it('returned element has role="checkbox"', () => {
        createBBCShadowDOM();

        const result = BBCHandler._test.getSubtitlesToggle();
        expect(result?.getAttribute('role')).toBe('checkbox');
      });
    });
  });
});
