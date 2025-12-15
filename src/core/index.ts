// Core utilities barrel export

// Use aliased path for Debug to enable compile-time stub swapping in production
export { Debug } from '@/core/debug';
export { Guard } from './guard';
export { Settings } from './settings';
export { Video, type VideoGetterConfig } from './video';
export { Focus, type FocusConfig } from './focus';
export { Fullscreen, type FullscreenConfig, type FullscreenState } from './fullscreen';
export { Player, type PlayerSetupConfig, type PlayerState } from './player';
