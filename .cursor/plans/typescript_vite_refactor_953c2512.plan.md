---
name: TypeScript Vite Refactor
overview: Rewrite the StreamKeys extension using TypeScript and Vite with a modular, composable architecture that separates features into independent modules, allowing sites to use only the functionality they need.
todos:
  - id: setup-toolchain
    content: Set up Vite + TypeScript toolchain with vite-plugin-web-extension (Chrome-only)
    status: completed
  - id: reorganize-rules
    content: Move and split Cursor rules into src/ subdirectories with proper globs
    status: completed
  - id: extract-types
    content: Create type definitions in src/types/index.ts
    status: completed
  - id: extract-ui
    content: "Extract UI utilities: banner.ts, overlay.ts, and CSS variables"
    status: completed
  - id: extract-core
    content: "Extract core utilities: settings.ts, video.ts, focus.ts, fullscreen.ts, player.ts"
    status: completed
  - id: extract-restore
    content: Extract Restore Position feature as independent module
    status: completed
  - id: extract-subtitles
    content: Extract Subtitles feature as independent module
    status: completed
  - id: extract-keyboard
    content: Extract Keyboard feature with configurable key bindings
    status: completed
  - id: create-factory
    content: Create composable handler factory with feature flags
    status: completed
  - id: migrate-handlers
    content: Migrate Disney+ and HBO Max handlers to TypeScript
    status: completed
  - id: migrate-settings
    content: Migrate settings page to TypeScript
    status: completed
  - id: migrate-background
    content: Migrate background service worker to TypeScript
    status: completed
  - id: cleanup-build
    content: Remove Makefile, update CI for Vite builds
    status: completed
---

# TypeScript + Vite Extension Refactor

## Current State

The extension has 910 lines in [`handlers/base.js`](handlers/base.js) with tightly coupled functionality:

- Banner notifications, subtitle toggle, position restore (~475 lines), keyboard handling, focus management, fullscreen handling, and player setup all in one file
- Inline CSS styles with hardcoded colors scattered throughout
- No ability to use only parts of functionality

## Proposed Architecture

### Project Structure

```
stream-keys/
├── src/
│   ├── background/
│   │   └── index.ts              # Service worker router
│   ├── features/
│   │   ├── restore-position/
│   │   │   ├── .cursor/rules/restore-position.mdc
│   │   │   ├── index.ts          # Public API (initPositionRestore)
│   │   │   ├── dialog.ts         # Restore dialog UI
│   │   │   ├── history.ts        # Position history state machine
│   │   │   └── styles.ts         # Dialog styles
│   │   ├── subtitles/
│   │   │   └── index.ts          # Subtitle toggle (initSubtitles)
│   │   └── keyboard/
│   │       └── index.ts          # Key capture logic (initKeyboard)
│   ├── ui/
│   │   ├── banner.ts             # showBanner() utility
│   │   ├── overlay.ts            # Click overlay for fullscreen exit
│   │   └── styles/
│   │       └── variables.ts      # Shared CSS variables
│   ├── core/
│   │   ├── .cursor/rules/core.mdc
│   │   ├── focus.ts              # Focus management utilities
│   │   ├── fullscreen.ts         # Fullscreen change handling
│   │   ├── player.ts             # Player detection & setup
│   │   ├── video.ts              # Video element utilities
│   │   └── settings.ts           # Settings access
│   ├── handlers/
│   │   ├── .cursor/rules/        # Handler-specific rules
│   │   │   ├── disney.mdc        # Disney+ selectors & Shadow DOM notes
│   │   │   └── hbomax.mdc        # HBO Max selectors & DOM notes
│   │   ├── types.ts              # Handler config types
│   │   ├── factory.ts            # createHandler() with feature composition
│   │   ├── disney.ts
│   │   └── hbomax.ts
│   ├── settings/
│   │   ├── index.ts              # Settings page logic
│   │   └── settings.css          # Already has CSS variables
│   └── types/
│       └── index.ts              # Shared type definitions
├── .cursor/rules/
│   └── general.mdc               # General project conventions (updated)
├── vite.config.ts
├── tsconfig.json
├── package.json
└── manifest.json
```

### Cursor Rules Organization

**Root rule** (`.cursor/rules/general.mdc`) - General conventions:

- Project structure overview
- TypeScript conventions
- Logging format
- Build commands

**Handler rules** (`src/handlers/.cursor/rules/*.mdc`) - Service-specific:

- DOM selectors for each streaming service
- Shadow DOM patterns (Disney+)
- Focus management specifics
- Subtitle menu selectors

**Core rules** (`src/core/.cursor/rules/core.mdc`) - Browser APIs:

- Keyboard event capture strategy
- Fullscreen exit focus issue workaround
- Script injection patterns

**Feature rules** (`src/features/restore-position/.cursor/rules/restore-position.mdc`):

- Position history algorithm
- Debounce logic for seek tracking
- Dialog state management

### CSS Variables System

Create a shared variables module (`src/ui/styles/variables.ts`):

```typescript
export const cssVars = {
  overlay: {
    bg: 'rgba(0, 0, 0, 0.9)',
    bgLight: 'rgba(0, 0, 0, 0.6)',
    border: 'rgba(255, 255, 255, 0.2)',
    borderLight: 'rgba(255, 255, 255, 0.1)',
  },
  text: {
    primary: 'white',
    secondary: 'rgba(255, 255, 255, 0.6)',
    muted: 'rgba(255, 255, 255, 0.5)',
  },
  zIndex: {
    max: 2147483647,
  },
  font: {
    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  timing: {
    bannerFade: 1500,
    fadeTransition: 300,
  },
} as const;
```

### Composable Handler Factory

The new `createHandler()` accepts feature flags:

```typescript
interface HandlerConfig {
  name: string;
  getPlayer: () => HTMLElement | null;
  getButton?: (keyCode: string) => HTMLElement | null;
  // ... other service-specific methods
  
  // Feature flags (all true by default for backwards compatibility)
  features?: {
    subtitles?: boolean;
    restorePosition?: boolean;
    keyboard?: boolean;
    fullscreenOverlay?: boolean;
  };
}
```

Usage for a site that only needs position restore:

```typescript
createHandler({
  name: 'SomeService',
  getPlayer: () => document.querySelector('.player'),
  features: {
    restorePosition: true,
    subtitles: false,
    keyboard: false,
  }
});
```

### Build Configuration

Chrome-only build using Vite with `vite-plugin-web-extension` (Firefox support can be added later by setting `BROWSER` env var):

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
  plugins: [
    webExtension({
      manifest: 'manifest.json',
    }),
  ],
  build: {
    outDir: 'build/chrome/extension',
  },
});
```

**package.json scripts:**

```json
{
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "build:firefox": "BROWSER=firefox vite build"
  }
}
```

### Key Type Definitions

```typescript
// src/types/index.ts
export interface SubtitleItem {
  label: string;
  element: HTMLElement;
  inputId?: string;
}

export interface SubtitleConfig {
  getAvailable: () => SubtitleItem[];
  getCurrentState: () => boolean;
  turnOff: () => void;
  selectLanguage: (item: SubtitleItem) => void;
}

export interface PositionEntry {
  time: number;
  label: string;
  savedAt: number;
}

export interface StreamKeysSettings {
  subtitleLanguages: string[];
  positionHistoryEnabled: boolean;
}
```

## Migration Strategy

1. Set up Vite + TypeScript toolchain (Chrome-only)
2. Reorganize Cursor rules into nested directories under `src/`
3. Extract shared utilities first (`ui/banner.ts`, `core/video.ts`, etc.)
4. Extract Position Restore as standalone feature module
5. Extract Subtitles and Keyboard features
6. Rebuild handler factory with composition
7. Migrate service handlers (disney, hbomax)
8. Migrate settings page and background script
9. Remove old Makefile-based build