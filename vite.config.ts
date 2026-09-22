import fs from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { DEFAULT_PORT, DEFAULT_WEB_PORT, PORT_FILE } from './server/ports.js';

/**
 * The API usually runs on 4931, but it steps up to the next free port when that
 * is taken – so follow whatever it last wrote to data/.api-port.
 */
function apiTarget() {
  try {
    const port = fs.readFileSync(PORT_FILE, 'utf8').trim();
    if (/^\d+$/.test(port)) return `http://localhost:${port}`;
  } catch {
    /* not started yet – fall back to the default */
  }
  return `http://localhost:${DEFAULT_PORT}`;
}

export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    // Also obscure on purpose: 5173 is often taken by other projects.
    port: DEFAULT_WEB_PORT,
    strictPort: false,
    // Listen on the LAN too, so colleagues can open the dev URL as well.
    host: true,
    proxy: {
      '/api': {
        target: apiTarget(),
        changeOrigin: true,
      },
    },
  },
});
