/**
 * Single source of truth for ports, shared by the API server, the demo scripts
 * and the Vite dev proxy.
 *
 * 4931 is deliberately obscure – ordinary dev ports (3000, 4000, 5000, 5173,
 * 8000, 8080) are routinely taken by other projects, and macOS itself squats on
 * 5000 and 7000.
 */

/** @typedef {number} Port */

export const DEFAULT_PORT = 4931;
export const DEFAULT_WEB_PORT = 5273;

/** Port the API actually ended up on, remembered so the Vite proxy can find it. */
export const PORT_FILE = 'data/.api-port';
