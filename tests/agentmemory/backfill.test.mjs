import { test, expect } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MAX_CONTENT_CHARS } from '../../scripts/agentmemory-bridge.mjs';
import { startMockServer } from './mock-server.mjs';
import { runBridge } from './run-bridge.mjs';

function makeFixtureDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-backfill-'));
  fs.mkdirSync(path.join(root, 'docs', 'superpowers', 'specs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'superpowers', 'plans'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'superpowers', 'specs', 'a-spec.md'), '# A Spec\n\ncontent A');
  fs.writeFileSync(path.join(root, 'docs', 'superpowers', 'plans', 'b-plan.md'), '# B Plan\n\ncontent B');
  fs.writeFileSync(path.join(root, 'docs', 'superpowers', 'plans', 'README.md'), '# readme');
  fs.writeFileSync(path.join(root, 'docs', 'superpowers', 'plans', 'notes.txt'), 'not markdown');
  return root;
}

test('backfill remembers each markdown file with type, concepts, and files', async () => {
  const fixture = makeFixtureDir();
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/remember', { status: 201, body: { id: 'm1' } });
    const specs = path.join(fixture, 'docs', 'superpowers', 'specs');
    const plans = path.join(fixture, 'docs', 'superpowers', 'plans');
    const { exitCode, stdout } = await runBridge(['backfill', specs, plans], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('3 indexed, 0 failed');

    const remembers = mock.requests.filter((r) => r.path === '/agentmemory/remember');
    expect(remembers).toHaveLength(3);

    const spec = remembers.find((r) => r.body.files[0].endsWith('a-spec.md'));
    expect(spec.body.type).toBe('spec');
    expect(spec.body.concepts).toEqual(['source:spec', 'a-spec']);
    expect(spec.body.content).toContain('# A Spec');
    expect(spec.body.files[0]).toContain('docs/superpowers/specs/a-spec.md');

    const plan = remembers.find((r) => r.body.files[0].endsWith('b-plan.md'));
    expect(plan.body.type).toBe('plan');
    expect(plan.body.concepts).toEqual(['source:plan', 'b-plan']);

    expect(remembers.some((r) => r.body.files[0].endsWith('notes.txt'))).toBe(false);
  } finally {
    mock.stop();
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('backfill defaults to docs/superpowers/specs and docs/superpowers/plans', async () => {
  const fixture = makeFixtureDir();
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/remember', { status: 201, body: { id: 'm1' } });
    const { exitCode } = await runBridge(['backfill'], { AGENTMEMORY_URL: mock.url }, fixture);
    expect(exitCode).toBe(0);
    expect(mock.requests.filter((r) => r.path === '/agentmemory/remember')).toHaveLength(3);
  } finally {
    mock.stop();
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('backfill truncates content at MAX_CONTENT_CHARS', async () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-backfill-'));
  const specs = path.join(fixture, 'specs');
  fs.mkdirSync(specs, { recursive: true });
  fs.writeFileSync(path.join(specs, 'long.md'), 'x'.repeat(10000));
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/remember', { status: 201, body: { id: 'm1' } });
    const { exitCode } = await runBridge(['backfill', specs], { AGENTMEMORY_URL: mock.url });
    expect(exitCode).toBe(0);
    const body = mock.requests[0].body;
    expect(body.content.length).toBeLessThanOrEqual(MAX_CONTENT_CHARS + '\n...[truncated]'.length);
    expect(body.content).toContain('[truncated]');
  } finally {
    mock.stop();
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('backfill exits 1 when a remember fails', async () => {
  const fixture = makeFixtureDir();
  const mock = startMockServer();
  try {
    mock.routes.set('POST /agentmemory/remember', { status: 500, body: { error: 'boom' } });
    const { exitCode, stderr } = await runBridge(
      ['backfill', path.join(fixture, 'docs', 'superpowers', 'specs')],
      { AGENTMEMORY_URL: mock.url }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toContain('remember failed');
  } finally {
    mock.stop();
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

// An ACL-denied .md file makes fs.readFileSync throw (EPERM on Windows).
// The test returns early when the deny does not take effect (elevated shells
// bypass ACLs) so it stays portable.
test.skipIf(process.platform !== 'win32')('backfill counts an unreadable file as failed and continues', async () => {
  const fixture = makeFixtureDir();
  const specs = path.join(fixture, 'docs', 'superpowers', 'specs');
  const denied = path.join(specs, 'denied.md');
  fs.writeFileSync(denied, '# denied');
  Bun.spawnSync(['icacls', denied, '/deny', 'Everyone:(R)'], { stdout: 'pipe', stderr: 'pipe' });
  let denyEffective = false;
  try {
    fs.readFileSync(denied, 'utf8');
  } catch {
    denyEffective = true;
  }
  try {
    if (!denyEffective) return; // elevated shell bypasses ACLs — nothing to assert
    const mock = startMockServer();
    try {
      mock.routes.set('POST /agentmemory/remember', { status: 201, body: { id: 'm1' } });
      const plans = path.join(fixture, 'docs', 'superpowers', 'plans');
      const { exitCode, stdout } = await runBridge(['backfill', specs, plans], { AGENTMEMORY_URL: mock.url });
      expect(exitCode).toBe(1); // failed >= 1 keeps the existing exit-code contract
      expect(stdout).toContain('backfill: 3 indexed, 1 failed');
      expect(mock.requests.filter((r) => r.path === '/agentmemory/remember')).toHaveLength(3);
    } finally {
      mock.stop();
    }
  } finally {
    Bun.spawnSync(['icacls', denied, '/remove:d', 'Everyone'], { stdout: 'pipe', stderr: 'pipe' });
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
