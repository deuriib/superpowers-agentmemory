# Agentmemory Bridge for Superpowers — Design

**Date:** 2026-08-13
**Status:** Approved (user: "Integración completa", Sección 7: integración vive en el fork)
**Scope:** Fork `deuriib/superpowers-agentmemory` (v6.3.0, commit b36e082)

## 1. Problem

The superpowers repo has no external memory system. Session memory lives in
flat files (SDD ledger, specs, plans) and static instructions (CLAUDE.md,
AGENTS.md). There is no session-summary handoff, no lesson store, no action
DAG, and no frontier. The user's global opencode config already runs an
agentmemory server (v0.9.28, healthy at `http://localhost:3111`) with a
capture plugin, but the superpowers workflow never writes to it.

## 2. Golden Rule

> **Deterministic stays in files; retrievable goes to agentmemory.**
> agentmemory indexes and complements; it never replaces the deterministic
> contract. Replacing CLAUDE.md with RAG degrades an `if` into a probability.

- Skills, bootstrap, static instructions, specs and plans in git: **stay**.
- SDD progress, session summaries, lessons, decisions, action DAG: **go**.
- Specs/plans are indexed into agentmemory (`remember` with `files` +
  `concepts`) but the file remains the source of truth.

## 3. Architecture (layers that never collide)

| Layer | Mechanism | Nature | Change |
|---|---|---|---|
| 0. Harness | OpenCode | deterministic | — |
| 1. Project contract | `CLAUDE.md`/`AGENTS.md` | deterministic | — |
| 2. Skill bootstrap | hooks/plugins (5 mechanisms) | deterministic, cached | — |
| 3. **Retrievable memory** | **agentmemory** | probabilistic, token-bounded | **← bridge lives here** |
| 4. On-demand recall | `smart-search` | probabilistic | `token_budget` |

The bridge couples by contract (REST API), not by fusion.

## 4. The PLAN→DAG Bridge (structural change #1)

Today the workflow never creates actions — only observations. Without
actions, `frontier`/`next` return empty and `crystals/create` has no chains
to compress.

**Bridge:** when `writing-plans` produces a plan in
`docs/superpowers/plans/`, the bridge materializes the DAG:

```
Plan on disk (contract)              DAG in agentmemory (memory)
┌─────────────────────┐              ┌──────────────────────────┐
│ Task 1              │ ───────────► │ POST /agentmemory/actions │
│ Task 2 (req: Task1) │ ───────────► │   title, edges:[{type:    │
│ Task 3              │ ───────────► │   "requires", target}]    │
└─────────────────────┘              └──────────────────────────┘
```

Cascade effects:
- `GET /agentmemory/frontier` + `/next` return real work.
- `leases/acquire` prevents two subagents claiming the same action.
- `checkpoints` keep partial progress across compaction.
- `actions/update` (status done) propagates to dependents.
- `crystals/create` compresses the completed chain at plan close.

## 5. Session Protocol

**Start (4 layers, in order):**
1. Harness loads `CLAUDE.md`/`AGENTS.md` → contract.
2. Superpowers hook injects `using-superpowers` → skills.
3. agentmemory `session/start` → returns `{session, context}` (injectable).
4. On-demand recall → `POST /agentmemory/smart-search` with `token_budget`.

**Creative phases:**

| Phase | Artifact on disk (stays) | agentmemory record |
|---|---|---|
| Brainstorming | Spec in `docs/superpowers/specs/` | `remember` (summary + `files` + `concepts`) |
| Writing-plans | Plan in `docs/superpowers/plans/` | **DAG: one `actions` per task** |
| SDD | Report files + ledger | `actions/update` + `lessons` |
| Review | Review reports | `remember` with `concepts: review:*` |
| Close | — | `summarize` → slot `session-summary` → `crystals/create` |

**Session close pattern:** `POST /agentmemory/summarize` (sessionId) →
slot `session-summary` (pinned) → `crystals/create` with the plan's
`actionIds` (all must be `done`/`cancelled`).

## 6. Capture, Lessons, Consolidation

- Automatic capture already exists in the user's global plugin
  (`agentmemory-capture.ts`, 22 hooks) — unchanged.
- Lessons: `POST /agentmemory/lessons` on notable errors/successes.
- Consolidation: server-side 4-tier pipeline (observations → insights →
  lessons → crystals). Bridge only feeds well-tagged `remember` calls.

## 7. Where the Code Lives (user decision)

**The integration lives in the FORK** (`D:\Projects\superpowers-agentmemory`),
not in the global config. After the migration, the global opencode plugin
reference will be repointed to the fork (separate step, not in this plan).

Deliverables in the fork:
- `scripts/agentmemory-bridge.mjs` — zero-dependency Bun CLI (subcommands:
  `health`, `plan-sync`, `task-claim`, `task-done`, `session-close`,
  `backfill`).
- `skills/agentmemory-bridge/SKILL.md` — documents bridge usage; optional
  steps appended to `writing-plans` and `subagent-driven-development`.
- `AGENTS.md` — protocol with real tool names (RECALL → FRONTIER → SKILL →
  PLAN → DELEGATE → CROSS-AUDIT → SAVE).
- `tests/agentmemory/` — Bun tests with a local mock HTTP server (no live
  dependency).
- Docs: this spec + implementation plan.

## 8. REST Contract (verified against live server v0.9.28)

Base URL `http://localhost:3111/agentmemory`. No auth (no `AGENTMEMORY_SECRET`
set). Handlers whitelist body fields.

| Operation | Method/Path | Body fields |
|---|---|---|
| session/start | `POST /session/start` | `sessionId`*, `project`*, `cwd`*, `title`, `agentId` → `{session, context}` |
| session/end | `POST /session/end` | `sessionId`* |
| action-create | `POST /actions` | `title`*, `description`, `priority` (1–10), `createdBy`, `project`, `tags[]`, `parentId`, `edges[{type,targetActionId}]` → 201 |
| action-update | `POST /actions/update` | `actionId`*, `status` (pending\|active\|done\|blocked\|cancelled), `title`, `description`, `priority`, `assignedTo`, `result`, `tags[]` |
| action-list | `GET /actions` | query: `status`, `project`, `parentId` (limit 50) |
| action-get | `GET /actions/get` | query: `actionId`* |
| action-edge | `POST /actions/edges` | `sourceActionId`*, `targetActionId`*, `type`* ∈ {requires, unlocks, spawned_by, gated_by, conflicts_with} |
| frontier | `GET /frontier` | query: `project`, `agentId`, `limit` |
| next | `GET /next` | query: `project`, `agentId` |
| remember | `POST /remember` | `content`*, `type`, `concepts[]`, `files[]`, `ttlDays`, `project` |
| smart-search | `POST /smart-search` | `query` XOR `expandIds`, `limit`, `project`, `includeLessons`, `agentId`, `sessionId` |
| lesson-save | `POST /lessons` | `content`*, `context`, `confidence`, `project`, `tags` (string or string[]) |
| crystals/create | `POST /crystals/create` | `actionIds`* (all done/cancelled), `sessionId`, `project` — requires LLM provider |
| summarize | `POST /summarize` | `sessionId`* |
| lease-acquire | `POST /leases/acquire` | `actionId`*, `agentId`*, `ttlMs` |
| lease-release | `POST /leases/release` | `actionId`*, `agentId`*, `result` |
| checkpoint-create | `POST /checkpoints` | `name`*, `description`, `type`, `linkedActionIds[]`, `expiresInMs` |
| signal-send | `POST /signals/send` | `from`*, `content`*, `to`, `type`, `replyTo` |
| signal-read | `GET /signals` | query: `agentId`*, `unreadOnly`, `threadId`, `limit` |
| context | `POST /context` | `sessionId`*, `project`*, `budget`, `agentId` → `{context}` |

**Slots** (`POST /slot`, `GET /slot`, `GET /slots`, `POST /slot/append`,
`POST /slot/replace`, `DELETE /slot`) require `AGENTMEMORY_SLOTS=true` —
**currently OFF on the live server (503)**. The bridge must degrade
gracefully when slots are unavailable (fall back to `remember` with
`concepts: ["slot:session-summary"]`).

**Feature flags:** `AGENTMEMORY_SLOTS` (off), `AGENTMEMORY_REFLECT` (off),
`GRAPH_EXTRACTION_ENABLED`, `CONSOLIDATION_ENABLED`. `crystals/create` and
`summarize` require an LLM provider key on the server.

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Server down | `health` subcommand + graceful degradation (no context, no failure) |
| Slots disabled (503) | Fall back to `remember` with slot-like concepts |
| Crystallize requires done actions + LLM | Bridge checks statuses before calling; documents LLM requirement |
| DAG desync from plan on disk | Plan file is the contract; DAG is a mirror — reconcile at close |
| Two subagents on same action | `lease-acquire` mandatory in DELEGATE |
| Token budget | `budget`/`token_budget` limits; context injection bounded |

## 10. Implementation Phases

| Phase | Content | Verification |
|---|---|---|
| 0. Infra | Server up (done), bridge `health` subcommand | `bun scripts/agentmemory-bridge.mjs health` → healthy |
| 1. Backfill | Index existing specs/plans; session-summary slot fallback | `smart-search` finds an old spec |
| 2. PLAN→DAG | `plan-sync` parses plan markdown → actions + edges | `frontier` returns plan tasks |
| 3. Session close | `session-close`: summarize + slot + crystallize | Session test → summary + crystal |
| 4. E2E | Full cycle: start → plan → SDD → close | Evidence at every step |

## 11. Out of Scope (this plan)

- Repointing the global opencode plugin reference to the fork (separate step).
- Modifying the live server config (slots flag, LLM provider) — documented,
  not changed.
- Changes to eval-tuned skill content beyond appended optional steps.
- PRs upstream: fork-local changes only.