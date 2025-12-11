---
description: StreamKeys Extension - ES Module Encapsulation Pattern
alwaysApply: true
---

# ES Module Encapsulation Pattern

**All modules in `src/` MUST use the namespace-like const object pattern for public APIs. NO EXCEPTIONS.**

## Pattern Structure

@scripts/module-template.ts

## Rules

1. **Private functions**: Helper functions that are only used within the module MUST NOT be exported. Keep them as regular function declarations.

2. **Public API**: All public functionality MUST be exposed through a single exported const object named after the module's purpose (e.g., `Focus`, `Player`, `Keyboard`, `Banner`).

3. **Types**: TypeScript interfaces and types cannot be placed inside runtime const objects. Export them as named exports alongside the namespace object.

4. **Naming**: The const object should use PascalCase and represent the module's domain (e.g., `Video`, `Fullscreen`, `RestoreDialog`).

## Examples

```typescript
// src/core/focus.ts
function setupFocusListeners(element: HTMLElement) { ... }  // Private

export interface FocusConfig { ... }  // Type export

export const Focus = {
  player: focusPlayer,
  createMouseMoveHandler,
};
```

```typescript
// src/features/keyboard/index.ts
function handleKeyDown(e: KeyboardEvent) { ... }  // Private
function getButtonForKey(key: string) { ... }     // Private

export const Keyboard = {
  init: initKeyboard,
};
```

## Consuming Modules

```typescript
// Import the namespace object
import { Focus } from '@/core/focus';
import { Keyboard } from '@/features/keyboard';

// Use via namespace
Focus.player(config);
Keyboard.init(player);
```

**This pattern ensures consistent API design, clear public/private boundaries, and better code organization across the entire codebase.**
