// tests/agentmemory/run-bridge.mjs
// Spawns the bridge CLI as a subprocess and returns its exit code, stdout,
// and stderr. All bridge CLI tests use this helper.

import path from 'path';

const BRIDGE = path.join(import.meta.dir, '..', '..', 'scripts', 'agentmemory-bridge.mjs');

export async function runBridge(args, env = {}, cwd = undefined, timeoutMs = undefined) {
  const proc = Bun.spawn([process.execPath, BRIDGE, ...args], {
    env: { ...process.env, ...env },
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  let timedOut = false;
  const guard = timeoutMs
    ? setTimeout(() => {
        timedOut = true;
        proc.kill();
      }, timeoutMs)
    : null;
  try {
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    return { exitCode, stdout, stderr, timedOut };
  } finally {
    if (guard) clearTimeout(guard);
  }
}
