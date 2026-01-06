// Subtitles feature - toggle subtitles on/off with language preference

import type { SubtitleConfig, SubtitleItem, CleanupFn } from '@/types';
import { Debug, Settings } from '@/core';
import { Banner } from '@/ui/banner';

// __DEV__ is defined by vite config based on isWatch
declare const __DEV__: boolean;

export interface SubtitlesConfig {
  subtitles: SubtitleConfig;
}

export interface SubtitlesAPI {
  /** Toggle subtitles on/off */
  toggle: () => void;
  /** Get current subtitle state */
  isOn: () => boolean;
  /** Get available subtitle languages */
  getAvailable: () => SubtitleItem[];
  /** Cleanup resources */
  cleanup: CleanupFn;
}

/**
 * Find matching language from preferences
 */
function findMatchingLanguage(
  preferences: string[],
  available: SubtitleItem[]
): SubtitleItem | null {
  for (const pref of preferences) {
    const prefNormalized = pref.trim().toLowerCase();
    const match = available.find((item) => item.label.trim().toLowerCase() === prefNormalized);
    if (match) return match;
  }
  return null;
}

/**
 * Initialize the Subtitles feature
 */
function initSubtitles(config: SubtitlesConfig): SubtitlesAPI {
  const { subtitles } = config;

  const toggle = () => {
    const preferences = Settings.getSubtitlePreferences();

    // If no preferences configured, do nothing
    if (preferences.length === 0) {
      return;
    }

    const isOn = subtitles.getCurrentState();

    if (isOn) {
      // Turn off subtitles
      if (__DEV__) Debug.action('Subtitles: Off');
      subtitles.turnOff();
      Banner.show('Captions: Off');
    } else {
      // Find matching language from preferences
      const available = subtitles.getAvailable();

      // Simple toggle: if only one option available, just toggle it (e.g., BBC iPlayer)
      if (available.length === 1) {
        if (__DEV__) Debug.action('Subtitles: On', available[0].label);
        subtitles.selectLanguage(available[0]);
        Banner.show(available[0].label);
        return;
      }

      const match = findMatchingLanguage(preferences, available);

      if (match) {
        if (__DEV__) Debug.action('Subtitles: On', match.label);
        subtitles.selectLanguage(match);
        Banner.show(match.label);
      } else {
        if (__DEV__) Debug.action('Subtitles: On', 'language not found');
        Banner.show('Captions: Language not found, check extension settings');
      }
    }
  };

  return {
    toggle,
    isOn: () => subtitles.getCurrentState(),
    getAvailable: () => subtitles.getAvailable(),
    cleanup: () => {
      // No cleanup needed for subtitles
    },
  };
}

// Public API
export const Subtitles = {
  init: initSubtitles,
};
