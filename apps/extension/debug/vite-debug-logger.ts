import fs from 'fs';
import path from 'path';
import type { Plugin, ViteDevServer } from 'vite';

const logPath = path.resolve('.cursor/debug.log');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  magenta: '\x1b[35m',
};

// Private helpers
function ensureLogFile(): void {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, `=== Build: ${new Date().toISOString()} ===\n`);
}

function writeLog(level: string, source: string, method: string | undefined, msg: string): void {
  const methodPart = method ? ` [${method}]` : '';
  const line = `[${new Date().toISOString()}] ${level.padEnd(5)} [${source}]${methodPart} ${msg}\n`;
  fs.appendFileSync(logPath, line);
}

function printToTerminal(
  level: string,
  source: string,
  method: string | undefined,
  msg: string
): void {
  const timestamp = new Date().toISOString().slice(11, 19); // HH:MM:SS
  const levelColor =
    level === 'ERROR' ? colors.red : level === 'WARN' ? colors.yellow : colors.cyan;

  // Different colors for Debug.* vs console.*
  let methodPart = '';
  if (method) {
    const methodColor = method.startsWith('Debug.') ? colors.magenta : colors.green;
    methodPart = ` ${methodColor}[${method}]${colors.reset}`;
  }

  const line = `${colors.dim}${timestamp}${colors.reset} ${levelColor}[${source}]${colors.reset}${methodPart} ${msg}`;
  // Use process.stdout.write to bypass any buffering
  process.stdout.write(line + '\n');
}

function createPlugin(): Plugin {
  ensureLogFile();
  return {
    name: 'cursor-debug-log',
    configureServer(server: ViteDevServer) {
      // eslint-disable-next-line no-console
      console.log('[DebugLogger] Middleware registered at /__debug_log');
      writeLog('INFO', 'server', undefined, 'Debug logger middleware started');

      // CORS middleware for browser log forwarding
      server.middlewares.use('/__debug_log', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const { level, source, method, message } = JSON.parse(body);
              const lvl = level || 'LOG';
              const src = source || 'browser';
              // Print to terminal with colors
              printToTerminal(lvl, src, method, message);
              // Also write to debug.log file
              writeLog(lvl, src, method, message);
            } catch {
              /* ignore parse errors */
            }
            res.statusCode = 200;
            res.end('ok');
          });
          return;
        }

        res.statusCode = 405;
        res.end();
      });

      // Intercept Vite logger
      const { info, warn, error } = server.config.logger;

      server.config.logger.info = (...args: unknown[]) => {
        writeLog('INFO', 'vite', undefined, args.map(String).join(' '));
        info.call(server.config.logger, ...args);
      };

      server.config.logger.warn = (...args: unknown[]) => {
        writeLog('WARN', 'vite', undefined, args.map(String).join(' '));
        warn.call(server.config.logger, ...args);
      };

      server.config.logger.error = (...args: unknown[]) => {
        writeLog('ERROR', 'vite', undefined, args.map(String).join(' '));
        error.call(server.config.logger, ...args);
      };
    },
  };
}

// Encapsulated export
export const DebugLogger = {
  plugin: createPlugin,
};

