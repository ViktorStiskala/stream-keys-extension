import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';

const isWatch = process.argv.includes('--watch');

// Copy logo files to build directory
function copyLogos() {
  return {
    name: 'copy-logos',
    writeBundle() {
      const srcDir = resolve(__dirname, 'src/logo');
      const destDir = resolve(__dirname, 'build/chrome/extension/logo');

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
      if (!isWatch) return;

      const manifestPath = resolve(__dirname, 'build/chrome/extension/manifest.json');
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
    webExtension({
      manifest: 'src/manifest.json',
      additionalInputs: ['src/handlers/disney.ts', 'src/handlers/hbomax.ts'],
      disableAutoLaunch: true,
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
    // Enable debug logging in watch mode
    __DEV__: JSON.stringify(isWatch),
  },
  build: {
    outDir: 'build/chrome/extension',
    emptyOutDir: true,
    // In watch mode (dev), don't minify for easier debugging
    minify: !isWatch,
  },
});
