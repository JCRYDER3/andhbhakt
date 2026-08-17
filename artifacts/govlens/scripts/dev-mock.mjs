/**
 * Start the govlens Vite server with sample schemes enabled.
 * Works on Windows PowerShell (no `VAR=value` prefix required).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
process.env.VITE_MOCK_SCHEMES = '1';
process.env.USE_MOCK_SCHEMES = '1';
process.env.PORT = process.env.PORT || '3100';

const child = spawn(
  'vite',
  ['--config', 'vite.config.ts', '--host', '0.0.0.0'],
  {
    cwd: path.resolve(root, '..'),
    stdio: 'inherit',
    shell: true,
    env: process.env,
  },
);

child.on('exit', (code) => process.exit(code ?? 0));
