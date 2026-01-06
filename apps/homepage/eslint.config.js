import js from '@eslint/js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import eslintPluginAstro from 'eslint-plugin-astro';
import tailwindCanonicalClasses from 'eslint-plugin-tailwind-canonical-classes';
import tailwindcss from '@hyoban/eslint-plugin-tailwindcss';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  ...tailwindcss.configs['flat/recommended'],
  {
    files: ['**/*.{js,mjs,ts,astro}'],
    plugins: {
      'tailwind-canonical-classes': tailwindCanonicalClasses,
    },
    rules: {
      'tailwind-canonical-classes/tailwind-canonical-classes': [
        'error',
        {
          cssPath: './src/styles/global.css',
        },
      ],
    },
    settings: {
      tailwindcss: {
        config: path.join(__dirname, 'src/styles/global.css'),
        whitelist: [
          'restore-dialog-.*', // JS DOM targeting for demo interactions
          'service-badge', // CSS variable scoping for per-service hover colors
          'keyboard-key(-.+)?', // JS-toggled animation states (--thumping, --flying, -wrapper)
          'glow-accent', // Custom glow effect defined in global.css
          'delay-(\\d+)?', // Dynamic delay classes from template interpolation
        ],
      },
    },
  },
  eslintConfigPrettier,
  {
    ignores: ['dist/', 'node_modules/', '.astro/'],
  },
];
