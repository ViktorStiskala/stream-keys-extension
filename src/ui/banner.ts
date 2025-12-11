// Banner notification utility

import { Styles } from './styles/variables';

const BANNER_ID = 'streamkeys-banner';
let bannerTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Show a temporary banner notification overlay
 */
function showBanner(message: string): void {
  // Remove existing banner
  const existing = document.getElementById(BANNER_ID);
  if (existing) {
    existing.remove();
    if (bannerTimeout) {
      clearTimeout(bannerTimeout);
    }
  }

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.textContent = message;
  banner.style.cssText = `
    position: fixed;
    bottom: 25%;
    left: 50%;
    transform: translateX(-50%);
    background: ${Styles.vars.overlay.bgLight};
    color: ${Styles.vars.text.primary};
    padding: ${Styles.vars.spacing.xl} 40px;
    border-radius: ${Styles.vars.borderRadius.xl};
    font-family: ${Styles.vars.font.family};
    font-size: ${Styles.vars.font.sizeXXLarge};
    font-weight: 600;
    z-index: ${Styles.vars.zIndex.max};
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.3s ease-out;
  `;

  document.body.appendChild(banner);

  // Fade out after delay
  bannerTimeout = setTimeout(() => {
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), Styles.vars.timing.fadeTransition);
  }, Styles.vars.timing.bannerFade);
}

/**
 * Clean up banner resources
 */
function cleanupBanner(): void {
  const existing = document.getElementById(BANNER_ID);
  if (existing) {
    existing.remove();
  }
  if (bannerTimeout) {
    clearTimeout(bannerTimeout);
    bannerTimeout = null;
  }
}

// Public API
export const Banner = {
  show: showBanner,
  cleanup: cleanupBanner,
};
