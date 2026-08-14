import { test, expect } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startMockServer } from './mock-server.mjs';
import { runBridge } from './run-bridge.mjs';

const FIXTURE = path.join(import.meta.dir, 'fixtures', 'sample-plan.md');

function actionIdFromTitle(request) {
  return {
    status: 201,
    body: { actionId: `act-${/^\[(\d+)\]/.exec(request.body.title)?.[1] ?? 'unknown'}` },
  };
}

test('plan-sync creates one action per task and wires requires edges', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/actions', actionIdFromTitle);
    mock.routes.set('POST /agentmemory/actions/edges', { status: 201, body: { ok: true } });
    const { exitCode, stdout } = await runBridge(['plan-sync', FIXTURE], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(0);

    const creates = mock.requests.filter((r) => r.path === '/agentmemory/actions' && r.method === 'POST');
    expect(creates).toHaveLength(3);
    expect(creates.map((r) => r.body.title)).toEqual(['[1] Alpha', '[2] Beta', '[3] Gamma']);
    expect(creates[1].body.description).toContain('Consumes: Task 1');
    expect(creates[0].body.tags).toEqual(['plan-sync']);
    expect(creates[0].body.project).toBeUndefined();

    const edges = mock.requests.filter((r) => r.path === '/agentmemory/actions/edges');
    expect(edges).toHaveLength(2);
    expect(edges[0].body).toEqual({ sourceActionId: 'act-2', targetActionId: 'act-1', type: 'requires' });
    expect(edges[1].body).toEqual({ sourceActionId: 'act-3', targetActionId: 'act-2', type: 'requires' });

    const parsed = JSON.parse(stdout);
    expect(parsed.actions).toHaveLength(3);
    expect(parsed.actions[0]).toEqual({ task: 1, actionId: 'act-1', title: '[1] Alpha' });
    expect(parsed.edges).toEqual([{ source: 2, target: 1 }, { source: 3, target: 2 }]);
  } finally {
    mock.stop();
  }
});

test('plan-sync attaches the project from AGENTMEMORY_PROJECT', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/actions', actionIdFromTitle);
    mock.routes.set('POST /agentmemory/actions/edges', { status: 201, body: { ok: true } });
    const { exitCode } = await runBridge(['plan-sync', FIXTURE], {
      AGENTMEMORY_URL: mock.url,
      AGENTMEMORY_PROJECT: 'superpowers-agentmemory',
    });
    expect(exitCode).toBe(0);
    const creates = mock.requests.filter((r) => r.path === '/agentmemory/actions' && r.method === 'POST');
    expect(creates[0].body.project).toBe('superpowers-agentmemory');
  } finally {
    mock.stop();
  }
});

test('plan-sync warns and skips edges to unknown task numbers', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-plan-'));
  const tempPlan = path.join(tempDir, 'plan.md');
  fs.writeFileSync(tempPlan, `### Task 1: A\n\nRequires: Task 9\n\n- [ ] step\n`);
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/actions', actionIdFromTitle);
    const { exitCode, stderr } = await runBridge(['plan-sync', tempPlan], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(0);
    expect(mock.requests.filter((r) => r.path === '/agentmemory/actions/edges')).toHaveLength(0);
    expect(stderr).toContain('edge skipped');
  } finally {
    mock.stop();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('plan-sync exits 1 for a missing file', async () => {
  const { exitCode, stderr } = await runBridge(['plan-sync', 'no-such-plan.md'], {});
  expect(exitCode).toBe(1);
  expect(stderr).toContain('cannot read');
});

test('plan-sync exits 1 with usage when no planfile is given', async () => {
  const { exitCode, stderr } = await runBridge(['plan-sync'], {});
  expect(exitCode).toBe(1);
  expect(stderr).toContain('Usage:');
});

test('plan-sync exits 1 when action creation fails', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/actions', { status: 500, body: { error: 'boom' } });
    const { exitCode, stderr } = await runBridge(['plan-sync', FIXTURE], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('actions create failed');
  } finally {
    mock.stop();
  }
});

test('plan-sync exits 1 when edge creation fails', async () => {
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/actions', actionIdFromTitle);
    mock.routes.set('POST /agentmemory/actions/edges', { status: 400, body: { error: 'bad edge' } });
    const { exitCode, stderr } = await runBridge(['plan-sync', FIXTURE], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(1);
    expect(stderr).toContain('edge create failed');
  } finally {
    mock.stop();
  }
});
