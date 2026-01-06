// Click overlay for fullscreen exit focus recovery

import { Styles } from './styles/variables';

const OVERLAY_ID = 'keyboard-activation-overlay';

/**
 * Create an invisible full-page overlay to capture the first click after fullscreen exit.
 * This is needed because browsers require a real user click to grant keyboard focus
 * to the page after exiting fullscreen.
 */
function createClickOverlay(onActivated: () => void, container?: HTMLElement): void {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: ${Styles.vars.zIndex.max} !important;
    background: transparent !important;
    cursor: default !important;
    pointer-events: auto !important;
  `;

  overlay.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.remove();
      onActivated();
    },
    { once: true, capture: true }
  );

  // Append to specified container or body
  const target = container || document.body;
  target.appendChild(overlay);
}

/**
 * Remove the click overlay if it exists
 */
function removeClickOverlay(): void {
  const existing = document.getElementById(OVERLAY_ID);
  if (existing) {
    existing.remove();
  }
}

// Public API
export const Overlay = {
  createClick: createClickOverlay,
  removeClick: removeClickOverlay,
};
