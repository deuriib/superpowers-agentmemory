import { test, expect } from 'bun:test';
import { startMockServer } from './mock-server.mjs';
import { runBridge } from './run-bridge.mjs';

test('session-close summarizes and stores the summary in a slot', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/summarize', { status: 200, body: { summary: 'session summary text' } });
    mock.routes.set('POST /agentmemory/slot', { status: 200, body: { ok: true } });
    const { exitCode, stdout } = await runBridge(['session-close', 's1'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('s1 summarized and stored');

    const summarize = mock.requests.find((r) => r.path === '/agentmemory/summarize');
    expect(summarize.body).toEqual({ sessionId: 's1' });
    const slot = mock.requests.find((r) => r.path === '/agentmemory/slot');
    expect(slot.body).toEqual({ label: 'session-summary', content: 'session summary text', pinned: true });
    expect(mock.requests.some((r) => r.path === '/agentmemory/remember')).toBe(false);
    expect(mock.requests.some((r) => r.path === '/agentmemory/crystals/create')).toBe(false);
  } finally {
    mock.stop();
  }
});

test('session-close falls back to remember when the slot is unavailable', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/summarize', { status: 200, body: { summary: 'session summary text' } });
    mock.routes.set('POST /agentmemory/slot', { status: 503, body: { error: 'Memory slots not enabled', flag: 'AGENTMEMORY_SLOTS' } });
    mock.routes.set('POST /agentmemory/remember', { status: 201, body: { id: 'm1' } });
    const { exitCode, stderr } = await runBridge(['session-close', 's1'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(0);
    expect(stderr).toContain('slot unavailable');

    const remembered = mock.requests.find((r) => r.path === '/agentmemory/remember');
    expect(remembered.body).toEqual({
      content: 'session summary text',
      type: 'summary',
      concepts: ['slot:session-summary'],
    });
  } finally {
    mock.stop();
  }
});

test('session-close exits 1 when summarize fails', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/summarize', { status: 500, body: { error: 'no LLM provider' } });
    const { exitCode, stderr } = await runBridge(['session-close', 's1'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('summarize failed');
  } finally {
    mock.stop();
  }
});

test('session-close summarize failure includes the server body as evidence', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/summarize', { status: 500, body: { error: 'boom' } });
    const { exitCode, stderr } = await runBridge(['session-close', 's1'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('summarize failed');
    expect(stderr).toContain('boom');
  } finally {
    mock.stop();
  }
});

test('session-close exits 1 when summarize returns no text', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/summarize', { status: 200, body: { ok: true } });
    const { exitCode, stderr } = await runBridge(['session-close', 's1'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('no summary text');
  } finally {
    mock.stop();
  }
});

test('session-close crystallizes when every action is done or cancelled', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/summarize', { status: 200, body: { summary: 'session summary text' } });
    mock.routes.set('POST /agentmemory/slot', { status: 200, body: { ok: true } });
    mock.routes.set('GET /agentmemory/actions/get', (req) => ({
      status: 200,
      body: { actionId: req.query.actionId, status: req.query.actionId === 'act-pending' ? 'pending' : 'done' },
    }));
    mock.routes.set('POST /agentmemory/crystals/create', { status: 201, body: { crystal: { id: 'c1' } } });
    const { exitCode } = await runBridge(['session-close', 's1', 'act-1', 'act-2'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(0);

    const checks = mock.requests.filter((r) => r.path === '/agentmemory/actions/get');
    expect(checks.map((r) => r.query.actionId)).toEqual(['act-1', 'act-2']);
    const crystal = mock.requests.find((r) => r.path === '/agentmemory/crystals/create');
    expect(crystal.body).toEqual({ actionIds: ['act-1', 'act-2'], sessionId: 's1' });
  } finally {
    mock.stop();
  }
});

test('session-close refuses to crystallize when an action is not closed', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/summarize', { status: 200, body: { summary: 'session summary text' } });
    mock.routes.set('POST /agentmemory/slot', { status: 200, body: { ok: true } });
    mock.routes.set('GET /agentmemory/actions/get', (req) => ({
      status: 200,
      body: { actionId: req.query.actionId, status: req.query.actionId === 'act-pending' ? 'pending' : 'done' },
    }));
    const { exitCode, stderr } = await runBridge(['session-close', 's1', 'act-1', 'act-pending'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('done or cancelled');
    expect(mock.requests.some((r) => r.path === '/agentmemory/crystals/create')).toBe(false);
  } finally {
    mock.stop();
  }
});

test('session-close reports the summary was stored when an action blocks crystallization', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/summarize', { status: 200, body: { summary: 'session summary text' } });
    mock.routes.set('POST /agentmemory/slot', { status: 200, body: { ok: true } });
    mock.routes.set('GET /agentmemory/actions/get', (req) => ({
      status: 200,
      body: { actionId: req.query.actionId, status: 'pending' },
    }));
    const { exitCode, stderr } = await runBridge(['session-close', 's1', 'act-1'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('summary stored');
    expect(stderr).toContain('done or cancelled');
    expect(mock.requests.some((r) => r.path === '/agentmemory/crystals/create')).toBe(false);
  } finally {
    mock.stop();
  }
});

test('session-close exits 1 with usage when no sessionId is given', async () => {
  const { exitCode, stderr } = await runBridge(['session-close'], {});
  expect(exitCode).toBe(1);
  expect(stderr).toContain('Usage:');
});