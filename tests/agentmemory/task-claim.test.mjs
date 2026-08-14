import { test, expect } from 'bun:test';
import { startMockServer } from './mock-server.mjs';
import { runBridge } from './run-bridge.mjs';

test('task-claim acquires a lease and marks the action active', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/leases/acquire', { status: 200, body: { lease: { actionId: 'act-1' } } });
    mock.routes.set('POST /agentmemory/actions/update', { status: 200, body: { ok: true } });
    const { exitCode, stdout } = await runBridge(['task-claim', 'act-1'], {
      AGENTMEMORY_URL: mock.url,
      AGENTMEMORY_AGENT_ID: 'test-agent',
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('act-1 claimed by test-agent');

    const acquire = mock.requests.find((r) => r.path === '/agentmemory/leases/acquire');
    expect(acquire.body).toEqual({ actionId: 'act-1', agentId: 'test-agent', ttlMs: 3600000 });
    const update = mock.requests.find((r) => r.path === '/agentmemory/actions/update');
    expect(update.body).toEqual({ actionId: 'act-1', status: 'active', assignedTo: 'test-agent' });
  } finally {
    mock.stop();
  }
});

test('task-claim exits 1 when acquire fails', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/leases/acquire', { status: 409, body: { error: 'already leased' } });
    const { exitCode, stderr } = await runBridge(['task-claim', 'act-1'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('leases/acquire failed');
  } finally {
    mock.stop();
  }
});

test('task-claim exits 1 when the status update fails', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/leases/acquire', { status: 200, body: { ok: true } });
    mock.routes.set('POST /agentmemory/actions/update', { status: 500, body: { error: 'boom' } });
    const { exitCode, stderr } = await runBridge(['task-claim', 'act-1'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('actions/update failed');
  } finally {
    mock.stop();
  }
});

test('task-claim releases the lease best-effort when the status update fails', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/leases/acquire', { status: 200, body: { ok: true } });
    mock.routes.set('POST /agentmemory/actions/update', { status: 500, body: { error: 'boom' } });
    mock.routes.set('POST /agentmemory/leases/release', { status: 200, body: { ok: true } });
    const { exitCode } = await runBridge(['task-claim', 'act-1'], {
      AGENTMEMORY_URL: mock.url,
      AGENTMEMORY_AGENT_ID: 'test-agent',
    });
    expect(exitCode).toBe(1);
    const release = mock.requests.find((r) => r.path === '/agentmemory/leases/release');
    expect(release).toBeDefined();
    expect(release.body).toEqual({ actionId: 'act-1', agentId: 'test-agent' });
  } finally {
    mock.stop();
  }
});

test('task-claim exits 1 with usage when no actionId is given', async () => {
  const { exitCode, stderr } = await runBridge(['task-claim'], {});
  expect(exitCode).toBe(1);
  expect(stderr).toContain('Usage:');
});