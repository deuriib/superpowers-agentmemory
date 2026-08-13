#!/usr/bin/env bun
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

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
