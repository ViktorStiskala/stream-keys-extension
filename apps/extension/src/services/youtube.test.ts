import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YouTubeHandler } from './youtube';
import { loadFixture, resetFixture } from '@test';

describe('YouTubeHandler', () => {
  beforeEach(() => {
    resetFixture();
  });

  afterEach(() => {
    resetFixture();
  });

  describe('with YouTube DOM fixture', () => {
    beforeEach(() => {
      loadFixture('youtube');
    });

    describe('getPlayer', () => {
      it('returns movie_player element', () => {
        const player = YouTubeHandler._test.getPlayer();

        expect(player).not.toBeNull();
        expect(player?.id).toBe('movie_player');
      });

      it('has html5-video-player class', () => {
        const player = YouTubeHandler._test.getPlayer();

        expect(player?.classList.contains('html5-video-player')).toBe(true);
      });
    });

    describe('getVideo', () => {
      it('returns main video element from movie_player', () => {
        const video = YouTubeHandler._test.getVideo();

        expect(video).not.toBeNull();
        expect(video).toBeInstanceOf(HTMLVideoElement);
      });

      it('returns video with video-stream class', () => {
        const video = YouTubeHandler._test.getVideo();

        expect(video?.classList.contains('video-stream')).toBe(true);
      });

      it('does not return inline-preview-player video', () => {
        const video = YouTubeHandler._test.getVideo();
        const previewPlayer = document.getElementById('inline-preview-player');

        // If preview player exists, ensure we didn't get its video
        if (previewPlayer) {
          const previewVideo = previewPlayer.querySelector('video');
          expect(video).not.toBe(previewVideo);
        }

        // Verify the video is inside movie_player
        const moviePlayer = document.getElementById('movie_player');
        expect(moviePlayer?.contains(video)).toBe(true);
      });

      it('video element has blob URL source', () => {
        const video = YouTubeHandler._test.getVideo();

        // YouTube uses blob URLs for video
        expect(video?.src).toMatch(/^blob:/);
      });
    });

    describe('player structure', () => {
      it('video is inside html5-video-container', () => {
        const video = YouTubeHandler._test.getVideo();
        const container = video?.closest('.html5-video-container');

        expect(container).not.toBeNull();
      });

      it('progress bar exists with aria attributes', () => {
        const progressBar = document.querySelector('.ytp-progress-bar');

        expect(progressBar).not.toBeNull();
        expect(progressBar?.getAttribute('aria-valuemax')).toBeTruthy();
        expect(progressBar?.getAttribute('aria-valuenow')).toBeTruthy();
      });
    });
  });

  describe('without fixture', () => {
    it('getPlayer returns null when movie_player does not exist', () => {
      const player = YouTubeHandler._test.getPlayer();
      expect(player).toBeNull();
    });

    it('getVideo returns null when video does not exist', () => {
      const video = YouTubeHandler._test.getVideo();
      expect(video).toBeNull();
    });
  });
});
