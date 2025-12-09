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
}

// Feature flags
export interface FeatureFlags {
  subtitles?: boolean;
  restorePosition?: boolean;
  keyboard?: boolean;
  fullscreenOverlay?: boolean;
}

// Handler configuration
export interface HandlerConfig {
  name: string;
  getPlayer: () => HTMLElement | null;
  getButton?: (keyCode: string) => HTMLElement | null;
  setupPlayerFocus?: (player: HTMLElement) => void;
  onPlayerSetup?: (player: HTMLElement) => void;
  getOverlayContainer?: () => HTMLElement;
  /** Custom video element selector for services with multiple video elements */
  getVideo?: () => HTMLVideoElement | null;
  /** Custom playback time getter for services where video.currentTime is unreliable */
  getPlaybackTime?: () => number | null;
  subtitles?: SubtitleConfig;
  features?: FeatureFlags;
}

// Global window augmentation for settings
declare global {
  interface Window {
    __streamKeysSettings?: StreamKeysSettings;
  }
}

// Video element with StreamKeys tracking properties
export interface StreamKeysVideoElement extends HTMLVideoElement {
  _lastKnownTime?: number;
  _streamKeysSeekListenerAdded?: boolean;
  _streamKeysReadyForTracking?: boolean;
  _streamKeysPlaybackStarted?: boolean;
  _mouseListenerAdded?: boolean;
}

// Player element with StreamKeys properties
export interface StreamKeysPlayerElement extends HTMLElement {
  _mouseListenerAdded?: boolean;
}

// Key codes for keyboard handling
export type KeyCode = 'Space' | 'KeyF' | 'KeyC' | 'KeyR' | 'ArrowLeft' | 'ArrowRight' | 'Escape';

// Cleanup function type for features
export type CleanupFn = () => void;

// Feature initialization result
export interface FeatureResult {
  cleanup?: CleanupFn;
}
