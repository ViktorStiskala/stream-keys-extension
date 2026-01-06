// Handler type definitions

import type { SubtitleConfig, FeatureFlags } from '@/types';
import type { TrackingTimingConfig } from '@/features';

export interface HandlerConfig {
  name: string;
  getPlayer: () => HTMLElement | null;
  getButton?: (keyCode: string) => HTMLElement | null;
  setupPlayerFocus?: (player: HTMLElement) => void;
  onPlayerSetup?: (player: HTMLElement) => void;
  getOverlayContainer?: () => HTMLElement;
  /** Custom container for restore dialog (for fullscreen in Shadow DOM environments) */
  getDialogContainer?: () => HTMLElement | null;
  /** Custom video element selector for services with multiple video elements */
  getVideo?: () => HTMLVideoElement | null;
  /** Custom playback time getter for services where video.currentTime is unreliable */
  getPlaybackTime?: () => number | null;
  /** Custom duration getter for services where video.duration is unreliable */
  getDuration?: () => number | null;
  /** Get seek buttons for position history tracking */
  getSeekButtons?: () => { backward: HTMLElement | null; forward: HTMLElement | null };
  /**
   * Seek forward/backward by delta seconds.
   * If not provided, defaults to video.currentTime += delta.
   * Disney+ provides custom implementation that clicks native buttons.
   */
  seekByDelta?: (video: HTMLVideoElement, delta: number) => void;
  /**
   * Seek to a specific absolute time (for position restore).
   * If not provided, defaults to video.currentTime = time.
   * Disney+ provides custom implementation that clicks timeline.
   */
  seekToTime?: (time: number, duration: number) => boolean;
  /**
   * Custom timing for position tracking settling delays.
   * Allows services to customize how long to wait before capturing load time
   * and when to start tracking seeks.
   */
  positionTrackingTiming?: TrackingTimingConfig;
  subtitles?: SubtitleConfig;
  features?: FeatureFlags;
}

export interface HandlerAPI {
  /** Cleanup all resources */
  cleanup: () => void;
}
