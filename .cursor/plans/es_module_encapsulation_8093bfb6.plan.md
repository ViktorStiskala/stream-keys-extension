---
name: ES Module Encapsulation
overview: Refactor all src/ modules to use ES module encapsulation pattern with namespace-like exported const objects for the public API and non-exported private functions.
todos:
  - id: core-modules
    content: Refactor src/core/ modules (debug, focus, fullscreen, player, settings, video)
    status: completed
  - id: features-modules
    content: Refactor src/features/ modules (keyboard, subtitles, restore-position/*)
    status: completed
  - id: ui-modules
    content: Refactor src/ui/ modules (banner, overlay, styles/variables)
    status: completed
  - id: handlers-modules
    content: Refactor src/handlers/ modules (factory, types)
    status: completed
  - id: services-modules
    content: Refactor src/services/ modules (disney, hbomax)
    status: completed
  - id: entry-points
    content: Refactor entry point modules (background, settings page)
    status: completed
  - id: barrel-exports
    content: Update all barrel export files (index.ts)
    status: completed
  - id: update-consumers
    content: Update all import statements and usages across codebase
    status: completed
  - id: run-checks
    content: Run npm run check to verify all linting and type checks pass
    status: completed
---

# ES Module Encapsulation Refactoring

Transform all `src/` modules to use namespace-like const objects as public API while keeping helper functions private.

## Pattern Applied

```typescript
// Private to module
function helperFunction() { ... }

// Types exported with namespace prefix
export interface FocusConfig { ... }

// Public API
export const Focus = {
  player: focusPlayer,
  createMouseMoveHandler,
};
```

## Files to Modify

### Core Modules ([`src/core/`](src/core/))

| File | Export Object | Methods |

|------|---------------|---------|

| [`debug.ts`](src/core/debug.ts) | `Debug` | `log` |

| [`focus.ts`](src/core/focus.ts) | `Focus` | `player`, `createMouseMoveHandler` |

| [`fullscreen.ts`](src/core/fullscreen.ts) | `Fullscreen` | `getElement`, `createHandler`, `setupListeners` |

| [`player.ts`](src/core/player.ts) | `Player` | `setup`, `createSetupInterval` |

| [`settings.ts`](src/core/settings.ts) | `Settings` | `get`, `getSubtitlePreferences`, `isPositionHistoryEnabled` |

| [`video.ts`](src/core/video.ts) | `Video` | `createGetter`, `formatTime`, `formatRelativeTime` |

### Features Modules ([`src/features/`](src/features/))

| File | Export Object | Methods |

|------|---------------|---------|

| [`keyboard/index.ts`](src/features/keyboard/index.ts) | `Keyboard` | `init` |

| [`subtitles/index.ts`](src/features/subtitles/index.ts) | `Subtitles` | `init` |

| [`restore-position/index.ts`](src/features/restore-position/index.ts) | `RestorePosition` | `init` |

| [`restore-position/history.ts`](src/features/restore-position/history.ts) | `PositionHistory` | `createState`, `save`, `record`, `getPositions`, `setupTracking` |

| [`restore-position/dialog.ts`](src/features/restore-position/dialog.ts) | `RestoreDialog` | `create`, `close`, `isOpen`, `restore`, `handleKeys` |

| [`restore-position/styles.ts`](src/features/restore-position/styles.ts) | `DialogStyles` | (already a const object, rename export) |

### UI Modules ([`src/ui/`](src/ui/))

| File | Export Object | Methods |

|------|---------------|---------|

| [`banner.ts`](src/ui/banner.ts) | `Banner` | `show`, `cleanup` |

| [`overlay.ts`](src/ui/overlay.ts) | `Overlay` | `createClick`, `removeClick` |

| [`styles/variables.ts`](src/ui/styles/variables.ts) | `Styles` | `vars`, `createString` |

### Handler Modules ([`src/handlers/`](src/handlers/))

| File | Export Object | Methods |

|------|---------------|---------|

| [`factory.ts`](src/handlers/factory.ts) | `Handler` | `create` |

| [`types.ts`](src/handlers/types.ts) | Types only - keep as named exports |

### Service Modules ([`src/services/`](src/services/))

| File | Export Object | Methods |

|------|---------------|---------|

| [`disney.ts`](src/services/disney.ts) | `DisneyHandler` | `init` |

| [`hbomax.ts`](src/services/hbomax.ts) | `HboMaxHandler` | `init` |

### Entry Point Modules (minimal changes)

- [`background/index.ts`](src/background/index.ts) - Side-effect module, wrap internal helpers in `Background` namespace
- [`settings/index.ts`](src/settings/index.ts) - Side-effect module, wrap in `SettingsPage` namespace

### Barrel Exports (update re-exports)

- [`src/core/index.ts`](src/core/index.ts) - Re-export namespace objects
- [`src/features/index.ts`](src/features/index.ts) - Re-export namespace objects
- [`src/ui/index.ts`](src/ui/index.ts) - Re-export namespace objects
- [`src/handlers/index.ts`](src/handlers/index.ts) - Re-export namespace objects

## Type Export Strategy

Types cannot be placed inside runtime const objects. They will be exported as named exports with namespace-consistent naming:

- `FocusConfig` alongside `Focus`
- `VideoGetterConfig` alongside `Video`
- etc.

## Consumer Code Updates

All imports across the codebase will be updated:

```typescript
// Before
import { focusPlayer, createMouseMoveHandler } from '@/core/focus';

// After  
import { Focus } from '@/core/focus';
// Usage: Focus.player(config), Focus.createMouseMoveHandler(config)
```