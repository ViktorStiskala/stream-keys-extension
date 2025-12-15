---
name: Refactor Debouncing Tests
overview: Complete rewrite using real DOM fixtures, @testing-library/user-event, and proper Shadow DOM attachment for Disney+. Tests distinguish debouncing from SEEK_MIN_DIFF_SECONDS rejection.
todos:
  - id: add-deps
    content: Add @testing-library/user-event and @testing-library/dom as dev dependencies
    status: pending
  - id: enhance-vitest-setup
    content: Add attachDisneyShadowDOM helper and enhance MockVideoElement in vitest.setup.ts
    status: pending
  - id: create-test-helpers
    content: Create service setup helpers and user action helpers in test-utils.ts
    status: pending
  - id: refactor-tests
    content: Rewrite debouncing.test.ts with parameterized tests using real fixtures
    status: pending
  - id: create-cursor-rule
    content: Create Cursor rule at features/restore-position/.cursor/rules/debouncing-test/RULE.md
    status: pending
---

