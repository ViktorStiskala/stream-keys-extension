---
description: Debug StreamKeys extension issues using runtime logs
---

# Debug Extension Issue

Read the debug log from the last dev mode session and analyze the issue described by the user.

## Instructions

1. Read the debug log file at `.cursor/debug.log`
2. Analyze the log output in context of the user's issue description
3. Look for:
   - Error messages or warnings
   - Missing expected log entries (code paths not executed)
   - Timing issues or unexpected execution order
   - State inconsistencies
   - **User actions** (prefixed with `[Action]`) to understand what the user did
4. Identify the root cause and propose a fix

## Context

The debug log contains all `console.log/warn/error` output from the extension running in dev mode (`npm run dev`). Each log entry from StreamKeys is prefixed with `[StreamKeys]`.

### Provider Detection

The log shows which streaming provider is being used. Look for:
- `injecting handler=src/services/<provider>.js` in WebNavigation events
- `[StreamKeys] <Provider> extension loaded` message

**When you identify the provider, add the following to context:**
- Provider-specific rules: `src/services/.cursor/rules/<provider>/RULE.md` (e.g., `src/services/.cursor/rules/disney/RULE.md` for Disney+)
- Service handler file: `src/services/<provider>.ts`
- Handler configuration patterns: `.cursor/rules/handlers/RULE.md`

### Settings

The extension settings are logged at startup as a JSON object:
```
[StreamKeys] Settings: {"captureMediaKeys":true,"customSeekEnabled":true,"seekTime":120,...}
```

Use these to understand the user's configuration when debugging issues.

### Log Timing

The log output includes **microsecond-precision timestamps**. This allows you to:
- See how fast buttons were pressed after each other (e.g., rapid arrow key presses)
- Measure delays between user actions and system responses
- Identify timing-related issues (race conditions, debouncing problems)

### User Action Logs

User actions are logged with the `[Action]` prefix and include:
- **Key presses**: `Key: ArrowLeft`, `Key: Space`, `Key: C`, etc.
- **UI button clicks**: `UI: forward button`, `UI: backward button`, `UI: Close button`
- **Timeline clicks**: `UI: Timeline click`
- **Media keys**: `Media key: Play`, `Media key: Pause`, `Media key: Previous track`, `Media key: Next track`
- **Dialog interactions**: Position selection, restore dialog open/close
- **Subtitle toggles**: `Subtitles: On/Off`

Use these action logs to reconstruct what the user did and correlate with other log entries to understand the system's response.
