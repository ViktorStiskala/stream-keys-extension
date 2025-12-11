import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { DebugLogger } from './debug/vite-debug-logger';

// Dev mode detection - used for conditional plugins and build options
// Checks for watch mode, dev commands, or non-production environment
const isDebugMode =
  process.argv.includes('--watch') ||
  process.argv.includes('dev') ||
  process.argv.includes('serve') ||
  process.env.NODE_ENV !== 'production';

// Browser target from environment variable (supports: 'chrome' | 'firefox' | custom string)
// Default: 'chrome' for Chromium-based browsers (Chrome, Edge, Brave)
const browser = process.env.BROWSER || 'chrome';

// Output directory structure:
// - Dev: build/dev/{browser}/extension
// - Prod: build/{browser}/extension
const outDir = isDebugMode ? `build/dev/${browser}/extension` : `build/${browser}/extension`;

// Copy logo files to build directory
function copyLogos() {
  return {
    name: 'copy-logos',
    writeBundle() {
      const srcDir = resolve(__dirname, 'src/logo');
      const destDir = resolve(__dirname, `${outDir}/logo`);

      try {
        mkdirSync(destDir, { recursive: true });
        const files = readdirSync(srcDir);
        files.forEach((file) => {
          if (file.endsWith('.png')) {
            copyFileSync(resolve(srcDir, file), resolve(destDir, file));
          }
        });
      } catch (e) {
        console.warn('Could not copy logo files:', e);
      }
    },
  };
}

// Pretty-print manifest.json in dev mode
function prettyManifest() {
  return {
    name: 'pretty-manifest',
    writeBundle() {
      if (!isDebugMode) return;

      const manifestPath = resolve(__dirname, `${outDir}/manifest.json`);
      try {
        const content = readFileSync(manifestPath, 'utf-8');
        const json = JSON.parse(content);
        writeFileSync(manifestPath, JSON.stringify(json, null, 2));
      } catch (e) {
        // Ignore errors - manifest might not exist yet
      }
    },
  };
}

export default defineConfig({
  plugins: [
    // Debug logger (dev mode only) - captures vite logs and browser console.log to .cursor/debug.log
    ...(isDebugMode ? [DebugLogger.plugin()] : []),
    webExtension({
      manifest: 'src/manifest.json',
      additionalInputs: ['src/services/disney.ts', 'src/services/hbomax.ts'],
      // Target browser for manifest transformations and web-ext
      browser,
      // Add web-ext configuration for profile persistence
      webExtConfig: {
        // Keep changes to a temporary profile across sessions
        keepProfileChanges: true,
        profileCreateIfMissing: true,
        // Use a dedicated dev profile directory
        chromiumProfile: '.chrome-profile',
        // Optional: Set a starting URL after browser launches
        startUrl: ['https://play.hbomax.com/'],
        // Disable web security to allow debug log forwarding to localhost
        // Note: Requires fresh profile (chromiumProfile) to take effect
        args: [
          '--disable-web-security',
          '--disable-site-isolation-trials',
          '--allow-running-insecure-content',
          '--hide-crash-restore-bubble',
        ],
      },
    }),
    copyLogos(),
    prettyManifest(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    // Expose __DEV__ to client code for conditional debug logic
    __DEV__: JSON.stringify(isDebugMode),
  },
  build: {
    outDir,
    emptyOutDir: true,
    // In dev mode, don't minify for easier debugging
    minify: !isDebugMode,
  },
});
