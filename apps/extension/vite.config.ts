import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import packageJson from './package.json' with { type: 'json' };
import { DebugLogger } from './debug/vite-debug-logger';

// Browser target from environment variable (supports: 'chrome' | 'firefox' | 'safari' | custom string)
// Default: 'chrome' for Chromium-based browsers (Chrome, Edge, Brave)
const browser = process.env.BROWSER || 'chrome';

export default defineConfig(({ command, mode }) => {
  // Dev mode detection - checks for watch mode, dev commands, or non-production mode
  const isDebugMode =
    process.argv.includes('--watch') ||
    process.argv.includes('dev') ||
    command === 'serve' ||
    mode !== 'production';

  const debugModulePath = isDebugMode ? 'src/core/debug.ts' : 'src/core/debug.stub.ts';

  // Output directory structure:
  // - Dev: build/dev/{browser}/extension
  // - Prod: build/production/{browser}/extension
  const outDir = isDebugMode
    ? `build/dev/${browser}/extension`
    : `build/production/${browser}/extension`;

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

  return {
    plugins: [
      // Debug logger (dev mode only) - captures vite logs and browser console.log to .cursor/debug.log
      ...(isDebugMode ? [DebugLogger.plugin()] : []),
      webExtension({
        manifest: 'src/manifest.json',
        additionalInputs: ['src/services/disney.ts', 'src/services/hbomax.ts', 'src/services/youtube.ts', 'src/services/bbc.ts', 'src/shadow-patcher.ts'],
        // Target browser for manifest transformations and web-ext
        browser,
        // Transform manifest: inject version from package.json and Firefox compatibility
        transformManifest: (manifest) => {
          // Sync version from package.json
          manifest.version = packageJson.version;

          // Firefox compatibility: service_worker -> scripts
          if (browser === 'firefox' && manifest.background) {
            const bg = manifest.background as { service_worker?: string; scripts?: string[] };
            if (bg.service_worker) {
              // Create new background object with scripts instead of service_worker
              manifest.background = { scripts: [bg.service_worker] };
            }
          }
          return manifest;
        },
        // Add web-ext configuration for profile persistence
        webExtConfig: {
          // Target browser for web-ext run
          target: browser === 'firefox' ? 'firefox-desktop' : 'chromium',
          // Keep changes to a temporary profile across sessions
          keepProfileChanges: true,
          // Use dedicated dev profile directories per browser
          ...(browser === 'firefox'
            ? {
                // Firefox: create profile in build directory (web-ext compatible path)
                firefoxProfile: resolve(__dirname, 'build/dev/firefox/profile'),
                profileCreateIfMissing: true,
              }
            : {
                chromiumProfile: '.chrome-profile',
                profileCreateIfMissing: true,
              }),
          // Optional: Set a starting URL after browser launches
          startUrl: ['https://play.hbomax.com/'],
          // Chromium-specific: Disable web security to allow debug log forwarding to localhost
          // Note: Requires fresh profile (chromiumProfile) to take effect
          ...(browser === 'chrome' && {
            args: [
              '--disable-web-security',
              '--disable-site-isolation-trials',
              '--allow-running-insecure-content',
              '--hide-crash-restore-bubble',
              '--disable-webrtc',
              '--disable-quic'

            ],
          }),
        },
      }),
      copyLogos(),
      prettyManifest(),
    ],
    resolve: {
      alias: {
        // Swap debug module at compile time - stub in production, full implementation in dev
        // Must come before '@' to take precedence
        '@/core/debug': resolve(__dirname, debugModulePath),
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
  };
});
