// Focus management utilities

export interface FocusConfig {
  getPlayer: () => HTMLElement | null;
  setupPlayerFocus?: (player: HTMLElement) => void;
}

/**
 * Focus the player element if the document has focus
 */
function focusPlayer(config: FocusConfig): void {
  const player = config.getPlayer();
  if (player && document.hasFocus()) {
    if (config.setupPlayerFocus) {
      config.setupPlayerFocus(player);
    } else {
      player.setAttribute('tabindex', '-1');
      player.focus();
    }
  }
}

/**
 * Create a throttled mousemove handler to restore focus
 */
function createMouseMoveHandler(config: FocusConfig, throttleMs = 500): () => void {
  let lastMoveTime = 0;

  return () => {
    const now = Date.now();
    if (now - lastMoveTime < throttleMs) return;
    lastMoveTime = now;
    focusPlayer(config);
  };
}

// Public API
export const Focus = {
  player: focusPlayer,
  createMouseMoveHandler,
};
