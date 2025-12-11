---
description: StreamKeys Extension - Testing
alwaysApply: true
---

# Testing

## When to Run Tests

Run `npm test` after changes to source code in `src/` that could affect functionality. Tests are NOT required for:
- README or documentation updates
- Cursor rules changes
- Configuration files outside `src/`

## Test Commands

- `npm test` - Run all tests once
- `npm run test:watch` - Run tests in watch mode

## Test Structure

Tests are co-located with source files (vitest best practice):
- `src/core/video.test.ts` - Tests for `video.ts`
- `src/features/restore-position/history.test.ts` - Tests for position history
- `src/services/disney.test.ts` - Disney+ service tests
- `src/services/hbomax.test.ts` - HBO Max service tests
- `src/build.test.ts` - Production build verification

## DOM Fixtures

Real DOM snapshots for integration testing are stored in `resources/dom/`:
- `resources/dom/disney.html` - Disney+ player DOM snapshot
- `resources/dom/hbomax.html` - HBO Max player DOM snapshot

Use the test setup helpers from `vitest.setup.ts`:

@scripts/fixture-setup.ts

## Service Testing Pattern

Services export a `_test` object with internal functions for testing:

@scripts/service-test-pattern.ts

## Testing Constants

When testing with threshold values, import and use the exported constants instead of hardcoding:

@scripts/testing-constants.ts

## Writing New Tests

When adding new functionality:
1. Create a `.test.ts` file next to the source file
2. Use descriptive test names that explain the expected behavior
3. Import constants for threshold values instead of hardcoding
4. Use DOM fixtures for integration tests when testing DOM interactions
5. Export internal functions via `_test` object if needed for testing
