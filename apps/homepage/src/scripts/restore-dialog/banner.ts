// Banner Notification Display

import { BANNER_FADE_DELAY, BANNER_FADE_DURATION } from "./config";
import { getBannerTimeout, setBannerTimeout } from "./state";

/**
 * Show a banner notification at the bottom of the screen
 */
export function showBanner(message: string): void {
  // Remove existing banner
  const existing = document.getElementById("streamkeys-banner");
  if (existing) {
    existing.remove();
    const timeout = getBannerTimeout();
    if (timeout) {
      clearTimeout(timeout);
    }
  }

  const banner = document.createElement("div");
  banner.id = "streamkeys-banner";
  banner.textContent = message;
  banner.style.cssText = `
    position: fixed;
    bottom: 40%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 20px 40px;
    border-radius: 10px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 22px;
    font-weight: 600;
    z-index: 2147483647;
    pointer-events: none;
    opacity: 1;
    transition: opacity ${BANNER_FADE_DURATION}ms ease-out;
  `;

  document.body.appendChild(banner);

  // Fade out after delay
  const timeout = setTimeout(() => {
    banner.style.opacity = "0";
    setTimeout(() => banner.remove(), BANNER_FADE_DURATION);
  }, BANNER_FADE_DELAY);

  setBannerTimeout(timeout);
}
