import { test, expect } from 'bun:test';
import { startMockServer } from './mock-server.mjs';
import { runBridge } from './run-bridge.mjs';

test('no arguments prints usage and exits 1', async () => {
  const { exitCode, stderr } = await runBridge([]);
  expect(exitCode).toBe(1);
  expect(stderr).toContain('Usage:');
});

test('unknown subcommand prints usage and exits 1', async () => {
  const { exitCode, stderr } = await runBridge(['bogus']);
  expect(exitCode).toBe(1);
  expect(stderr).toContain('Usage:');
});

test('mock server captures requests and serves registered routes', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/actions', { status: 201, body: { actionId: 'act-1' } });
    const response = await fetch(`${mock.url}/agentmemory/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x' }),
    });
    expect(response.status).toBe(201);
    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0]).toMatchObject({
      method: 'POST',
      path: '/agentmemory/actions',
      body: { title: 'x' },
    });
  } finally {
    mock.stop();
  }
});

test('mock server returns 404 for unknown routes', async () => {
  const mock = startMockServer();
  try {
    const response = await fetch(`${mock.url}/agentmemory/unknown`);
    expect(response.status).toBe(404);
  } finally {
    mock.stop();
  }
});
