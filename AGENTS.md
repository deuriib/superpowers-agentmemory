CLAUDE.md

## Agentmemory protocol

This fork pairs with the local agentmemory server (default `http://localhost:3111`)
through the zero-dependency bridge `scripts/agentmemory-bridge.mjs`. Memory
indexes and complements the deterministic contract — it never replaces it.

Workflow: RECALL → FRONTIER → SKILL → PLAN → DELEGATE → CROSS-AUDIT → SAVE.

1. RECALL — before new work, `POST /agentmemory/smart-search` for past decisions and lessons.
2. FRONTIER — `GET /agentmemory/frontier` for the highest-priority pending actions.
3. SKILL — load the skill for the task; skills stay on disk.
4. PLAN — after writing a plan, materialize the DAG:
   `bun scripts/agentmemory-bridge.mjs plan-sync docs/superpowers/plans/<plan>.md`
   (`POST /agentmemory/actions`, `POST /agentmemory/actions/edges`).
5. DELEGATE — before dispatching a subagent, claim its action:
   `bun scripts/agentmemory-bridge.mjs task-claim <actionId>`
   (`POST /agentmemory/leases/acquire`, `POST /agentmemory/actions/update`); release it after review with
   `bun scripts/agentmemory-bridge.mjs task-done <actionId> "review clean"`.
6. CROSS-AUDIT — review the subagent's output; save lessons via `POST /agentmemory/lessons`.
7. SAVE — close the session: `bun scripts/agentmemory-bridge.mjs session-close <sessionId> [actionIds...]`
   (`POST /agentmemory/summarize`, slot `session-summary`, `POST /agentmemory/crystals/create`).

Degradation: the server may be down or slots disabled (503 → `remember` fallback with
`concepts: ["slot:session-summary"]`). Never block the workflow on memory — deterministic
stays in files, retrievable goes to agentmemory.