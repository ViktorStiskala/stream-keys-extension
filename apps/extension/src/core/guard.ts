// Initialization guard utilities

/**
 * Create an initialization guard for a service handler.
 * Uses HTML element attribute for atomic check-and-set across script contexts.
 * @param serviceName - The service name (e.g., 'disney', 'hbomax')
 * @returns A function that returns true if init should be skipped (already initialized)
 */
function createInitGuard(serviceName: string): () => boolean {
  const attr = `data-streamkeys-${serviceName}`;
  return () => {
    const html = document.documentElement;
    if (html.hasAttribute(attr)) {
      return true;
    }
    html.setAttribute(attr, '1');
    return false;
  };
}

// Public API
export const Guard = {
  create: createInitGuard,
};
