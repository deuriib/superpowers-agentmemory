import { test, expect } from 'bun:test';
import {
  apiRequest,
  agentId,
  extractActionId,
  extractStatus,
  extractSummaryText,
} from '../../scripts/agentmemory-bridge.mjs';
import { startMockServer } from './mock-server.mjs';
import { runBridge } from './run-bridge.mjs';

test('health exits 0 when livez returns 200', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('GET /agentmemory/livez', { status: 200, body: { service: 'agentmemory', status: 'ok' } });
    const { exitCode, stdout } = await runBridge(['health'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('healthy');
  } finally {
    mock.stop();
  }
});

test('health exits 1 when livez returns 500', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('GET /agentmemory/livez', { status: 500, body: { error: 'boom' } });
    const { exitCode, stderr } = await runBridge(['health'], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('500');
  } finally {
    mock.stop();
  }
});

test('health exits 1 when the server is unreachable', async () => {
  const mock = startMockServer();
  const deadUrl = mock.url;
  mock.stop(); // port now closed
  const { exitCode, stderr } = await runBridge(['health'], { AGENTMEMORY_URL: deadUrl });
  expect(exitCode).toBe(1);
  expect(stderr).toContain('unreachable');
});

test('apiRequest posts JSON body and sends the Bearer secret', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/remember', { status: 201, body: { id: 'm1' } });
    process.env.AGENTMEMORY_URL = mock.url;
    process.env.AGENTMEMORY_SECRET = 's3cret';
    try {
      const result = await apiRequest('POST', '/remember', { body: { content: 'hello' } });
      expect(result.status).toBe(201);
      expect(result.ok).toBe(true);
      expect(mock.requests[0].body).toEqual({ content: 'hello' });
      expect(mock.requests[0].headers.authorization).toBe('Bearer s3cret');
    } finally {
      delete process.env.AGENTMEMORY_URL;
      delete process.env.AGENTMEMORY_SECRET;
    }
  } finally {
    mock.stop();
  }
});

test('apiRequest builds query strings', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('GET /agentmemory/frontier', { status: 200, body: {} });
    process.env.AGENTMEMORY_URL = mock.url;
    try {
      const result = await apiRequest('GET', '/frontier', { query: { project: 'p', limit: 3 } });
      expect(result.ok).toBe(true);
      expect(mock.requests[0].query).toEqual({ project: 'p', limit: '3' });
    } finally {
      delete process.env.AGENTMEMORY_URL;
    }
  } finally {
    mock.stop();
  }
});

test('apiRequest tolerates non-JSON response bodies', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('GET /agentmemory/livez', { status: 200, raw: 'not-json' });
    process.env.AGENTMEMORY_URL = mock.url;
    try {
      const result = await apiRequest('GET', '/livez');
      expect(result.ok).toBe(true);
      expect(result.json).toBeNull();
    } finally {
      delete process.env.AGENTMEMORY_URL;
    }
  } finally {
    mock.stop();
  }
});

test('extractActionId handles create response shapes', () => {
  expect(extractActionId({ actionId: 'a1' })).toBe('a1');
  expect(extractActionId({ id: 'a2' })).toBe('a2');
  expect(extractActionId({ action: { id: 'a3' } })).toBe('a3');
  expect(extractActionId({ error: 'x' })).toBeNull();
});

test('extractStatus handles action-get response shapes', () => {
  expect(extractStatus({ status: 'done' })).toBe('done');
  expect(extractStatus({ action: { status: 'pending' } })).toBe('pending');
  expect(extractStatus({})).toBeNull();
});

test('extractSummaryText handles summarize response shapes', () => {
  expect(extractSummaryText({ summary: 'sum' })).toBe('sum');
  expect(extractSummaryText({ content: 'cont' })).toBe('cont');
  expect(extractSummaryText({ text: 'txt' })).toBe('txt');
  expect(extractSummaryText({})).toBeNull();
});

test('agentId defaults and honors AGENTMEMORY_AGENT_ID', () => {
  expect(agentId()).toBe('superpowers-agent');
  process.env.AGENTMEMORY_AGENT_ID = 'bridge-test';
  try {
    expect(agentId()).toBe('bridge-test');
  } finally {
    delete process.env.AGENTMEMORY_AGENT_ID;
  }
});
