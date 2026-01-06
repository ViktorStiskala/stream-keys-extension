(() => {
    function escapeHtml(s) {
      return s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }
  
    function serialize(node) {
      // Text node
      if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.nodeValue ?? "");
      // Comment
      if (node.nodeType === Node.COMMENT_NODE) return `<!--${node.nodeValue ?? ""}-->`;
      // Document
      if (node.nodeType === Node.DOCUMENT_NODE) return serialize(node.documentElement);
  
      // Element
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = /** @type {Element} */ (node);
        const tag = el.tagName.toLowerCase();
  
        // Attributes
        const attrs = [...el.attributes]
          .map(a => ` ${a.name}="${escapeHtml(a.value)}"`)
          .join("");
  
        // Children (light DOM)
        let inner = "";
        for (const child of el.childNodes) inner += serialize(child);
  
        // Shadow DOM (open only)
        if (/** @type {any} */ (el).shadowRoot) {
          const sr = /** @type {any} */ (el).shadowRoot;
          inner += `<template shadowroot="open">`;
          for (const child of sr.childNodes) inner += serialize(child);
          inner += `</template>`;
        }
  
        return `<${tag}${attrs}>${inner}</${tag}>`;
      }
  
      return "";
    }
  
    const html = "<!doctype html>\n" + serialize(document);
    copy(html);
    return "Copied flattened DOM (open shadow roots only) to clipboard.";
  })();