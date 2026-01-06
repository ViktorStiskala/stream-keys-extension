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

      it('returns null when custom getter returns null (allows fallback handling)', () => {
        const player = document.createElement('div');
        player.appendChild(mockVideo);
        document.body.appendChild(player);

        const getter = Video.createGetter({
          getPlayer: () => player,
          getPlaybackTime: () => null,
        });

        const video = getter() as StreamKeysVideoElement;
        // Returns null so callers can use _streamKeysLastKnownTime as fallback
        // (e.g., Disney+ when controls are hidden)
        expect(video?._streamKeysGetPlaybackTime?.()).toBeNull();
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

    /**
     * Regression tests for _streamKeysGetDisplayTime fallback chain.
     *
     * Bug: Dialog showed 0:00 on Disney+ when controls were hidden because
     * _streamKeysGetPlaybackTime returned null (progress bar not accessible)
     * and video.currentTime is buffer-relative (~0s for MSE streams).
     *
     * Fix: Added _streamKeysGetDisplayTime with fallback to _streamKeysLastKnownTime.
     */
    describe('_streamKeysGetDisplayTime fallback chain (regression)', () => {
      it('returns _streamKeysGetPlaybackTime value when available', () => {
        const player = document.createElement('div');
        player.appendChild(mockVideo);
        document.body.appendChild(player);

        const getter = Video.createGetter({
          getPlayer: () => player,
          getPlaybackTime: () => 1800, // 30:00
        });
        const video = getter() as StreamKeysVideoElement;

        expect(video._streamKeysGetDisplayTime?.()).toBe(1800);
      });

      it('falls back to _streamKeysLastKnownTime when playback time returns null', () => {
        const player = document.createElement('div');
        player.appendChild(mockVideo);
        document.body.appendChild(player);

        const getter = Video.createGetter({
          getPlayer: () => player,
          getPlaybackTime: () => null, // Simulates Disney+ with hidden controls
        });
        const video = getter() as StreamKeysVideoElement;

        // Set last known time (captured when controls were visible)
        video._streamKeysLastKnownTime = 2700; // 45:00

        expect(video._streamKeysGetDisplayTime?.()).toBe(2700);
      });

      it('returns 0 when both playback time and last known time are unavailable', () => {
        const player = document.createElement('div');
        player.appendChild(mockVideo);
        document.body.appendChild(player);

        const getter = Video.createGetter({
          getPlayer: () => player,
          getPlaybackTime: () => null,
        });
        const video = getter() as StreamKeysVideoElement;

        // No _streamKeysLastKnownTime set
        expect(video._streamKeysGetDisplayTime?.()).toBe(0);
      });

      it('prefers live playback time over stale last known time', () => {
        const player = document.createElement('div');
        player.appendChild(mockVideo);
        document.body.appendChild(player);

        const getter = Video.createGetter({
          getPlayer: () => player,
          getPlaybackTime: () => 3600, // Live time: 1:00:00
        });
        const video = getter() as StreamKeysVideoElement;

        // Last known time is older (captured before playback progressed)
        video._streamKeysLastKnownTime = 3000;

        // Should use live playback time, not stale last known time
        expect(video._streamKeysGetDisplayTime?.()).toBe(3600);
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
