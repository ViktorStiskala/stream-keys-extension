/**
 * Post-build verification tests.
 *
 * These tests verify that debug code is excluded from production builds.
 * They require `npm run build` to have been run first - they check the
 * built artifacts in the build/ directory.
 *
 * Note: These are not unit tests of functionality, but rather build artifact
 * validation to ensure debug code doesn't ship to production.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Debug tokens that should NOT appear in production builds.
 * If you add new debug-only code, add its identifiers here.
 */
const DEBUG_TOKENS = [
  'DEV_SERVER_URL',
  '__debug_log',
  'sendToServer',
  'initConsoleForward',
  'Debug.log',
  'connectionErrorLogged',
] as const;

/**
 * Build files to check for debug code exclusion.
 * Add new entry points here as needed.
 */
const BUILD_FILES = [
  {
    name: 'disney.js',
    path: resolve(__dirname, '../build/production/chrome/extension/src/services/disney.js'),
  },
  {
    name: 'background/index.js',
    path: resolve(__dirname, '../build/production/chrome/extension/src/background/index.js'),
  },
];

describe('Production Build', () => {
  describe.each(BUILD_FILES)('$name debug code exclusion', ({ path }) => {
    let content: string;
    let fileExists: boolean;

    beforeAll(() => {
      fileExists = existsSync(path);
      if (fileExists) {
        content = readFileSync(path, 'utf-8');
      }
    });

    it('build file exists', () => {
      expect(fileExists).toBe(true);
    });

    it.each(DEBUG_TOKENS)('does NOT contain "%s"', (token) => {
      // Skip if file doesn't exist (will fail in the existence test)
      if (!fileExists) return;
      expect(content).not.toContain(token);
    });
  });
});
