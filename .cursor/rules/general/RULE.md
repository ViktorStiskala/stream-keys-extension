---
description: StreamKeys Extension - General Development Notes
alwaysApply: true
---

# StreamKeys Extension Development Notes

## Cursor Rules

This project uses cursor rules located under `.cursor/rules/` folders and nested rules in `src/` folder for individual
modules. **Always check and update** relevant rule files after introducing changes, to make sure they contain relevant
information, and crucial rules for new code.

### Service-specific Rules

When the prompt mentions a specific streaming provider, **always load the corresponding rules**:
- **Disney+, Disney Plus, Disney** → `src/services/.cursor/rules/disney/RULE.md`
- **HBO Max, HBO, Max** → `src/services/.cursor/rules/hbomax/RULE.md`
- **YouTube** → `src/services/.cursor/rules/youtube/RULE.md`
- **BBC, BBC iPlayer, iPlayer** → `src/services/.cursor/rules/bbc/RULE.md`

These rules contain critical DOM selectors, Shadow DOM access patterns, and service-specific quirks that must be followed.

## Cursor Rules Maintenance

Cursor rules must stay in sync with the implementation. This applies:

1. **When adding new features**: Document new options in the relevant rule file with default values and usage examples
2. **When modifying existing code**: If you read a source file and notice the relevant Cursor rule contains outdated or incorrect information, update the rule to match the current implementation
3. **When refactoring**: Update rules to reflect new patterns, renamed functions, or changed behavior

The agent should proactively check and update rules whenever it reads source files that have associated rules.

**Important:** All rule updates must follow the "Cursor Rules Management" policy below - additions are allowed, but removals or significant modifications require user confirmation.

## Cursor Rules Management

- **Never remove or significantly modify existing rules** without explicit user confirmation
- When rules appear outdated, ASK the user before making changes - the agent may lack full context
- Only add new rules or make minor clarifications without asking

## Code Quality Requirements

**After changes to source code in `src/`, run linters and tests before completing the task.**

### Hard constraint: `npm *` must run outside sandbox

**All `npm` commands (anything starting with `npm`, e.g. `npm run check`, `npm test`, `npm ci`) MUST be executed without sandbox restrictions** because toolchains commonly need unrestricted access to `node_modules/` and system tooling. In Cursor tool calls, this means:

- Use `required_permissions: ['all']` for `npm *` terminal commands.
- If an `npm` command fails with `EPERM`/permission errors, rerun it with `required_permissions: ['all']` immediately.

Run `npm run check` to verify:
- TypeScript type checking (`npm run typecheck`)
- ESLint linting (`npm run lint`)
- Prettier formatting (`npm run format:check`)

Run `npm test` to verify all tests pass.

Use `npm run lint:fix` and `npm run format` to auto-fix issues.

**Note:** These checks are NOT required for non-code changes like README updates, cursor rules, documentation, or configuration files outside `src/`.

## TypeScript Conventions

- Use strict mode
- Export types from `@/types`
- Use CSS variables from `@/ui/styles/variables`
- Prefer `const` assertions for configuration objects

## Settings & Storage

- Settings stored in `browser.storage.sync` under keys:
  - `subtitleLanguages`: string[] - Preferred subtitle languages in order
  - `positionHistoryEnabled`: boolean - Enable position restore feature (default: true)
  - `captureMediaKeys`: boolean - Capture keyboard media keys (default: true)
  - `customSeekEnabled`: boolean - Use custom seek time instead of default (default: false)
  - `seekTime`: number - Custom seek time in seconds (default: 10)
  - `enabledServices`: Record<ServiceId, boolean> - Per-service enable/disable (default: all true)
- Default languages: `['English', 'English [CC]', 'English CC']`
- Settings injected as `window.__streamKeysSettings` before handlers load
- Access in handlers via `window.__streamKeysSettings` or `Settings` module from `@/core`
- Uses `webextension-polyfill` for cross-browser compatibility

## Manifest Constraints

- The `description` field in `manifest.json` has a maximum length of 132 characters.
