/**
 * Start the API on Windows without bash `export`.
 * Equivalent to: $env:PORT=8080; pnpm --filter @workspace/api-server run start
 *
 * Needs a prior `pnpm --filter @workspace/api-server run build` and
 * DATABASE_URL / PostgreSQL. If those are missing the process will exit —
 * that is expected on a frontend-only checkout. Use `pnpm run dev:mock` instead.
 */
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.PORT = process.env.PORT || '8080';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const dist = path.join(root, 'artifacts', 'api-server', 'dist', 'index.mjs');

function start() {
  const child = spawn(
    'pnpm',
    ['--filter', '@workspace/api-server', 'run', 'start'],
    { cwd: root, stdio: 'inherit', shell: true, env: process.env },
  );
  child.on('exit', (code) => process.exit(code ?? 0));
}

if (!existsSync(dist)) {
  const build = spawn(
    'pnpm',
    ['--filter', '@workspace/api-server', 'run', 'build'],
    { cwd: root, stdio: 'inherit', shell: true, env: process.env },
  );
  build.on('exit', (code) => {
    if (code !== 0) process.exit(code ?? 1);
    start();
  });
} else {
  start();
}
