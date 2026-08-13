import { test, expect } from 'bun:test';
import { startMockServer } from './mock-server.mjs';
import { runBridge } from './run-bridge.mjs';

test('task-done releases the lease and marks the action done with a result', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/leases/release', { status: 200, body: { ok: true } });
    mock.routes.set('POST /agentmemory/actions/update', { status: 200, body: { ok: true } });
    const { exitCode, stdout } = await runBridge(['task-done', 'act-1', 'review clean'], {
      AGENTMEMORY_URL: mock.url,
      AGENTMEMORY_AGENT_ID: 'test-agent',
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('act-1 marked done');

    const release = mock.requests.find((r) => r.path === '/agentmemory/leases/release');
    expect(release.body).toEqual({ actionId: 'act-1', agentId: 'test-agent', result: 'review clean' });
    const update = mock.requests.find((r) => r.path === '/agentmemory/actions/update');
    expect(update.body).toEqual({ actionId: 'act-1', status: 'done', result: 'review clean' });
  } finally {
    mock.stop();
  }
});

test('task-done omits the result fields when no result is given', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/leases/release', { status: 200, body: { ok: true } });
    mock.routes.set('POST /agentmemory/actions/update', { status: 200, body: { ok: true } });
    const { exitCode } = await runBridge(['task-done', 'act-1'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(0);

    const release = mock.requests.find((r) => r.path === '/agentmemory/leases/release');
    expect(release.body).toEqual({ actionId: 'act-1', agentId: 'superpowers-agent' });
    const update = mock.requests.find((r) => r.path === '/agentmemory/actions/update');
    expect(update.body).toEqual({ actionId: 'act-1', status: 'done' });
  } finally {
    mock.stop();
  }
});

test('task-done exits 1 when release fails', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/leases/release', { status: 404, body: { error: 'no lease' } });
    const { exitCode, stderr } = await runBridge(['task-done', 'act-1'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('leases/release failed');
  } finally {
    mock.stop();
  }
});

test('task-done exits 1 when the status update fails', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/leases/release', { status: 200, body: { ok: true } });
    mock.routes.set('POST /agentmemory/actions/update', { status: 500, body: { error: 'boom' } });
    const { exitCode, stderr } = await runBridge(['task-done', 'act-1'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('actions/update failed');
  } finally {
    mock.stop();
  }
});

test('task-done exits 1 with usage when no actionId is given', async () => {
  const { exitCode, stderr } = await runBridge(['task-done'], {});
  expect(exitCode).toBe(1);
  expect(stderr).toContain('Usage:');
});
