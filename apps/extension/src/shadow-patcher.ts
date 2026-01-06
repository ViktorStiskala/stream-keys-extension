// Shadow DOM Patcher - Intercepts attachShadow to store references to closed shadow roots
// Must be injected at document_start before page JavaScript runs

const shadowRoots = new WeakMap<Element, ShadowRoot>();

const originalAttachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
  const shadowRoot = originalAttachShadow.call(this, init);
  shadowRoots.set(this, shadowRoot);
  return shadowRoot;
};

// Expose retrieval function for handlers
window.__getShadowRoot = (element: Element) => shadowRoots.get(element);
