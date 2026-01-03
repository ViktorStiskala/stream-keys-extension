---
description: BBC iPlayer streaming service handler - Nested Shadow DOM traversal and Player Controls. Apply when user mentions BBC, BBC iPlayer, or iPlayer streaming.
globs:
  - "**/bbc.ts"
  - "**/services/bbc*"
  - "**/handlers/bbc*"
  - "resources/dom/bbc*"
---

# BBC iPlayer Handler Notes

## Deeply Nested Shadow DOM

BBC iPlayer's SMP (Standard Media Player) uses web components with **deeply nested shadow DOM** - elements are 4-5 levels deep. Standard `document.querySelector()` cannot find these elements.

### Shadow DOM Structure

```
document
└── smp-toucan-player [shadow root]
    ├── smp-playback [shadow root]
    │   └── video
    └── smp-video-layout [shadow root]
        ├── smp-core-controls [shadow root]
        │   ├── smp-play-pause-button [shadow root] → button
        │   ├── smp-interval-button.backward_interval [shadow root] → button
        │   └── smp-interval-button.forward_interval [shadow root] → button
        └── smp-secondary-controls [shadow root]
            └── smp-subtitles-settings-panel [shadow root]
                └── smp-toggle.subs_toggle [shadow root]
                    └── .toggle (clickable div with aria-checked)
```

### Shadow Patcher Requirement

BBC uses `attachShadow({ mode: 'closed' })` for some components. The shadow patcher (`src/shadow-patcher.ts`) must be injected at `document_start` to intercept and store shadow root references.

Configuration in `manifest.json`:
```json
"content_scripts": [
  {
    "matches": ["https://*.bbc.co.uk/*"],
    "js": ["src/shadow-patcher.js"],
    "run_at": "document_start",
    "world": "MAIN"
  }
]
```

### Traversal Helpers

The handler uses two key helpers to navigate the nested shadow DOM:

**`getShadowRoot(element)`** - Gets shadow root using patcher or native fallback:
```typescript
function getShadowRoot(element: Element | null): ShadowRoot | null {
  if (!element) return null;
  return window.__getShadowRoot?.(element) ?? element.shadowRoot ?? null;
}
```

**`getNestedShadow(root, ...selectors)`** - Traverses multiple shadow root levels:
```typescript
function getNestedShadow(
  root: Document | ShadowRoot,
  ...selectors: string[]
): ShadowRoot | null {
  let parent: Document | ShadowRoot = root;
  for (const selector of selectors) {
    const element = parent.querySelector(selector);
    const shadow = getShadowRoot(element);
    if (!shadow) return null;
    parent = shadow;
  }
  return parent as ShadowRoot;
}
```

## Video Element

Path: `toucan [shadow] → playback [shadow] → video`

```typescript
const playbackShadow = getNestedShadow(document, 'smp-toucan-player', 'smp-playback');
const video = playbackShadow?.querySelector<HTMLVideoElement>('video');
```

## Control Buttons

Path: `toucan [shadow] → video-layout [shadow] → core-controls [shadow] → target [shadow] → button`

```typescript
const controlsShadow = getNestedShadow(
  document,
  'smp-toucan-player',
  'smp-video-layout',
  'smp-core-controls'
);
const playPauseElement = controlsShadow?.querySelector('smp-play-pause-button');
const playPauseShadow = getShadowRoot(playPauseElement);
const button = playPauseShadow?.querySelector('button');
```

### Available Button Selectors (inside core-controls shadow)

- Play/Pause: `smp-play-pause-button`
- Skip Back: `smp-interval-button.backward_interval`
- Skip Forward: `smp-interval-button.forward_interval`
- Fullscreen: `smp-fullscreen-button`

## Subtitles Toggle

BBC iPlayer has a **simple on/off toggle** for subtitles - no language selection.

**Important:** The subtitle feature (`src/features/subtitles/index.ts`) automatically handles single-option toggles. When `getAvailable()` returns only one item, it skips language preference matching and directly toggles that option. This means BBC subtitles work regardless of what languages the user has configured in their preferences.

**Critical:** The `smp-toggle` custom element requires clicking the **`.toggleSlot`** element inside its shadow DOM. Neither the host element nor the `.toggle` div handle click events - only `.toggleSlot` (which has `cursor: pointer` in CSS) is interactive.

- **For clicking**: `.toggleSlot` inside `smp-toggle.subs_toggle`'s shadow DOM
- **For state**: Inner `.toggle` div's `aria-checked` attribute

Path to toggle shadow: `toucan [shadow] → video-layout [shadow] → secondary-controls [shadow] → subtitles-settings-panel [shadow] → smp-toggle.subs_toggle [shadow]`

Inside the toggle shadow:
- `.toggle` - toggle element with `role="checkbox"` and `aria-checked` for state
- `.toggleSlot` - visual styling only (has `cursor: pointer`)

**Critical:** BBC's toggle does NOT respond to `.click()`. It requires **pointer events**:
```typescript
element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
```

```typescript
// Get the smp-toggle's shadow root (shared by click and state functions)
function getSubtitlesToggleShadow(): ShadowRoot | null {
  const secondaryControlsShadow = getNestedShadow(
    document,
    'smp-toucan-player',
    'smp-video-layout',
    'smp-secondary-controls'
  );
  const settingsPanel = secondaryControlsShadow?.querySelector('smp-subtitles-settings-panel');
  const settingsPanelShadow = getShadowRoot(settingsPanel);
  const subsToggle = settingsPanelShadow?.querySelector('smp-toggle.subs_toggle');
  return getShadowRoot(subsToggle);
}

// Get the toggle element (used for both state and clicking)
function getSubtitlesToggle(): HTMLElement | null {
  return getSubtitlesToggleShadow()?.querySelector<HTMLElement>('.toggle') ?? null;
}

// Click using pointer events (BBC's toggle doesn't respond to .click())
function clickSubtitleToggle(): void {
  const toggle = getSubtitlesToggle();
  if (!toggle) return;
  toggle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  toggle.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
}

// Get inner element for state
function getSubtitlesToggleState(): HTMLElement | null {
  const host = getSubtitlesToggleHost();
  const toggleShadow = getShadowRoot(host);
  return toggleShadow?.querySelector<HTMLElement>('.toggle') ?? null;
}
```

Check state: `getSubtitlesToggle()?.getAttribute('aria-checked') === 'true'`

Toggle: `clickSubtitleToggle()` (uses pointer events, not `.click()`)

## Player Element

For focus handling, the handler returns `smp-video-layout` (inside toucan's shadow root):

```typescript
const toucan = document.querySelector('smp-toucan-player');
const toucanShadow = getShadowRoot(toucan);
const player = toucanShadow?.querySelector('smp-video-layout');
```

## Focus Management

**Critical:** BBC's `setupPlayerFocus` must NOT steal focus from elements inside the player's shadow DOM tree. This prevents UI panels (like the subtitle settings dialog) from closing unexpectedly.

The mouse move handler calls `setupPlayerFocus` when the user hovers over the player. Without the focus check, this would:
1. User opens subtitle settings panel
2. User moves mouse (hover triggers `setupPlayerFocus`)
3. `player.focus()` steals focus from panel elements
4. BBC detects focus loss and closes the panel

**Solution:** Check if focus is already inside the toucan player tree before calling `focus()`:

```typescript
setupPlayerFocus: (player: HTMLElement) => {
  player.setAttribute('tabindex', '-1');

  // Don't steal focus if already inside the player's shadow DOM tree
  const activeElement = document.activeElement;
  if (activeElement) {
    const toucan = document.querySelector('smp-toucan-player');
    if (toucan && (toucan === activeElement || toucan.contains(activeElement))) {
      return;
    }
  }

  player.focus();
}
```

## Seeking

BBC iPlayer uses standard HTML5 video, so `video.currentTime` works correctly:
- **Relative seeks**: Direct `video.currentTime += delta` (no custom `seekByDelta` needed)
- **Absolute seeks**: Direct `video.currentTime = time` (no custom `seekToTime` needed)
- **Custom seek time**: Works with keyboard shortcuts and media keys

## SPA Navigation

BBC iPlayer uses SPA navigation. The handler is injected on URLs matching `bbc.co.uk/iplayer`. The background script handles both:
- `webNavigation.onCompleted` - initial page load
- `webNavigation.onHistoryStateUpdated` - SPA navigation

## Dynamic Player Loading

**Important:** The player elements (`smp-toucan-player`, `smp-playback`, etc.) do NOT exist when the episode page first loads. They are created dynamically when the user clicks "Play" on the episode.

The handler factory's polling mechanism (`BUTTON_INTERCEPTION_INTERVAL`) will find the elements once they appear.

## DOM Reference

**Important:** Always consult the DOM fixtures when implementing any DOM-related changes.

### Available Fixtures

- `resources/dom/bbc.html` - Normal (non-fullscreen) player state
- `resources/dom/bbc_full.html` - Fullscreen player state

### Capture Method

The fixtures were captured using a Shadow DOM flattening script that serializes the DOM with shadow roots inlined as `<template shadowroot="open">` elements:

```javascript
(() => {
  function escapeHtml(s) {
    return s
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function serialize(node) {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.nodeValue ?? "");
    if (node.nodeType === Node.COMMENT_NODE) return `<!--${node.nodeValue ?? ""}-->`;
    if (node.nodeType === Node.DOCUMENT_NODE) return serialize(node.documentElement);

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node;
      const tag = el.tagName.toLowerCase();
      const attrs = [...el.attributes]
        .map(a => ` ${a.name}="${escapeHtml(a.value)}"`)
        .join("");

      let inner = "";
      for (const child of el.childNodes) inner += serialize(child);

      // Inline open shadow roots
      if (el.shadowRoot) {
        inner += `<template shadowroot="open">`;
        for (const child of el.shadowRoot.childNodes) inner += serialize(child);
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
```

**Note:** The script only captures **open** shadow roots. BBC iPlayer uses **closed** shadow roots for some components, which will appear empty in the fixture. These require the shadow patcher (`src/shadow-patcher.ts`) at runtime.

### Fullscreen Considerations

In fullscreen mode, UI elements (like restore dialogs or banners) must be appended **inside** the Shadow DOM to be visible. The player's Shadow DOM creates a new stacking context that covers the entire viewport.

For the restore dialog, the handler provides `getDialogContainer()` which returns `.video_layout_outer_container` inside `smp-video-layout`'s shadow root - this ensures the dialog appears above the video in fullscreen.

## Testing

### Test File Location

Tests would be co-located at `src/services/bbc.test.ts`.

### Internal Functions for Testing

The `BBCHandler` exports a `_test` object with internal functions:
```typescript
BBCHandler._test.getPlayer()                // Get video-layout element
BBCHandler._test.getVideo()                 // Get video element
BBCHandler._test.getButton(code)            // Get button for key code
BBCHandler._test.getSeekButtons()           // Get backward/forward buttons
BBCHandler._test.getShadowButton(sel)       // Get button from nested shadow DOM
BBCHandler._test.getShadowRoot(el)          // Get shadow root (patcher or native)
BBCHandler._test.getNestedShadow(...)       // Traverse nested shadow DOM
BBCHandler._test.getSubtitlesToggleShadow() // Get smp-toggle's shadow root
BBCHandler._test.getSubtitlesToggle()       // Get .toggle element (state + click target)
BBCHandler._test.clickSubtitleToggle()      // Toggle using pointer events
BBCHandler._test.subtitles                  // Subtitle config object
```

### Shadow DOM Testing Challenges

Testing BBC iPlayer's nested shadow DOM is challenging because:
1. jsdom doesn't fully support Shadow DOM
2. Multiple levels of shadow roots need mocking
3. The shadow patcher needs to be simulated

Consider using the real DOM fixture from `resources/dom/bbc.html` with custom shadow root mocking.
