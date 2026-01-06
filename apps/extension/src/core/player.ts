// Player setup utilities

import type { StreamKeysPlayerElement } from '@/types';

export interface PlayerSetupConfig {
  getPlayer: () => HTMLElement | null;
  onPlayerSetup?: (player: HTMLElement) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onMouseMove: () => void;
}

export interface PlayerState {
  attachedPlayer: HTMLElement | null;
}

/**
 * Set up the player element with event listeners
 */
function setupPlayer(config: PlayerSetupConfig, state: PlayerState): void {
  const player = config.getPlayer() as StreamKeysPlayerElement | null;
  if (!player) return;

  // Detect if player element changed (SPA navigation)
  const playerChanged = state.attachedPlayer !== player;

  if (playerChanged) {
    // Re-attach keydown listener to new player
    player.addEventListener('keydown', config.onKeyDown, true);
    state.attachedPlayer = player;
  }

  // Add mousemove listener for focus restoration
  if (!player._streamKeysMouseListenerAdded) {
    player.addEventListener('mousemove', config.onMouseMove);
    player._streamKeysMouseListenerAdded = true;
  }

  // Call custom setup if provided
  if (config.onPlayerSetup) {
    config.onPlayerSetup(player);
  }
}

/**
 * Create a periodic player setup interval
 */
function createPlayerSetupInterval(
  config: PlayerSetupConfig,
  state: PlayerState,
  intervalMs = 1000
): () => void {
  const intervalId = setInterval(() => {
    setupPlayer(config, state);
  }, intervalMs);

  return () => clearInterval(intervalId);
}

// Public API
export const Player = {
  setup: setupPlayer,
  createSetupInterval: createPlayerSetupInterval,
};
