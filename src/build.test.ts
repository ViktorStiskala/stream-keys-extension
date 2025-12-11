import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Production Build', () => {
  const disneyPath = resolve(__dirname, '../build/chrome/extension/src/services/disney.js');
  const backgroundPath = resolve(__dirname, '../build/chrome/extension/src/background/index.js');

  describe('disney.js debug code exclusion', () => {
    it('build file exists', () => {
      const exists = existsSync(disneyPath);
      expect(exists).toBe(true);
    });

    it('does NOT contain DEV_SERVER_URL constant', () => {
      const content = readFileSync(disneyPath, 'utf-8');
      expect(content).not.toContain('DEV_SERVER_URL');
    });

    it('does NOT contain debug server endpoint', () => {
      const content = readFileSync(disneyPath, 'utf-8');
      expect(content).not.toContain('__debug_log');
    });

    it('does NOT contain sendToServer function', () => {
      const content = readFileSync(disneyPath, 'utf-8');
      expect(content).not.toContain('sendToServer');
    });

    it('does NOT contain initConsoleForward function', () => {
      const content = readFileSync(disneyPath, 'utf-8');
      expect(content).not.toContain('initConsoleForward');
    });

    it('does NOT contain Debug.log calls', () => {
      const content = readFileSync(disneyPath, 'utf-8');
      expect(content).not.toContain('Debug.log');
    });

    it('does NOT contain connectionErrorLogged variable', () => {
      const content = readFileSync(disneyPath, 'utf-8');
      expect(content).not.toContain('connectionErrorLogged');
    });
  });

  describe('background/index.js debug code exclusion', () => {
    it('build file exists', () => {
      const exists = existsSync(backgroundPath);
      expect(exists).toBe(true);
    });

    it('does NOT contain DEV_SERVER_URL constant', () => {
      const content = readFileSync(backgroundPath, 'utf-8');
      expect(content).not.toContain('DEV_SERVER_URL');
    });

    it('does NOT contain debug server endpoint', () => {
      const content = readFileSync(backgroundPath, 'utf-8');
      expect(content).not.toContain('__debug_log');
    });

    it('does NOT contain sendToServer function', () => {
      const content = readFileSync(backgroundPath, 'utf-8');
      expect(content).not.toContain('sendToServer');
    });

    it('does NOT contain initConsoleForward function', () => {
      const content = readFileSync(backgroundPath, 'utf-8');
      expect(content).not.toContain('initConsoleForward');
    });

    it('does NOT contain Debug.log calls', () => {
      const content = readFileSync(backgroundPath, 'utf-8');
      expect(content).not.toContain('Debug.log');
    });

    it('does NOT contain connectionErrorLogged variable', () => {
      const content = readFileSync(backgroundPath, 'utf-8');
      expect(content).not.toContain('connectionErrorLogged');
    });
  });
});
