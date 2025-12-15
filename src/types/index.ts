// Subtitle types
export interface SubtitleItem {
  label: string;
  element: HTMLElement;
  inputId?: string;
}

export interface SubtitleConfig {
  getAvailable: () => SubtitleItem[];
  getCurrentState: () => boolean;
  turnOff: () => void;
  selectLanguage: (item: SubtitleItem) => void;
}

// Position history types
export interface PositionEntry {
  time: number;
  label: string;
  savedAt: number;
}

// Settings types
export interface StreamKeysSettings {
  subtitleLanguages: string[];
  positionHistoryEnabled: boolean;
  captureMediaKeys: boolean;
  customSeekEnabled: boolean;
  seekTime: number;
}

// Feature flags
export interface FeatureFlags {
  subtitles?: boolean;
  restorePosition?: boolean;
  keyboard?: boolean;
  fullscreenOverlay?: boolean;
}

// Global window augmentation for settings
declare global {
  interface Window {
    __streamKeysSettings?: StreamKeysSettings;
  }
}

// Video element with StreamKeys tracking properties
export interface StreamKeysVideoElement extends HTMLVideoElement {
  _streamKeysLastKnownTime?: number;
  /** Stable time - always ~500ms behind, guaranteed to be pre-seek value */
  _streamKeysStableTime?: number;
  _streamKeysSeekListenerAdded?: boolean;
  _streamKeysReadyForTracking?: boolean;
  _streamKeysPlaybackStarted?: boolean;
  _streamKeysMouseListenerAdded?: boolean;
  /** Get actual playback time (uses custom logic if available, else video.currentTime) */
  _streamKeysGetPlaybackTime?: () => number;
  /** Get stable time for position restore (uses fallback chain) */
  _streamKeysGetStableTime?: () => number;
  /** Get actual video duration (uses custom logic if available, else video.duration) */
  _streamKeysGetDuration?: () => number;
}

// Player element with StreamKeys properties
export interface StreamKeysPlayerElement extends HTMLElement {
  _streamKeysMouseListenerAdded?: boolean;
}

// Key codes for keyboard handling
export type KeyCode = 'Space' | 'KeyF' | 'KeyC' | 'KeyR' | 'ArrowLeft' | 'ArrowRight' | 'Escape';

// Cleanup function type for features
export type CleanupFn = () => void;

// Feature initialization result
export interface FeatureResult {
  cleanup?: CleanupFn;
}
