// Banner notification utility

import { Fullscreen } from '@/core';
import { Styles } from './styles/variables';

const BANNER_ID = 'streamkeys-banner';
let bannerTimeout: ReturnType<typeof setTimeout> | null = null;

// Configured container getter for Shadow DOM environments
type GetContainerFn = () => HTMLElement | null;
let getCustomContainer: GetContainerFn | null = null;

export interface BannerConfig {
  /** Custom container getter for Shadow DOM environments (e.g., BBC fullscreen) */
  getContainer?: GetContainerFn;
}

/**
 * Configure banner with custom container getter for Shadow DOM environments.
 * When configured, Banner.show() will automatically use this container.
 */
function initBanner(config: BannerConfig): void {
  getCustomContainer = config.getContainer ?? null;
}

/**
 * Show a temporary banner notification overlay
 * @param message - The message to display
 * @param customContainer - Optional explicit container override
 */
function showBanner(message: string, customContainer?: HTMLElement | null): void {
  // Resolve container: explicit param > configured getter > fullscreen > body
  const resolvedContainer = customContainer ?? getCustomContainer?.() ?? null;

  // Remove existing banner - search in both document and custom container
  const existing =
    document.getElementById(BANNER_ID) ?? resolvedContainer?.querySelector(`#${BANNER_ID}`);
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

  // Append to resolved container if available,
  // otherwise to fullscreen element if in fullscreen, otherwise to body
  const container = resolvedContainer ?? Fullscreen.getElement() ?? document.body;
  container.appendChild(banner);

  // Fade out after delay
  bannerTimeout = setTimeout(() => {
    banner.style.opacity = '0';
    setTimeout(() => banner.remove(), Styles.vars.timing.fadeTransition);
  }, Styles.vars.timing.bannerFade);
}

/**
 * Clean up banner resources and reset configuration
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
  getCustomContainer = null;
}

// Public API
export const Banner = {
  init: initBanner,
  show: showBanner,
  cleanup: cleanupBanner,
};
