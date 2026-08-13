---
name: agentmemory-bridge
description: Use when syncing plans into the agentmemory action DAG, claiming or completing bridge tasks, closing sessions, or indexing repo docs — the fork's zero-dependency memory bridge.
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

- `AGENTMEMORY_URL` — server origin (default `http://localhost:3111`); the bridge appends `/agentmemory`.
- `AGENTMEMORY_SECRET` — sends `Authorization: Bearer <secret>` when set.
- `AGENTMEMORY_AGENT_ID` — identity for leases (default `superpowers-agent`).
- `AGENTMEMORY_PROJECT` — project name attached to writes.

## Workflow: RECALL → FRONTIER → SKILL → PLAN → DELEGATE → CROSS-AUDIT → SAVE

1. RECALL — before new work, `POST /agentmemory/smart-search` for past decisions, lessons, and related sessions.
2. FRONTIER — `GET /agentmemory/frontier` shows the highest-priority unblocked actions; nothing pending means the DAG is empty (run `plan-sync`).
3. SKILL — load the skill for the task from disk; skills stay deterministic.
4. PLAN — after `writing-plans` saves the plan, run `plan-sync` to mirror each task into the DAG; the plan file remains the source of truth.
5. DELEGATE — before dispatching a subagent, `task-claim <actionId>` (the lease prevents two agents on one action).
6. CROSS-AUDIT — review the subagent's work; save notable errors/successes via `POST /agentmemory/lessons`.
7. SAVE — at session close, `session-close <sessionId> [actionIds...]` summarizes the session, stores the summary, and crystallizes the completed chain.

## Degradation rules

- Server unreachable: every subcommand fails fast with exit 1; the workflow continues without memory (golden rule).
- Slots disabled (`AGENTMEMORY_SLOTS` off → 503): `session-close` falls back to `POST /agentmemory/remember` with `concepts: ["slot:session-summary"]`.
- `crystals/create` requires every action `done`/`cancelled` and an LLM provider on the server; the bridge checks statuses first and reports the requirement.
- `plan-sync` is create-only: re-running duplicates actions. The plan file is the contract; reconcile the DAG at close.
