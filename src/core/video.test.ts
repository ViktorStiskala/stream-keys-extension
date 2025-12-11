import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Video } from './video';
import type { StreamKeysVideoElement } from '@/types';

describe('Video', () => {
  /**
   * Tests for createGetter and video element augmentation.
   *
   * These tests use Object.defineProperty to override video properties because:
   * 1. jsdom's HTMLVideoElement doesn't support real media playback
   * 2. Properties like currentTime and duration are read-only in jsdom without playback
   * 3. We need predictable values to test the augmentation logic
   *
   * This is a necessary synthetic approach - without it, we cannot test how the
   * extension handles different currentTime/duration combinations.
   */
  describe('createGetter', () => {
    let mockVideo: HTMLVideoElement;

    beforeEach(() => {
      document.body.innerHTML = '';
      mockVideo = document.createElement('video');
      // Override read-only properties - jsdom video elements don't have real playback
      Object.defineProperty(mockVideo, 'currentTime', { value: 50, writable: true });
      Object.defineProperty(mockVideo, 'duration', { value: 100, writable: true });
    });

    describe('_streamKeysGetPlaybackTime augmentation', () => {
      it.each([
        { customReturn: 120, expected: 120, description: 'returns custom value when available' },
        { customReturn: 0, expected: 0, description: 'returns 0 when custom getter returns 0' },
      ])('$description', ({ customReturn, expected }) => {
        const player = document.createElement('div');
        player.appendChild(mockVideo);
        document.body.appendChild(player);

        const getter = Video.createGetter({
          getPlayer: () => player,
          getPlaybackTime: () => customReturn,
        });

        const video = getter() as StreamKeysVideoElement;
        expect(video?._streamKeysGetPlaybackTime?.()).toBe(expected);
      });

      it('falls back to video.currentTime when custom getter returns null', () => {
        const player = document.createElement('div');
        player.appendChild(mockVideo);
        document.body.appendChild(player);

        const getter = Video.createGetter({
          getPlayer: () => player,
          getPlaybackTime: () => null,
        });

        const video = getter() as StreamKeysVideoElement;
        expect(video?._streamKeysGetPlaybackTime?.()).toBe(50);
      });

      it('uses video.currentTime when no custom getter provided', () => {
        const player = document.createElement('div');
        player.appendChild(mockVideo);
        document.body.appendChild(player);

        const getter = Video.createGetter({
          getPlayer: () => player,
        });

        const video = getter() as StreamKeysVideoElement;
        expect(video?._streamKeysGetPlaybackTime?.()).toBe(50);
      });
    });

    describe('_streamKeysGetStableTime fallback chain', () => {
      it('returns _streamKeysStableTime when set', () => {
        const player = document.createElement('div');
        player.appendChild(mockVideo);
        document.body.appendChild(player);

        const getter = Video.createGetter({ getPlayer: () => player });
        const video = getter() as StreamKeysVideoElement;

        video._streamKeysStableTime = 200;
        video._streamKeysLastKnownTime = 150;

        expect(video._streamKeysGetStableTime?.()).toBe(200);
      });

      it('returns _streamKeysLastKnownTime when _streamKeysStableTime is not set', () => {
        const player = document.createElement('div');
        player.appendChild(mockVideo);
        document.body.appendChild(player);

        const getter = Video.createGetter({ getPlayer: () => player });
        const video = getter() as StreamKeysVideoElement;

        video._streamKeysLastKnownTime = 150;

        expect(video._streamKeysGetStableTime?.()).toBe(150);
      });

      it('calls _streamKeysGetPlaybackTime when neither stable nor lastKnown are set', () => {
        const player = document.createElement('div');
        player.appendChild(mockVideo);
        document.body.appendChild(player);

        const getter = Video.createGetter({
          getPlayer: () => player,
          getPlaybackTime: () => 75,
        });
        const video = getter() as StreamKeysVideoElement;

        expect(video._streamKeysGetStableTime?.()).toBe(75);
      });

      it('falls back to video.currentTime as last resort', () => {
        const player = document.createElement('div');
        player.appendChild(mockVideo);
        document.body.appendChild(player);

        const getter = Video.createGetter({ getPlayer: () => player });
        const video = getter() as StreamKeysVideoElement;

        expect(video._streamKeysGetStableTime?.()).toBe(50);
      });
    });

    describe('_streamKeysGetDuration augmentation', () => {
      it('returns custom duration when available', () => {
        const player = document.createElement('div');
        player.appendChild(mockVideo);
        document.body.appendChild(player);

        const getter = Video.createGetter({
          getPlayer: () => player,
          getDuration: () => 7200,
        });

        const video = getter() as StreamKeysVideoElement;
        expect(video?._streamKeysGetDuration?.()).toBe(7200);
      });

      it('falls back to video.duration when custom getter returns null', () => {
        const player = document.createElement('div');
        player.appendChild(mockVideo);
        document.body.appendChild(player);

        const getter = Video.createGetter({
          getPlayer: () => player,
          getDuration: () => null,
        });

        const video = getter() as StreamKeysVideoElement;
        expect(video?._streamKeysGetDuration?.()).toBe(100);
      });
    });
  });

  describe('formatTime', () => {
    it.each([
      { input: 0, expected: '0:00' },
      { input: 5, expected: '0:05' },
      { input: 65, expected: '1:05' },
      { input: 3661, expected: '1:01:01' },
      { input: 59.9, expected: '0:59' },
      { input: 3599, expected: '59:59' },
      { input: 3600, expected: '1:00:00' },
      { input: 86399, expected: '23:59:59' },
    ])('formats $input seconds as "$expected"', ({ input, expected }) => {
      expect(Video.formatTime(input)).toBe(expected);
    });

    describe('edge cases', () => {
      // Document behavior for edge case inputs
      // These test current behavior - modify if behavior should change

      it('handles very large values (100+ hours)', () => {
        // 360000 seconds = 100 hours
        expect(Video.formatTime(360000)).toBe('100:00:00');
      });

      it('handles negative values by producing negative components', () => {
        // Current behavior: negative numbers produce negative time components
        // This documents current behavior - caller should validate input
        const result = Video.formatTime(-10);
        expect(result).toContain('-');
      });

      it('handles NaN by producing NaN components', () => {
        // Current behavior: NaN produces NaN in output
        // This documents current behavior - caller should validate input
        const result = Video.formatTime(NaN);
        expect(result).toContain('NaN');
      });

      it('handles Infinity by producing Infinity components', () => {
        // Current behavior: Infinity produces Infinity in output
        // This documents current behavior - caller should validate input
        const result = Video.formatTime(Infinity);
        expect(result).toContain('Infinity');
      });
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      { secondsAgo: 0, expected: 'just now' },
      { secondsAgo: 45, expected: '45s ago' },
      { secondsAgo: 60, expected: '1m ago' },
      { secondsAgo: 90, expected: '1m 30s ago' },
      { secondsAgo: 3600, expected: '1h ago' },
      { secondsAgo: 3660, expected: '1h 1m ago' },
      { secondsAgo: 7200, expected: '2h ago' },
    ])('formats $secondsAgo seconds ago as "$expected"', ({ secondsAgo, expected }) => {
      const timestamp = Date.now() - secondsAgo * 1000;
      expect(Video.formatRelativeTime(timestamp)).toBe(expected);
    });
  });
});
