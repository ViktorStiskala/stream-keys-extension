/**
 * Scroll to anchor on page load
 * Handles cases where the browser doesn't natively scroll to the hash target
 */

if (window.location.hash) {
  const target = document.querySelector(window.location.hash);
  if (target) {
    target.scrollIntoView();
  }
}
