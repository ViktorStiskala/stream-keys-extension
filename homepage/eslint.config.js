import js from '@eslint/js';
import eslintPluginAstro from 'eslint-plugin-astro';
import tailwindCanonicalClasses from 'eslint-plugin-tailwind-canonical-classes';

export default [
  js.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,astro}'],
    plugins: {
      'tailwind-canonical-classes': tailwindCanonicalClasses,
    },
    rules: {
      'tailwind-canonical-classes/tailwind-canonical-classes': [
        'warn',
        {
          cssPath: './src/styles/global.css',
        },
      ],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '.astro/'],
  },
];
