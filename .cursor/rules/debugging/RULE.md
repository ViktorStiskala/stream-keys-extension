---
description: StreamKeys Extension - Debug Logging
alwaysApply: true
---

# Debug Logging

## Accessing Debug Logs (For AI/Cursor Debugging)

**When debugging issues with the extension running in dev mode (`npm run dev`), read the debug log file:**

```
.cursor/debug.log
```

This file contains all `console.log/warn/error` output from the extension running in the browser. It's automatically updated in real-time when dev mode is active.

**Use this when:**
- User reports runtime behavior issues
- Need to trace execution flow
- Debugging timing or state issues
- Checking if code paths are being executed

**Interactive debugging workflow:**
1. Ask user to run `npm run dev` (or `npm run dev:firefox`)
2. Ask user to reproduce the issue (e.g., "seek to a position, then rapidly click forward")
3. Ask user to confirm when done
4. Read `.cursor/debug.log` to see the execution trace and identify the issue

**Example log output:**
```
[StreamKeys] HBO Max extension loaded at 2025-12-11T01:37:39.848Z
[StreamKeys] Video seek listener added
[StreamKeys] Load time position captured: 52:46
[StreamKeys] Ready to track seeks
[StreamKeys] Seek position saved: 55:08
```

## Console Forwarding for Dev Mode

**All service handlers in `src/services/` MUST initialize console forwarding at the top of the file:**

@scripts/console-forwarding.ts

This forwards all `console.log/warn/error` from the page context to the Vite dev server, which writes them to `.cursor/debug.log`. Without this, browser console logs won't appear in the debug log file.

**Why each service needs this:** Service handlers run in the MAIN world of the page (not the service worker), so each service needs to initialize its own console forwarding.

## Debug API

- `Debug.log(...)` - Logs with `[StreamKeys]` prefix and forwards to dev server
- `Debug.initConsoleForward()` - Patches console.log/warn/error to forward to dev server

## Dead Code Elimination

**All debug calls MUST be wrapped in `if (__DEV__)` blocks** to ensure they are completely removed from production builds:

@scripts/debug-usage.ts

When `__DEV__` is `false`, Vite + terser removes the entire `if` block including:
- The condition check
- The function calls
- Argument evaluation

## Logging Convention

- `console.info('[StreamKeys] ...')` - Extension loaded messages
- `console.warn('[StreamKeys] ...')` - Button not found or other recoverable issues
