/**
 * Dev launcher: starts the API, waits until it has actually claimed a port, then
 * starts Vite (whose /api proxy follows that port). Keeps the two in lockstep
 * without needing a process-manager dependency, and Ctrl-C stops both.
 *
 *   npm run dev
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_PORT, PORT_FILE } from '../server/ports.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT_FILE_ABS = path.resolve(ROOT, PORT_FILE);
const children = new Set();

function launch(name, color, command, args) {
  const child = spawn(command, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  children.add(child);
  const tag = `\x1b[${color}m${name.padEnd(3)}\x1b[0m │ `;
  const pipe = (stream) => {
    let buffer = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) console.log(`${tag}${line}`);
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', (code, signal) => {
    children.delete(child);
    if (signal !== 'SIGTERM' && code !== 0 && code !== null) {
      console.log(`${tag}exited with code ${code}`);
    }
  });
  return child;
}

function shutdown(code = 0) {
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 120);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function waitForPort(timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const port = fs.readFileSync(PORT_FILE_ABS, 'utf8').trim();
      if (/^\d+$/.test(port)) {
        const res = await fetch(`http://localhost:${port}/api/health`).catch(() => null);
        if (res?.ok) return Number(port);
      }
    } catch {
      /* keep waiting */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return Number(process.env.PORT ?? DEFAULT_PORT);
}

// Stale port file from a previous run would send Vite to the wrong place.
try {
  fs.rmSync(PORT_FILE_ABS);
} catch {
  /* nothing to clean up */
}

launch('api', '35', process.execPath, ['server/index.js']);
const apiPort = await waitForPort();
console.log(`\x1b[90m     │\x1b[0m API ready on http://localhost:${apiPort} — starting Vite…\n`);
launch('web', '36', path.join(ROOT, 'node_modules', '.bin', 'vite'), []);
