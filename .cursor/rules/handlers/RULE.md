---
description: StreamKeys Extension - Handler Configuration
alwaysApply: true
---

# Handler Configuration with Feature Flags

Service handlers provide a config object to `createHandler()`:

@scripts/handler-template.ts

## Required Config Properties

- `name`: Display name for the service (used in logs)
- `getPlayer`: Function returning the player container element
- `getButton`: Function mapping key codes to control buttons

## Optional Config Properties

- `setupPlayerFocus`: Custom focus handling logic
- `onPlayerSetup`: Callback when player is initialized
- `getOverlayContainer`: Container element for click overlay
- `subtitles`: Subtitle control configuration object

## Feature Flags

All features are enabled by default. Set to `false` to disable:

- `subtitles`: Automatic subtitle language selection
- `restorePosition`: Position history and restore dialog
- `keyboard`: Keyboard shortcut handling
- `fullscreenOverlay`: Click overlay for fullscreen mode
