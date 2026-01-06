/**
 * Interactive keyboard key effect
 * Creates a "thump" animation on click with a flying key clone
 */

function initInteractiveKeys(): void {
  const keys = document.querySelectorAll<HTMLElement>("[data-interactive]");

  keys.forEach((key) => {
    key.style.cursor = "pointer";
    key.addEventListener("click", handleKeyClick);
  });
}

function handleKeyClick(e: MouseEvent): void {
  const key = e.currentTarget as HTMLElement;
  const wrapper = key.closest(".keyboard-key-wrapper");
  if (!wrapper) return;

  // Determine click direction relative to key center (proportional)
  const rect = key.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const centerX = rect.width / 2;
  // Calculate proportional direction: -1 (far right click) to 1 (far left click)
  // Clicking center = 0, clicking edges = ±1
  const direction = -((clickX - centerX) / centerX);

  // Trigger thump animation
  key.classList.remove("keyboard-key--thumping");
  // Force reflow to restart animation if clicked rapidly
  void key.offsetWidth;
  key.classList.add("keyboard-key--thumping");

  // Create flying clone
  const clone = key.cloneNode(true) as HTMLElement;
  clone.removeAttribute("data-interactive");
  clone.classList.remove("keyboard-key--thumping");
  clone.classList.add("keyboard-key--flying");
  // Set direction as CSS custom property
  clone.style.setProperty("--fly-direction", String(direction));
  wrapper.appendChild(clone);

  // Cleanup after animation
  clone.addEventListener("animationend", () => clone.remove());
}

// Initialize on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initInteractiveKeys);
} else {
  initInteractiveKeys();
}
