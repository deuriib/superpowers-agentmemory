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

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}