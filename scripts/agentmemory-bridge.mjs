#!/usr/bin/env bun
import fs from 'fs';
import path from 'path';
// scripts/agentmemory-bridge.mjs
// Zero-dependency agentmemory bridge for the superpowers fork.
// Subcommands: health, plan-sync, task-claim, task-done, session-close, backfill.
// REST contract: design doc 2026-08-13 §8, under ${AGENTMEMORY_URL:-http://localhost:3111}/agentmemory.

export const DEFAULT_ORIGIN = 'http://localhost:3111';

export function baseUrl() {
  return (process.env.AGENTMEMORY_URL || DEFAULT_ORIGIN) + '/agentmemory';
}

export function usage() {
  return `agentmemory bridge — zero-dependency memory CLI

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
    // non-JSON body — json stays null
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
    // (?:\*\*)? after the colon handles bold markdown like "- **Consumes:** Task 2",
    // where the closing stars sit between the colon and the reference.
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
        console.warn(`plan-sync: task ${task.index} requires unknown task ${dep} — edge skipped`);
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
    console.error(`session-close: summarize failed (${summary.status}) — the server needs an LLM provider key; no summary stored`);
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
    console.warn(`session-close: slot unavailable (${slot.status}) — falling back to remember`);
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
        console.error(`session-close: action ${actionId} has status ${status ?? 'unknown'} — crystals/create requires every action done or cancelled`);
        allClosed = false;
      }
    }
    if (allClosed) {
      const crystalBody = { actionIds, sessionId };
      if (project) crystalBody.project = project;
      const crystal = await apiRequest('POST', '/crystals/create', { body: crystalBody });
      if (!crystal.ok) {
        console.error(`session-close: crystals/create failed (${crystal.status}) — every action must be done or cancelled, and the server needs an LLM provider key`);
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

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
