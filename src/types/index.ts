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

// Service identifiers
export type ServiceId = 'disney' | 'hbomax' | 'youtube' | 'bbc';

// Service handler configuration
export interface ServiceHandler {
  id: ServiceId;
  urlPattern: string;
  handlerFile: string;
  displayName: string;
}

// Default settings values
export const DEFAULT_LANGUAGES = ['English', 'English [CC]', 'English CC'];
export const DEFAULT_POSITION_HISTORY = true;
export const DEFAULT_CAPTURE_MEDIA_KEYS = true;
export const DEFAULT_CUSTOM_SEEK_ENABLED = false;
export const DEFAULT_SEEK_TIME = 10;
export const DEFAULT_ENABLED_SERVICES: Record<ServiceId, boolean> = {
  disney: true,
  hbomax: true,
  youtube: true,
  bbc: true,
};

// Registered service handlers
export const SERVICE_HANDLERS: ServiceHandler[] = [
  {
    id: 'disney',
    urlPattern: 'disneyplus.com',
    handlerFile: 'src/services/disney.js',
    displayName: 'Disney+',
  },
  {
    id: 'hbomax',
    urlPattern: 'hbomax.com',
    handlerFile: 'src/services/hbomax.js',
    displayName: 'HBO Max',
  },
  {
    id: 'youtube',
    urlPattern: 'youtube.com',
    handlerFile: 'src/services/youtube.js',
    displayName: 'YouTube',
  },
  {
    id: 'bbc',
    urlPattern: 'bbc.co.uk/iplayer',
    handlerFile: 'src/services/bbc.js',
    displayName: 'BBC iPlayer',
  },
];

// Settings types
export interface StreamKeysSettings {
  subtitleLanguages: string[];
  positionHistoryEnabled: boolean;
  captureMediaKeys: boolean;
  customSeekEnabled: boolean;
  seekTime: number;
  enabledServices: Record<ServiceId, boolean>;
}

// Feature flags
export interface FeatureFlags {
  subtitles?: boolean;
  restorePosition?: boolean;
  keyboard?: boolean;
  fullscreenOverlay?: boolean;
}

// Global window augmentation for settings and shadow patcher
declare global {
  interface Window {
    __streamKeysSettings?: StreamKeysSettings;
    __getShadowRoot?: (element: Element) => ShadowRoot | undefined;
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
