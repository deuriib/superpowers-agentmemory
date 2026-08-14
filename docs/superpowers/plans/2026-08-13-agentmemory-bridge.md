# Agentmemory Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the superpowers fork a zero-dependency Bun CLI bridge to the local agentmemory server so plans materialize into the action DAG, sessions close with summaries and crystals, and repo docs get indexed â€” while the deterministic file contract stays untouched.

**Architecture:** A single zero-dependency script `scripts/agentmemory-bridge.mjs` exposes six subcommands (`health`, `plan-sync`, `task-claim`, `task-done`, `session-close`, `backfill`) speaking the verified REST contract under `/agentmemory/*` (design doc Â§8). Every test runs against a shared in-memory mock HTTP server (`tests/agentmemory/mock-server.mjs`, `Bun.serve`) that captures requests and serves canned responses â€” no live-server dependency. Documentation deliverables (a new `agentmemory-bridge` skill, appended optional steps in two skills, and the `AGENTS.md` protocol) wire the CLI into the workflow.

**Tech Stack:** Bun 1.3.14 (`bun:test`, `Bun.serve`, `Bun.spawn`, native `fetch`, `import.meta.main`), plain ESM JavaScript, zero npm dependencies.

**Spec:** `docs/superpowers/specs/2026-08-13-agentmemory-bridge-design.md`

## Global Constraints

- **Runtime is Bun 1.3.14 only** â€” `node` is NOT on PATH. Every run/test command uses `bun` (`bun test tests/agentmemory/`, `bun scripts/agentmemory-bridge.mjs health`). The shell is Windows PowerShell 5.1 (repo is win32).
- **Zero dependencies:** the bridge is one script using only native APIs (`fetch`, `fs`, `path`, `process.argv`). No `npm install`, no `package.json`, no external libraries â€” ever.
- **REST contract verbatim from design doc Â§8** (verified live against server v0.9.28): the bridge appends `/agentmemory` to `AGENTMEMORY_URL`, so `AGENTMEMORY_URL` is the server *origin* (default `http://localhost:3111`) and request paths are `/agentmemory/...` full paths (e.g. `POST /agentmemory/actions`, `GET /agentmemory/frontier`).
- **Auth:** when `AGENTMEMORY_SECRET` is set, every request carries `Authorization: Bearer $AGENTMEMORY_SECRET`; when unset, no header is sent.
- **Tests never depend on the live server:** `bun:test` + the local mock in `tests/agentmemory/`; Task 12 (E2E) is the only task that touches the live server, and it health-gates first.
- **Slots are OFF on the live server** (`AGENTMEMORY_SLOTS` â†’ `POST /agentmemory/slot` returns 503): `session-close` must degrade gracefully â€” on slot failure it falls back to `POST /agentmemory/remember` with `concepts: ["slot:session-summary"]` (design Â§8, Â§9).
- **`plan-sync` parser is simple and deterministic:** regex over `### Task N:` headers and line-anchored `Consumes:`/`Requires: Task N` references only. The plan file stays the source of truth; the DAG is a mirror (golden rule, design Â§2).
- **`plan-sync` is create-only and not idempotent** â€” re-running duplicates actions. Documented limitation (design Â§9 "DAG desyncâ€¦ reconcile at close"); do not build reconciliation in this plan.
- **Fork-local only** (design Â§7, Â§11): no upstream PRs; do not modify eval-tuned skill content â€” the only skill edits allowed are the appended optional sections at the end of `writing-plans` and `subagent-driven-development` (Task 10).
- **Golden rule** (design Â§2): deterministic stays in files; agentmemory indexes and complements. The bridge must fail fast and never block the workflow when the server is down.
- **Commit style matches the repo log** (`git log --oneline -10`): scoped `feat(...)`, `docs(...)`, `test(...)` messages. Every task ends with a commit after its tests pass.

---

## File Map

| File | Responsibility | Tasks |
|---|---|---|
| Create: `scripts/agentmemory-bridge.mjs` | Zero-dep CLI: `apiRequest` client, subcommands, dispatch | 1â€“8 |
| Create: `tests/agentmemory/mock-server.mjs` | In-memory agentmemory mock (`Bun.serve`): captures requests, serves canned/function routes | 1 |
| Create: `tests/agentmemory/run-bridge.mjs` | Spawns the bridge CLI as a subprocess, returns exit/stdout/stderr | 1 |
| Create: `tests/agentmemory/bridge-usage.test.mjs` | Usage/dispatch behavior of the skeleton | 1 |
| Create: `tests/agentmemory/api-client.test.mjs` | `apiRequest`, extractors, `health` subcommand | 2 |
| Create: `tests/agentmemory/backfill.test.mjs` | `backfill` subcommand | 3 |
| Create: `tests/agentmemory/plan-parser.test.mjs` | `parsePlan` pure function | 4 |
| Create: `tests/agentmemory/plan-sync.test.mjs` | `plan-sync` CLI against mock | 5 |
| Create: `tests/agentmemory/fixtures/sample-plan.md` | Deterministic plan fixture (also used by E2E) | 5 |
| Create: `tests/agentmemory/task-claim.test.mjs` | `task-claim` subcommand | 6 |
| Create: `tests/agentmemory/task-done.test.mjs` | `task-done` subcommand | 7 |
| Create: `tests/agentmemory/session-close.test.mjs` | `session-close` subcommand + slot fallback | 8 |
| Create: `skills/agentmemory-bridge/SKILL.md` | Bridge usage + RECALLâ†’â€¦â†’SAVE flow with real endpoint names | 9 |
| Modify: `skills/writing-plans/SKILL.md` | Append optional bridge section at end of file | 10 |
| Modify: `skills/subagent-driven-development/SKILL.md` | Append optional bridge section at end of file | 10 |
| Modify: `AGENTS.md` | Replace `CLAUDE.md` with pointer + agentmemory protocol | 11 |

Phases (design doc Â§10): **Phase 0** Infra & Health â†’ Tasks 1â€“2; **Phase 1** Backfill â†’ Task 3; **Phase 2** PLANâ†’DAG â†’ Tasks 4â€“7; **Phase 3** Session Close â†’ Task 8; **Phase 4** Documentation & E2E â†’ Tasks 9â€“12.

---

## Phase 0 â€” Infra & Health

### Task 1: Bridge Skeleton + Mock Server Test Harness

**Files:**
- Create: `scripts/agentmemory-bridge.mjs`
- Create: `tests/agentmemory/mock-server.mjs`
- Create: `tests/agentmemory/run-bridge.mjs`
- Test: `tests/agentmemory/bridge-usage.test.mjs`

**Interfaces:**
- Consumes: nothing (first task).
- Produces (everything below is used by every later task):
  - `startMockServer()` from `tests/agentmemory/mock-server.mjs` â†’ `{ url: string, requests: Array<{method, path, query, headers, body}>, routes: Map<string, object|Function>, reset(): void, stop(): void }`. Routes keyed `"METHOD /agentmemory/<path>"`, values are `{ status, body }`, `{ status, raw }` (raw string body), or `(request) => { status, body }` (dynamic).
  - `runBridge(args: string[], env: object, cwd?: string)` from `tests/agentmemory/run-bridge.mjs` â†’ `Promise<{ exitCode: number, stdout: string, stderr: string }>`.
  - `usage()` â†’ string, `main(argv: string[])` â†’ Promise<number> (exit code), `SUBCOMMANDS` â†’ `Record<string, (â€¦args) => Promise<number>>` from `scripts/agentmemory-bridge.mjs`. `import.meta.main` guard runs the CLI.

- [ ] **Step 1: Write the failing tests**

Create `tests/agentmemory/mock-server.mjs`:

```js
// tests/agentmemory/mock-server.mjs
// Shared in-memory agentmemory mock for bridge tests. Records every request
// and serves canned responses registered in `routes`. Tests never touch the
// live server. Paths mirror the real server under /agentmemory/*.
//
// Route values: { status, body } | { status, raw } | (request) => { status, body }

export function startMockServer() {
  const requests = [];
  const routes = new Map();

  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      const key = `${req.method} ${url.pathname}`;
      let body = null;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        try {
          body = await req.json();
        } catch {
          body = null;
        }
      }
      const request = {
        method: req.method,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        headers: Object.fromEntries(req.headers),
        body,
      };
      requests.push(request);

      const route = routes.get(key);
      if (typeof route === 'function') {
        const canned = route(request);
        if (canned && canned.raw !== undefined) {
          return new Response(canned.raw, { status: canned.status });
        }
        return Response.json(canned ? canned.body : null, { status: canned ? canned.status : 200 });
      }
      if (route && route.raw !== undefined) {
        return new Response(route.raw, { status: route.status });
      }
      return Response.json(route ? route.body : { error: 'not found' }, {
        status: route ? route.status : 404,
      });
    },
  });

  return {
    url: `http://localhost:${server.port}`,
    requests,
    routes,
    reset() {
      requests.length = 0;
    },
    stop() {
      server.stop(true);
    },
  };
}
```

Create `tests/agentmemory/run-bridge.mjs`:

```js
// tests/agentmemory/run-bridge.mjs
// Spawns the bridge CLI as a subprocess and returns its exit code, stdout,
// and stderr. All bridge CLI tests use this helper.

import path from 'path';

const BRIDGE = path.join(import.meta.dir, '..', '..', 'scripts', 'agentmemory-bridge.mjs');

export async function runBridge(args, env = {}, cwd = undefined) {
  const proc = Bun.spawn([process.execPath, BRIDGE, ...args], {
    env: { ...process.env, ...env },
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const exitCode = await proc.exited;
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { exitCode, stdout, stderr };
}
```

Create `tests/agentmemory/bridge-usage.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/agentmemory/`

Expected: FAIL â€” `tests/agentmemory/bridge-usage.test.mjs` cannot resolve `./mock-server.mjs`/`./run-bridge.mjs` (modules not created yet).

- [ ] **Step 3: Create the bridge skeleton**

Create `scripts/agentmemory-bridge.mjs`:

```js
#!/usr/bin/env bun
// scripts/agentmemory-bridge.mjs
// Zero-dependency agentmemory bridge for the superpowers fork.
// Subcommands: health, plan-sync, task-claim, task-done, session-close, backfill.
// REST contract: design doc 2026-08-13 Â§8, under ${AGENTMEMORY_URL:-http://localhost:3111}/agentmemory.

export const DEFAULT_ORIGIN = 'http://localhost:3111';

export function baseUrl() {
  return (process.env.AGENTMEMORY_URL || DEFAULT_ORIGIN) + '/agentmemory';
}

export function usage() {
  return `agentmemory bridge â€” zero-dependency memory CLI

Usage: bun scripts/agentmemory-bridge.mjs <subcommand> [args]

Subcommands:
  health                          Probe server liveness (GET /agentmemory/livez)
  plan-sync <planfile>            Create one action per "### Task N:" header and
                                  wire "Consumes:/Requires: Task N" edges
                                  (POST /agentmemory/actions, POST /agentmemory/actions/edges)
  task-claim <actionId>           Acquire a lease and mark the action active
                                  (POST /agentmemory/leases/acquire, POST /agentmemory/actions/update)
  task-done <actionId> [result]   Release the lease and mark the action done
                                  (POST /agentmemory/leases/release, POST /agentmemory/actions/update)
  session-close <sessionId> [actionIds...]  Summarize the session, store the summary
                                  (slot with remember fallback), crystallize closed actions
                                  (POST /agentmemory/summarize, POST /agentmemory/slot,
                                   POST /agentmemory/remember, POST /agentmemory/crystals/create)
  backfill [dir...]               Index markdown docs (POST /agentmemory/remember);
                                  defaults to docs/superpowers/specs and docs/superpowers/plans

Environment:
  AGENTMEMORY_URL       Server origin (default http://localhost:3111)
  AGENTMEMORY_SECRET    Bearer token sent when set
  AGENTMEMORY_AGENT_ID  Agent identity for leases (default superpowers-agent)
  AGENTMEMORY_PROJECT   Project name attached to writes
`;
}

export const SUBCOMMANDS = {};

export async function main(argv) {
  const [subcommand, ...args] = argv;
  if (!subcommand || !(subcommand in SUBCOMMANDS)) {
    console.error(usage());
    return 1;
  }
  try {
    return await SUBCOMMANDS[subcommand](...args);
  } catch (err) {
    console.error(`${subcommand}: ${err.message}`);
    return 1;
  }
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/agentmemory/`

Expected: PASS â€” 4 tests green (2 usage tests exercise the skeleton dispatch; 2 mock tests exercise the harness).

- [ ] **Step 5: Commit**

```bash
git add scripts/agentmemory-bridge.mjs tests/agentmemory/mock-server.mjs tests/agentmemory/run-bridge.mjs tests/agentmemory/bridge-usage.test.mjs
git commit -m "feat(bridge): scaffold agentmemory CLI and mock server test harness"
```

Expected: commit succeeds with exactly the four files staged.

### Task 2: HTTP Client + `health` Subcommand

**Files:**
- Modify: `scripts/agentmemory-bridge.mjs`
- Test: `tests/agentmemory/api-client.test.mjs`

**Interfaces:**
- Consumes: `baseUrl()`, `usage()`, `SUBCOMMANDS`, `main()` (Task 1); `startMockServer()` (Task 1); `runBridge()` (Task 1).
- Produces (used by Tasks 3â€“8):
  - `apiRequest(method: string, path: string, opts?: { query?: object, body?: object })` â†’ `Promise<{ status: number, ok: boolean, json: any }>`; reads `AGENTMEMORY_URL`/`AGENTMEMORY_SECRET` from env on every call.
  - `agentId()` â†’ string (env `AGENTMEMORY_AGENT_ID`, default `'superpowers-agent'`).
  - `extractActionId(json)` â†’ `string|null`; `extractStatus(json)` â†’ `string|null`; `extractSummaryText(json)` â†’ `string|null` (defensive response-shape helpers for the live server).
  - `cmdHealth()` â†’ Promise<number> exit code; registered as `SUBCOMMANDS.health`.

- [ ] **Step 1: Write the failing tests**

Create `tests/agentmemory/api-client.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/agentmemory/api-client.test.mjs`

Expected: FAIL â€” importing `apiRequest`, `agentId`, `extractActionId`, `extractStatus`, `extractSummaryText` fails ("named export not found") and `runBridge(['health'])` exits 1 with usage because `SUBCOMMANDS.health` is not registered.

- [ ] **Step 3: Implement the HTTP client, extractors, and `health`**

Append to `scripts/agentmemory-bridge.mjs` (after `usage()`):

```js
export function agentId() {
  return process.env.AGENTMEMORY_AGENT_ID || 'superpowers-agent';
}

export function extractActionId(json) {
  if (!json || typeof json !== 'object') return null;
  if (typeof json.actionId === 'string') return json.actionId;
  if (typeof json.id === 'string') return json.id;
  if (json.action && typeof json.action.id === 'string') return json.action.id;
  return null;
}

export function extractStatus(json) {
  if (!json || typeof json !== 'object') return null;
  if (typeof json.status === 'string') return json.status;
  if (json.action && typeof json.action.status === 'string') return json.action.status;
  return null;
}

export function extractSummaryText(json) {
  if (!json || typeof json !== 'object') return null;
  for (const key of ['summary', 'content', 'text']) {
    if (typeof json[key] === 'string') return json[key];
  }
  return null;
}

export async function apiRequest(method, path, { query, body } = {}) {
  const url = new URL(baseUrl() + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.AGENTMEMORY_SECRET) {
    headers.Authorization = `Bearer ${process.env.AGENTMEMORY_SECRET}`;
  }
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    // non-JSON body â€” json stays null
  }
  return { status: response.status, ok: response.ok, json };
}

export async function cmdHealth() {
  let result;
  try {
    result = await apiRequest('GET', '/livez');
  } catch (err) {
    console.error(`health: server unreachable at ${baseUrl()}: ${err.message}`);
    return 1;
  }
  if (!result.ok) {
    console.error(`health: server returned ${result.status}`);
    return 1;
  }
  console.log(`healthy: agentmemory reachable at ${baseUrl()}`);
  return 0;
}

SUBCOMMANDS.health = cmdHealth;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/agentmemory/`

Expected: PASS â€” all 14 tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/agentmemory-bridge.mjs tests/agentmemory/api-client.test.mjs
git commit -m "feat(bridge): add HTTP client and health subcommand"
```

Expected: commit succeeds with the two files staged.

---

## Phase 1 â€” Backfill

### Task 3: `backfill` Subcommand

**Files:**
- Modify: `scripts/agentmemory-bridge.mjs`
- Test: `tests/agentmemory/backfill.test.mjs`

**Interfaces:**
- Consumes: `apiRequest()` (Task 2); `startMockServer()`, `runBridge()` (Task 1).
- Produces:
  - `MAX_CONTENT_CHARS` â†’ `8000` (exported constant).
  - `walkMarkdownFiles(dir: string)` â†’ `string[]` â€” recursive, lexicographically sorted, `.md` only.
  - `truncate(text: string, maxChars: number)` â†’ string (appends `\n...[truncated]` when cut).
  - `cmdBackfill(...dirs: string[])` â†’ Promise<number> exit code; registered as `SUBCOMMANDS.backfill`. Default dirs: `docs/superpowers/specs`, `docs/superpowers/plans`. Each file â†’ `POST /agentmemory/remember` with `{ content, type: 'spec'|'plan', concepts: ['source:spec'|'source:plan', basename], files: [relPath], project? }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/agentmemory/backfill.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/agentmemory/backfill.test.mjs`

Expected: FAIL â€” import of `MAX_CONTENT_CHARS` fails (not exported) and `runBridge(['backfill', ...])` exits 1 with usage (`SUBCOMMANDS.backfill` not registered).

- [ ] **Step 3: Implement `backfill`**

First add the imports at the top of `scripts/agentmemory-bridge.mjs` (the file currently has no imports â€” put them on lines 1â€“2, before the shebang comment block stays as-is):

```js
import fs from 'fs';
import path from 'path';
```

Then append after the `SUBCOMMANDS.health = cmdHealth;` line:

```js
export const MAX_CONTENT_CHARS = 8000;
export const DEFAULT_BACKFILL_DIRS = ['docs/superpowers/specs', 'docs/superpowers/plans'];

export function truncate(text, maxChars) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n...[truncated]';
}

export function walkMarkdownFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0
  );
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

export async function cmdBackfill(...dirs) {
  const targets = dirs.length > 0 ? dirs : DEFAULT_BACKFILL_DIRS;
  const project = process.env.AGENTMEMORY_PROJECT;
  let indexed = 0;
  let failed = 0;
  for (const dir of targets) {
    let files;
    try {
      files = walkMarkdownFiles(dir);
    } catch (err) {
      console.error(`backfill: cannot read ${dir}: ${err.message}`);
      failed += 1;
      continue;
    }
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const relPath = path.relative(process.cwd(), file).split(path.sep).join('/');
      const isSpec = relPath.includes('/specs/');
      const body = {
        content: truncate(content, MAX_CONTENT_CHARS),
        type: isSpec ? 'spec' : 'plan',
        concepts: [isSpec ? 'source:spec' : 'source:plan', path.basename(file, '.md')],
        files: [relPath],
      };
      if (project) body.project = project;
      const result = await apiRequest('POST', '/remember', { body });
      if (!result.ok) {
        console.error(`backfill: remember failed for ${relPath} (${result.status}): ${JSON.stringify(result.json)}`);
        failed += 1;
      } else {
        indexed += 1;
        console.log(`backfill: indexed ${relPath}`);
      }
    }
  }
  console.log(`backfill: ${indexed} indexed, ${failed} failed`);
  return failed === 0 ? 0 : 1;
}

SUBCOMMANDS.backfill = cmdBackfill;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/agentmemory/`

Expected: PASS â€” all 18 tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/agentmemory-bridge.mjs tests/agentmemory/backfill.test.mjs
git commit -m "feat(bridge): add backfill subcommand"
```

Expected: commit succeeds with the two files staged.

---

## Phase 2 â€” PLANâ†’DAG

### Task 4: Plan Markdown Parser

**Files:**
- Modify: `scripts/agentmemory-bridge.mjs`
- Test: `tests/agentmemory/plan-parser.test.mjs`

**Interfaces:**
- Consumes: nothing new (pure function).
- Produces:
  - `parsePlan(markdown: string)` â†’ `Array<{ index: number, title: string, body: string, requires: number[] }>` â€” one entry per `### Task N:` header; `requires` from line-anchored `Consumes:`/`Requires: Task N` references (deduplicated, order-preserving).

- [ ] **Step 1: Write the failing tests**

Create `tests/agentmemory/plan-parser.test.mjs`:

```js
import { test, expect } from 'bun:test';
import { parsePlan } from '../../scripts/agentmemory-bridge.mjs';

const SAMPLE = `# Sample Plan

**Goal:** Exercise the plan-sync bridge.

### Task 1: Alpha

- [ ] Implement alpha

### Task 2: Beta

Consumes: Task 1

- [ ] Implement beta on top of alpha

### Task 3: Gamma

Requires: Task 2

- [x] Gamma already done
`;

test('parsePlan extracts tasks with titles and bodies', () => {
  const tasks = parsePlan(SAMPLE);
  expect(tasks).toHaveLength(3);
  expect(tasks[0]).toMatchObject({ index: 1, title: 'Alpha' });
  expect(tasks[1]).toMatchObject({ index: 2, title: 'Beta' });
  expect(tasks[2]).toMatchObject({ index: 3, title: 'Gamma' });
  expect(tasks[2].body).toContain('- [x] Gamma already done');
});

test('parsePlan maps Consumes/Requires references to dependency numbers', () => {
  const tasks = parsePlan(SAMPLE);
  expect(tasks[0].requires).toEqual([]);
  expect(tasks[1].requires).toEqual([1]);
  expect(tasks[2].requires).toEqual([2]);
});

test('parsePlan handles bold bullets and deduplicates dependencies', () => {
  const md = `### Task 1: A

- **Consumes:** Task 2
- **Consumes:** Task 2

### Task 2: B
`;
  const tasks = parsePlan(md);
  expect(tasks[0].requires).toEqual([2]);
});

test('parsePlan ignores mid-line prose but keeps explicit references', () => {
  const md = `### Task 1: A

This task requires Task 2 to be merged first.

Requires: Task 9

### Task 2: B
`;
  const tasks = parsePlan(md);
  expect(tasks[0].requires).toEqual([9]);
});

test('parsePlan ignores h4 headers and returns an empty array without task headers', () => {
  expect(parsePlan('# No tasks here\n\n- [ ] not a task\n')).toEqual([]);
  const md = `### Task 1: A\n\n#### Task 1: Not A Header\n\n### Task 2: B\n`;
  const tasks = parsePlan(md);
  expect(tasks).toHaveLength(2);
  expect(tasks[0].body).toContain('#### Task 1: Not A Header');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/agentmemory/plan-parser.test.mjs`

Expected: FAIL â€” `parsePlan` is not exported by the bridge module.

- [ ] **Step 3: Implement `parsePlan`**

Append to `scripts/agentmemory-bridge.mjs`:

```js
const TASK_HEADER_RE = /^### Task (\d+): (.+)$/gm;

export function parsePlan(markdown) {
  const tasks = [];
  const headers = [];
  let match;
  while ((match = TASK_HEADER_RE.exec(markdown)) !== null) {
    headers.push({ index: Number(match[1]), title: match[2].trim(), start: match.index + match[0].length });
  }
  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i];
    const end = i + 1 < headers.length ? headers[i + 1].start : markdown.length;
    const body = markdown.slice(header.start, end).trim();
    // Fresh regex per body: a module-level /g regex would keep lastIndex
    // across bodies and silently skip matches.
    const depRe = /^\s*(?:[-*]\s*)?(?:\*\*)?(?:consumes|requires):(?:\*\*)?\s*task\s+(\d+)/gim;
    const requires = [];
    let dep;
    while ((dep = depRe.exec(body)) !== null) {
      const n = Number(dep[1]);
      if (!requires.includes(n)) requires.push(n);
    }
    tasks.push({ index: header.index, title: header.title, body, requires });
  }
  return tasks;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/agentmemory/`

Expected: PASS â€” all 23 tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/agentmemory-bridge.mjs tests/agentmemory/plan-parser.test.mjs
git commit -m "feat(bridge): add plan markdown parser"
```

Expected: commit succeeds with the two files staged.

### Task 5: `plan-sync` Subcommand

**Files:**
- Modify: `scripts/agentmemory-bridge.mjs`
- Create: `tests/agentmemory/fixtures/sample-plan.md`
- Test: `tests/agentmemory/plan-sync.test.mjs`

**Interfaces:**
- Consumes: `parsePlan()` (Task 4), `apiRequest()`, `extractActionId()`, `usage()` (Task 2); mock + `runBridge` (Task 1).
- Produces:
  - `MAX_DESCRIPTION_CHARS` â†’ `2000` (exported constant).
  - `cmdPlanSync(planPath: string)` â†’ Promise<number> exit code; registered as `SUBCOMMANDS['plan-sync']`. Two passes: create all actions (`POST /agentmemory/actions`, body `{ title: '[N] <title>', description: body.slice(0, 2000), tags: ['plan-sync'], project? }`), then wire edges (`POST /agentmemory/actions/edges`, body `{ sourceActionId, targetActionId, type: 'requires' }`) for every `requires` entry whose target exists. Prints `JSON.stringify({ plan, actions: [{task, actionId, title}], edges: [{source, target}] }, null, 2)` on success.
  - Fixture `tests/agentmemory/fixtures/sample-plan.md` (also consumed by Task 12 E2E).

- [ ] **Step 1: Write the failing tests and fixture**

Create `tests/agentmemory/fixtures/sample-plan.md`:

```markdown
# Sample Bridge Plan

**Goal:** Deterministic fixture for plan-sync bridge tests and the live E2E.

### Task 1: Alpha

- [ ] Implement alpha

### Task 2: Beta

Consumes: Task 1

- [ ] Implement beta on top of alpha

### Task 3: Gamma

Requires: Task 2

- [x] Gamma already done
```

Create `tests/agentmemory/plan-sync.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/agentmemory/plan-sync.test.mjs`

Expected: FAIL â€” `runBridge(['plan-sync', ...])` exits 1 with usage (`SUBCOMMANDS['plan-sync']` not registered).

- [ ] **Step 3: Implement `cmdPlanSync`**

Append to `scripts/agentmemory-bridge.mjs`:

```js
export const MAX_DESCRIPTION_CHARS = 2000;

export async function cmdPlanSync(planPath) {
  if (!planPath) {
    console.error('plan-sync: missing <planfile> argument\n\n' + usage());
    return 1;
  }
  let markdown;
  try {
    markdown = await Bun.file(planPath).text();
  } catch (err) {
    console.error(`plan-sync: cannot read ${planPath}: ${err.message}`);
    return 1;
  }
  const tasks = parsePlan(markdown);
  if (tasks.length === 0) {
    console.error(`plan-sync: no "### Task N:" headers found in ${planPath}`);
    return 1;
  }

  const project = process.env.AGENTMEMORY_PROJECT;
  const byIndex = new Map();
  for (const task of tasks) {
    const body = {
      title: `[${task.index}] ${task.title}`,
      description: task.body.slice(0, MAX_DESCRIPTION_CHARS),
      tags: ['plan-sync'],
    };
    if (project) body.project = project;
    const result = await apiRequest('POST', '/actions', { body });
    if (!result.ok) {
      console.error(`plan-sync: actions create failed for task ${task.index} (${result.status}): ${JSON.stringify(result.json)}`);
      return 1;
    }
    const actionId = extractActionId(result.json);
    if (!actionId) {
      console.error(`plan-sync: actions create for task ${task.index} returned no actionId: ${JSON.stringify(result.json)}`);
      return 1;
    }
    byIndex.set(task.index, actionId);
  }

  const edges = [];
  for (const task of tasks) {
    const sourceActionId = byIndex.get(task.index);
    for (const dep of task.requires) {
      const targetActionId = byIndex.get(dep);
      if (!targetActionId) {
        console.warn(`plan-sync: task ${task.index} requires unknown task ${dep} â€” edge skipped`);
        continue;
      }
      const result = await apiRequest('POST', '/actions/edges', {
        body: { sourceActionId, targetActionId, type: 'requires' },
      });
      if (!result.ok) {
        console.error(`plan-sync: edge create failed (${result.status}) for task ${task.index} -> ${dep}: ${JSON.stringify(result.json)}`);
        return 1;
      }
      edges.push({ source: task.index, target: dep });
    }
  }

  const actions = tasks.map((task) => ({
    task: task.index,
    actionId: byIndex.get(task.index),
    title: `[${task.index}] ${task.title}`,
  }));
  console.log(JSON.stringify({ plan: planPath, actions, edges }, null, 2));
  return 0;
}

SUBCOMMANDS['plan-sync'] = cmdPlanSync;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/agentmemory/`

Expected: PASS â€” all 30 tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/agentmemory-bridge.mjs tests/agentmemory/plan-sync.test.mjs tests/agentmemory/fixtures/sample-plan.md
git commit -m "feat(bridge): add plan-sync subcommand"
```

Expected: commit succeeds with the three paths staged.

### Task 6: `task-claim` Subcommand

**Files:**
- Modify: `scripts/agentmemory-bridge.mjs`
- Test: `tests/agentmemory/task-claim.test.mjs`

**Interfaces:**
- Consumes: `apiRequest()`, `agentId()`, `usage()` (Task 2); mock + `runBridge` (Task 1).
- Produces:
  - `DEFAULT_TTL_MS` â†’ `3600000` (exported constant, 1 hour).
  - `cmdTaskClaim(actionId: string)` â†’ Promise<number> exit code; registered as `SUBCOMMANDS['task-claim']`. Calls `POST /agentmemory/leases/acquire` `{ actionId, agentId, ttlMs: 3600000 }`, then `POST /agentmemory/actions/update` `{ actionId, status: 'active', assignedTo: agentId }`. Prints `task-claim: <actionId> claimed by <agentId> (lease 3600000ms)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/agentmemory/task-claim.test.mjs`:

```js
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

test('task-claim exits 1 with usage when no actionId is given', async () => {
  const { exitCode, stderr } = await runBridge(['task-claim'], {});
  expect(exitCode).toBe(1);
  expect(stderr).toContain('Usage:');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/agentmemory/task-claim.test.mjs`

Expected: FAIL â€” `runBridge(['task-claim', ...])` exits 1 with usage (`SUBCOMMANDS['task-claim']` not registered).

- [ ] **Step 3: Implement `cmdTaskClaim`**

Append to `scripts/agentmemory-bridge.mjs`:

```js
export const DEFAULT_TTL_MS = 60 * 60 * 1000;

export async function cmdTaskClaim(actionId) {
  if (!actionId) {
    console.error('task-claim: missing <actionId> argument\n\n' + usage());
    return 1;
  }
  const agent = agentId();
  const acquire = await apiRequest('POST', '/leases/acquire', {
    body: { actionId, agentId: agent, ttlMs: DEFAULT_TTL_MS },
  });
  if (!acquire.ok) {
    console.error(`task-claim: leases/acquire failed (${acquire.status}): ${JSON.stringify(acquire.json)}`);
    return 1;
  }
  const update = await apiRequest('POST', '/actions/update', {
    body: { actionId, status: 'active', assignedTo: agent },
  });
  if (!update.ok) {
    console.error(`task-claim: actions/update failed (${update.status}): ${JSON.stringify(update.json)}`);
    return 1;
  }
  console.log(`task-claim: ${actionId} claimed by ${agent} (lease ${DEFAULT_TTL_MS}ms)`);
  return 0;
}

SUBCOMMANDS['task-claim'] = cmdTaskClaim;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/agentmemory/`

Expected: PASS â€” all 34 tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/agentmemory-bridge.mjs tests/agentmemory/task-claim.test.mjs
git commit -m "feat(bridge): add task-claim subcommand"
```

Expected: commit succeeds with the two files staged.

### Task 7: `task-done` Subcommand

**Files:**
- Modify: `scripts/agentmemory-bridge.mjs`
- Test: `tests/agentmemory/task-done.test.mjs`

**Interfaces:**
- Consumes: `apiRequest()`, `agentId()`, `usage()` (Task 2); mock + `runBridge` (Task 1).
- Produces:
  - `cmdTaskDone(actionId: string, resultText?: string)` â†’ Promise<number> exit code; registered as `SUBCOMMANDS['task-done']`. Calls `POST /agentmemory/leases/release` `{ actionId, agentId, result? }`, then `POST /agentmemory/actions/update` `{ actionId, status: 'done', result? }`. Prints `task-done: <actionId> marked done`.

- [ ] **Step 1: Write the failing tests**

Create `tests/agentmemory/task-done.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/agentmemory/task-done.test.mjs`

Expected: FAIL â€” `runBridge(['task-done', ...])` exits 1 with usage (`SUBCOMMANDS['task-done']` not registered).

- [ ] **Step 3: Implement `cmdTaskDone`**

Append to `scripts/agentmemory-bridge.mjs`:

```js
export async function cmdTaskDone(actionId, resultText) {
  if (!actionId) {
    console.error('task-done: missing <actionId> argument\n\n' + usage());
    return 1;
  }
  const releaseBody = { actionId, agentId: agentId() };
  if (resultText) releaseBody.result = resultText;
  const release = await apiRequest('POST', '/leases/release', { body: releaseBody });
  if (!release.ok) {
    console.error(`task-done: leases/release failed (${release.status}): ${JSON.stringify(release.json)}`);
    return 1;
  }
  const updateBody = { actionId, status: 'done' };
  if (resultText) updateBody.result = resultText;
  const update = await apiRequest('POST', '/actions/update', { body: updateBody });
  if (!update.ok) {
    console.error(`task-done: actions/update failed (${update.status}): ${JSON.stringify(update.json)}`);
    return 1;
  }
  console.log(`task-done: ${actionId} marked done`);
  return 0;
}

SUBCOMMANDS['task-done'] = cmdTaskDone;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/agentmemory/`

Expected: PASS â€” all 39 tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/agentmemory-bridge.mjs tests/agentmemory/task-done.test.mjs
git commit -m "feat(bridge): add task-done subcommand"
```

Expected: commit succeeds with the two files staged.

---

## Phase 3 â€” Session Close

### Task 8: `session-close` Subcommand

**Files:**
- Modify: `scripts/agentmemory-bridge.mjs`
- Test: `tests/agentmemory/session-close.test.mjs`

**Interfaces:**
- Consumes: `apiRequest()`, `extractSummaryText()`, `extractStatus()`, `usage()` (Task 2); mock + `runBridge` (Task 1).
- Produces:
  - `cmdSessionClose(sessionId: string, ...actionIds: string[])` â†’ Promise<number> exit code; registered as `SUBCOMMANDS['session-close']`. Flow (design Â§5 close pattern + Â§9 risk mitigation):
    1. `POST /agentmemory/summarize` `{ sessionId }` â†’ summary text via `extractSummaryText`; failure exits 1 (server needs an LLM provider key).
    2. `POST /agentmemory/slot` `{ label: 'session-summary', content: summaryText, pinned: true }`; on any non-ok (live server: 503, slots off) fall back to `POST /agentmemory/remember` `{ content: summaryText, type: 'summary', concepts: ['slot:session-summary'], project? }`.
    3. If `actionIds` were given: `GET /agentmemory/actions/get?actionId=...` per action; every status must be `done` or `cancelled` (via `extractStatus`), else exit 1 before calling crystallize. Then `POST /agentmemory/crystals/create` `{ actionIds, sessionId, project? }`.
  - Prints `session-close: <sessionId> summarized and stored` on success.

- [ ] **Step 1: Write the failing tests**

Create `tests/agentmemory/session-close.test.mjs`:

```js
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

test('session-close exits 1 with usage when no sessionId is given', async () => {
  const { exitCode, stderr } = await runBridge(['session-close'], {});
  expect(exitCode).toBe(1);
  expect(stderr).toContain('Usage:');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test tests/agentmemory/session-close.test.mjs`

Expected: FAIL â€” `runBridge(['session-close', ...])` exits 1 with usage (`SUBCOMMANDS['session-close']` not registered).

- [ ] **Step 3: Implement `cmdSessionClose`**

Append to `scripts/agentmemory-bridge.mjs`:

```js
export const SLOT_LABEL = 'session-summary';
export const SLOT_FALLBACK_CONCEPT = 'slot:session-summary';

export async function cmdSessionClose(sessionId, ...actionIds) {
  if (!sessionId) {
    console.error('session-close: missing <sessionId> argument\n\n' + usage());
    return 1;
  }
  const project = process.env.AGENTMEMORY_PROJECT;

  const summary = await apiRequest('POST', '/summarize', { body: { sessionId } });
  if (!summary.ok) {
    console.error(`session-close: summarize failed (${summary.status}) â€” the server needs an LLM provider key; no summary stored`);
    return 1;
  }
  const summaryText = extractSummaryText(summary.json);
  if (!summaryText) {
    console.error(`session-close: summarize returned no summary text: ${JSON.stringify(summary.json)}`);
    return 1;
  }

  const slot = await apiRequest('POST', '/slot', {
    body: { label: SLOT_LABEL, content: summaryText, pinned: true },
  });
  if (!slot.ok) {
    console.warn(`session-close: slot unavailable (${slot.status}) â€” falling back to remember`);
    const rememberBody = { content: summaryText, type: 'summary', concepts: [SLOT_FALLBACK_CONCEPT] };
    if (project) rememberBody.project = project;
    const remembered = await apiRequest('POST', '/remember', { body: rememberBody });
    if (!remembered.ok) {
      console.error(`session-close: remember fallback failed (${remembered.status}): ${JSON.stringify(remembered.json)}`);
      return 1;
    }
  }

  if (actionIds.length > 0) {
    let allClosed = true;
    for (const actionId of actionIds) {
      const check = await apiRequest('GET', '/actions/get', { query: { actionId } });
      const status = check.ok ? extractStatus(check.json) : null;
      if (status !== 'done' && status !== 'cancelled') {
        console.error(`session-close: action ${actionId} has status ${status ?? 'unknown'} â€” crystals/create requires every action done or cancelled`);
        allClosed = false;
      }
    }
    if (allClosed) {
      const crystalBody = { actionIds, sessionId };
      if (project) crystalBody.project = project;
      const crystal = await apiRequest('POST', '/crystals/create', { body: crystalBody });
      if (!crystal.ok) {
        console.error(`session-close: crystals/create failed (${crystal.status}) â€” every action must be done or cancelled, and the server needs an LLM provider key`);
        return 1;
      }
    } else {
      return 1;
    }
  }

  console.log(`session-close: ${sessionId} summarized and stored`);
  return 0;
}

SUBCOMMANDS['session-close'] = cmdSessionClose;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test tests/agentmemory/`

Expected: PASS â€” all 46 tests green.

- [ ] **Step 5: Commit**

```bash
git add scripts/agentmemory-bridge.mjs tests/agentmemory/session-close.test.mjs
git commit -m "feat(bridge): add session-close subcommand"
```

Expected: commit succeeds with the two files staged.

---

## Phase 4 â€” Documentation & E2E

### Task 9: `agentmemory-bridge` Skill

**Files:**
- Create: `skills/agentmemory-bridge/SKILL.md`

**Interfaces:**
- Consumes: the six subcommands and their endpoint mappings from Tasks 2â€“8 (names/signatures below are the contract; the skill documents them).
- Produces: a new fork-local skill that documents bridge usage and the RECALL â†’ FRONTIER â†’ SKILL â†’ PLAN â†’ DELEGATE â†’ CROSS-AUDIT â†’ SAVE flow with real endpoint names (design Â§7 deliverable).

- [ ] **Step 1: Write the skill**

Create `skills/agentmemory-bridge/SKILL.md` with exactly this content:

```markdown
---
name: agentmemory-bridge
description: Use when syncing plans into the agentmemory action DAG, claiming or completing bridge tasks, closing sessions, or indexing repo docs â€” the fork's zero-dependency memory bridge.
---

# Agentmemory Bridge

This fork pairs with a local agentmemory server (default `http://localhost:3111`)
through the zero-dependency CLI `scripts/agentmemory-bridge.mjs`. The server
indexes what the workflow produces; the deterministic contract (skills, specs,
plans, CLAUDE.md/AGENTS.md in git) never moves into memory.

## Subcommands

| Subcommand | Purpose | Endpoints |
|---|---|---|
| `health` | Probe server liveness | `GET /agentmemory/livez` |
| `plan-sync <planfile>` | Materialize a plan's `### Task N:` list into the action DAG | `POST /agentmemory/actions`, `POST /agentmemory/actions/edges` |
| `task-claim <actionId>` | Acquire a lease and mark the action active | `POST /agentmemory/leases/acquire`, `POST /agentmemory/actions/update` |
| `task-done <actionId> [result]` | Release the lease and mark the action done | `POST /agentmemory/leases/release`, `POST /agentmemory/actions/update` |
| `session-close <sessionId> [actionIds...]` | Summarize, store the summary, crystallize closed actions | `POST /agentmemory/summarize`, `POST /agentmemory/slot`, `POST /agentmemory/remember`, `POST /agentmemory/crystals/create` |
| `backfill [dir...]` | Index markdown docs (defaults: `docs/superpowers/specs`, `docs/superpowers/plans`) | `POST /agentmemory/remember` |

## Environment

- `AGENTMEMORY_URL` â€” server origin (default `http://localhost:3111`); the bridge appends `/agentmemory`.
- `AGENTMEMORY_SECRET` â€” sends `Authorization: Bearer <secret>` when set.
- `AGENTMEMORY_AGENT_ID` â€” identity for leases (default `superpowers-agent`).
- `AGENTMEMORY_PROJECT` â€” project name attached to writes.

## Workflow: RECALL â†’ FRONTIER â†’ SKILL â†’ PLAN â†’ DELEGATE â†’ CROSS-AUDIT â†’ SAVE

1. RECALL â€” before new work, `POST /agentmemory/smart-search` for past decisions, lessons, and related sessions.
2. FRONTIER â€” `GET /agentmemory/frontier` shows the highest-priority unblocked actions; nothing pending means the DAG is empty (run `plan-sync`).
3. SKILL â€” load the skill for the task from disk; skills stay deterministic.
4. PLAN â€” after `writing-plans` saves the plan, run `plan-sync` to mirror each task into the DAG; the plan file remains the source of truth.
5. DELEGATE â€” before dispatching a subagent, `task-claim <actionId>` (the lease prevents two agents on one action).
6. CROSS-AUDIT â€” review the subagent's work; save notable errors/successes via `POST /agentmemory/lessons`.
7. SAVE â€” at session close, `session-close <sessionId> [actionIds...]` summarizes the session, stores the summary, and crystallizes the completed chain.

## Degradation rules

- Server unreachable: every subcommand fails fast with exit 1; the workflow continues without memory (golden rule).
- Slots disabled (`AGENTMEMORY_SLOTS` off â†’ 503): `session-close` falls back to `POST /agentmemory/remember` with `concepts: ["slot:session-summary"]`.
- `crystals/create` requires every action `done`/`cancelled` and an LLM provider on the server; the bridge checks statuses first and reports the requirement.
- `plan-sync` is create-only: re-running duplicates actions. The plan file is the contract; reconcile the DAG at close.
```

- [ ] **Step 2: Verify the skill**

Run:

```powershell
git diff --check
Get-Content skills/agentmemory-bridge/SKILL.md | Select-String -Pattern 'plan-sync|task-claim|session-close|slot:session-summary'
```

Expected: `git diff --check` prints nothing; the grep finds the subcommand names and the fallback concept.

- [ ] **Step 3: Commit**

```bash
git add skills/agentmemory-bridge/SKILL.md
git commit -m "docs(bridge): add agentmemory-bridge skill"
```

Expected: commit succeeds with the skill staged.

### Task 10: Optional Bridge Steps in `writing-plans` and `subagent-driven-development`

**Files:**
- Modify: `skills/writing-plans/SKILL.md` (append at end of file, after the "Execution Handoff" section)
- Modify: `skills/subagent-driven-development/SKILL.md` (append at end of file, after the "Finish" section)

**Interfaces:**
- Consumes: `plan-sync` (Task 5), `task-claim`/`task-done` (Tasks 6â€“7) â€” the appended sections reference these exact subcommands.
- Produces: appended optional sections. **Do not touch any other content in these files** â€” they are eval-tuned (design Â§11: only appended optional steps are in scope).

- [ ] **Step 1: Append the optional section to `writing-plans`**

Append this block at the very end of `skills/writing-plans/SKILL.md` (after the final line `- Batch execution with checkpoints for review`):

```markdown

## Optional: agentmemory bridge (fork-local)

This fork pairs with the agentmemory bridge. After saving the plan, sync its
tasks into the memory action DAG:

```bash
bun scripts/agentmemory-bridge.mjs plan-sync docs/superpowers/plans/<plan-file>.md
```

The bridge prints a JSON map of task numbers to action IDs. The plan file on
disk stays the source of truth; the DAG is a retrievable mirror. Skip this
step when the server is unreachable â€” the workflow does not depend on it.
```

- [ ] **Step 2: Append the optional section to `subagent-driven-development`**

Append this block at the very end of `skills/subagent-driven-development/SKILL.md` (after the final line `Done! Using superpowers:finishing-a-development-branch.`):

```markdown

## Optional: agentmemory bridge (fork-local)

This fork pairs with the agentmemory bridge. When the plan has been synced
(`plan-sync`), claim each task before dispatching its implementer and mark it
done when the review passes:

```bash
bun scripts/agentmemory-bridge.mjs task-claim <actionId>   # after plan-sync prints it
bun scripts/agentmemory-bridge.mjs task-done <actionId> "review clean"
```

`task-claim` acquires a lease (one subagent per action) and marks the action
active; `task-done` releases the lease and marks it done. Skip both when the
server is unreachable.
```

- [ ] **Step 3: Verify the appends**

Run:

```powershell
git diff --stat
git diff --check
Select-String -Path skills/writing-plans/SKILL.md, skills/subagent-driven-development/SKILL.md -Pattern 'Optional: agentmemory bridge'
```

Expected: `git diff --stat` shows exactly the two skill files, both with only additions (no `-` lines in `git diff`); `git diff --check` prints nothing; both files contain the `Optional: agentmemory bridge` heading.

- [ ] **Step 4: Commit**

```bash
git add skills/writing-plans/SKILL.md skills/subagent-driven-development/SKILL.md
git commit -m "docs(bridge): append bridge usage to writing-plans and SDD skills"
```

Expected: commit succeeds with the two skill files staged.

### Task 11: `AGENTS.md` Agentmemory Protocol

**Files:**
- Modify: `AGENTS.md` (currently contains only the line `CLAUDE.md`)

**Interfaces:**
- Consumes: the subcommand names and endpoint mappings from Tasks 2â€“8.
- Produces: the fork's agentmemory protocol with real endpoint names (design Â§7 deliverable).

- [ ] **Step 1: Replace the content of `AGENTS.md`**

Replace the entire file content with exactly this:

```markdown
CLAUDE.md

## Agentmemory protocol

This fork pairs with the local agentmemory server (default `http://localhost:3111`)
through the zero-dependency bridge `scripts/agentmemory-bridge.mjs`. Memory
indexes and complements the deterministic contract â€” it never replaces it.

Workflow: RECALL â†’ FRONTIER â†’ SKILL â†’ PLAN â†’ DELEGATE â†’ CROSS-AUDIT â†’ SAVE.

1. RECALL â€” before new work, `POST /agentmemory/smart-search` for past decisions and lessons.
2. FRONTIER â€” `GET /agentmemory/frontier` for the highest-priority pending actions.
3. SKILL â€” load the skill for the task; skills stay on disk.
4. PLAN â€” after writing a plan, materialize the DAG:
   `bun scripts/agentmemory-bridge.mjs plan-sync docs/superpowers/plans/<plan>.md`
   (`POST /agentmemory/actions`, `POST /agentmemory/actions/edges`).
5. DELEGATE â€” before dispatching a subagent, claim its action:
   `bun scripts/agentmemory-bridge.mjs task-claim <actionId>`
   (`POST /agentmemory/leases/acquire`, `POST /agentmemory/actions/update`); release it after review with
   `bun scripts/agentmemory-bridge.mjs task-done <actionId> "review clean"`.
6. CROSS-AUDIT â€” review the subagent's output; save lessons via `POST /agentmemory/lessons`.
7. SAVE â€” close the session: `bun scripts/agentmemory-bridge.mjs session-close <sessionId> [actionIds...]`
   (`POST /agentmemory/summarize`, slot `session-summary`, `POST /agentmemory/crystals/create`).

Degradation: the server may be down or slots disabled (503 â†’ `remember` fallback with
`concepts: ["slot:session-summary"]`). Never block the workflow on memory â€” deterministic
stays in files, retrievable goes to agentmemory.
```

- [ ] **Step 2: Verify**

Run:

```powershell
Get-Content AGENTS.md
git diff --check
```

Expected: the file starts with `CLAUDE.md` and contains the protocol with the seven steps; `git diff --check` prints nothing.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs(bridge): add agentmemory protocol to AGENTS.md"
```

Expected: commit succeeds with `AGENTS.md` staged.

### Task 12: E2E Against the Live Server

**Files:** none created or modified (verification-only task; uses `tests/agentmemory/fixtures/sample-plan.md` from Task 5).

**Interfaces:**
- Consumes: the complete bridge (Tasks 1â€“8) and the fixture (Task 5).
- Produces: live evidence of the full cycle (design Â§10 phase 4: "Full cycle: start â†’ plan â†’ SDD â†’ close â€” Evidence at every step"). The evidence lives in the memory server (session, actions, edges, summary, crystal), not in repo files.

- [ ] **Step 1: Health gate**

Run: `bun scripts/agentmemory-bridge.mjs health`

Expected: exit 0, output `healthy: agentmemory reachable at http://localhost:3111/agentmemory`.

If the server is unreachable, STOP here and report "E2E skipped â€” server unreachable"; do not continue. Also record the server version:

Run: `curl.exe -s http://localhost:3111/agentmemory/health`

Expected: JSON containing `"version":"0.9.28"` and `"status":"healthy"`.

- [ ] **Step 2: Start a session**

Run (PowerShell):

```powershell
bun -e "const r = await fetch('http://localhost:3111/agentmemory/session/start', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'bridge-e2e-20260813',project:'superpowers-agentmemory',cwd:process.cwd(),title:'bridge E2E',agentId:'bridge-e2e'})}); console.log(r.status, await r.text())"
```

Expected: 2xx with a JSON body containing `session` and `context`.

- [ ] **Step 3: Backfill the repo docs**

Run: `bun scripts/agentmemory-bridge.mjs backfill`

Expected: exit 0 and a final line `backfill: N indexed, 0 failed` with N â‰¥ 1 (the specs and plans directories contain markdown files).

- [ ] **Step 4: Verify an old spec is retrievable (design Â§10 phase 1 verification)**

Run (PowerShell):

```powershell
bun -e "const r = await fetch('http://localhost:3111/agentmemory/smart-search', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'agentmemory bridge design',limit:5,project:'superpowers-agentmemory'})}); console.log(r.status, await r.text())"
```

Expected: 2xx; across the returned results, at least one `files` entry contains `docs/superpowers/specs/2026-08-13-agentmemory-bridge-design.md` (semantic ranking may vary â€” check the `files` field of every result).

> **E2E finding (2026-08-13, server v0.9.28):** `smart-search` answers `mode:"compact"` and OMITS the `files` field on every result, so this literal criterion is unreachable with that endpoint. The spec IS indexed and retrievable - verified via `GET /agentmemory/memories` (memory `mem_msrwui63_6a45b771e68f` carries the file) and `POST /agentmemory/search` with `format:'full'` (the spec ranks with score 6.15 and correct `files`). Accepted as a plan-to-server discrepancy, NOT a bridge defect; the relaxed criterion is "the spec is retrievable via memories/search".

- [ ] **Step 5: Materialize the DAG from the fixture plan**

Run (PowerShell):

```powershell
$sync = (bun scripts/agentmemory-bridge.mjs plan-sync tests/agentmemory/fixtures/sample-plan.md | ConvertFrom-Json)
$sync.actions | Format-Table task, actionId, title
```

Expected: exit 0; the table shows three actions `[1] Alpha`, `[2] Beta`, `[3] Gamma` with distinct actionIds; `$sync.edges` has two entries `{source:2,target:1}` and `{source:3,target:2}`.

- [ ] **Step 6: Verify the frontier now returns real work (design Â§10 phase 2 verification)**

Run (PowerShell):

```powershell
bun -e "const r = await fetch('http://localhost:3111/agentmemory/frontier?project=superpowers-agentmemory&limit=10'); console.log(r.status, await r.text())"
```

Expected: 2xx with `totalActions` â‰¥ 3 and the fixture tasks present in `frontier` (before this plan, the live frontier returned `totalActions: 0` â€” this step proves the PLANâ†’DAG bridge).

- [ ] **Step 7: Claim and complete each action (lease flow)**

Run (PowerShell), using the actionIds captured in Step 5:

```powershell
bun scripts/agentmemory-bridge.mjs task-claim $sync.actions[0].actionId
bun scripts/agentmemory-bridge.mjs task-done $sync.actions[0].actionId "E2E alpha complete"
bun scripts/agentmemory-bridge.mjs task-claim $sync.actions[1].actionId
bun scripts/agentmemory-bridge.mjs task-done $sync.actions[1].actionId "E2E beta complete"
bun scripts/agentmemory-bridge.mjs task-claim $sync.actions[2].actionId
bun scripts/agentmemory-bridge.mjs task-done $sync.actions[2].actionId "E2E gamma complete"
```

Expected: each `task-claim` prints `claimed by` and each `task-done` prints `marked done`; all six commands exit 0.

- [ ] **Step 8: Close the session (design Â§10 phase 3 verification)**

Run (PowerShell):

```powershell
bun scripts/agentmemory-bridge.mjs session-close bridge-e2e-20260813 $sync.actions[0].actionId $sync.actions[1].actionId $sync.actions[2].actionId
```

Expected (two environment-dependent branches, both acceptable â€” record which one happened):

- **Branch A (LLM provider present):** exit 0, `session-close: bridge-e2e-20260813 summarized and stored`. If `AGENTMEMORY_SLOTS` is still off, stderr contains `slot unavailable (503) â€” falling back to remember` â€” that warning is the graceful-degradation evidence (design Â§8, Â§9).
- **Branch B (no LLM provider):** exit 1 with `summarize failed (...)` â€” record the exact message as evidence; this is a documented server limitation (design Â§9 "documents LLM requirement"), not a bridge defect.

- [ ] **Step 9: Verify the summary is retrievable**

Run (PowerShell):

```powershell
bun -e "const r = await fetch('http://localhost:3111/agentmemory/smart-search', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'session-summary bridge e2e',limit:5})}); console.log(r.status, await r.text())"
```

Expected: 2xx; if Step 8 took Branch A, at least one result carries the concept `slot:session-summary` (or the slot content). If Step 8 took Branch B, record that no summary exists (expected â€” summarize never ran).

- [ ] **Step 10: Confirm the repo is untouched**

Run: `git status --short`

Expected: no unexpected changes (the E2E writes only to the memory server; the fixture file is unchanged).

- [ ] **Step 11: Report and commit only if a defect was found**

The E2E itself produces no repo changes, so there is normally nothing to commit. If any step exposed a bridge defect, fix it (test-first, per the task's original test file), re-run the affected unit tests plus the E2E step, and commit:

```bash
git add scripts/agentmemory-bridge.mjs tests/agentmemory/<affected-test>.mjs
git commit -m "fix(bridge): <what the E2E exposed>"
```

Expected: the full suite `bun test tests/agentmemory/` passes and the E2E cycle completes with evidence at every step.

