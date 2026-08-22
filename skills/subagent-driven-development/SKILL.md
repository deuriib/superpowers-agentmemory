---
name: subagent-driven-development
description: Use when executing implementation plans with independent tasks in the current session
---

# Subagent-Driven Development

Execute plans by dispatching a fresh implementer subagent per task, reviewing each, and running a broad final review.

**Core principle:** Fresh subagent per task + task review + final review = high quality, fast iteration.

## Org Hierarchy

In the swarm hierarchy:
- **Controller** = C-level orchestrator (vasquez, dauhajre, vera, subero)
- **Implementer** = specialist from their department
- **Reviewer** = same C-level or cross-department C-level for Gate 2

The controller claims the action, dispatches to a specialist, reviews the output, and releases the lease.

**Continuous execution:** Do not pause between tasks. Execute all tasks without stopping. The only reasons to stop: irreversible/destructive operations, security-sensitive actions, side effects outside this worktree requiring consent, or a plan so broken every path is a guess.

**Rulings, not stalls.** A running plan does not wait on a human. Conflicts, ambiguities, plan defects — decide them. Record every decision in the DAG as `Ruling: <what> — <why> — <cost if wrong>`. A wrong ruling costs rework; a parked session costs their whole day.

## When to Use

| Have plan? | Tasks independent? | Stay in session? | Use |
|------------|---------------------|------------------|-----|
| No | — | — | Brainstorm first |
| Yes | No (tightly coupled) | — | Manual execution |
| Yes | Yes | No | executing-plans (parallel) |
| Yes | Yes | Yes | **subagent-driven-development** |

## Setup

1. Ensure isolated workspace (use `superpowers:using-git-worktrees`)
2. Read plan from DAG: `memory_frontier project=<name>` returns unblocked tasks
3. Read spec slot if referenced: `memory_slot_get label=<spec slot label>`
4. Track all progress in agentmemory DAG — it survives compaction

**No files.** Briefs, reports, diffs, rulings — all in agentmemory. Nothing written to disk except git commits.

## Model Selection

Use the least powerful model that can handle each role:

| Task type | Model |
|-----------|-------|
| Mechanical (1-2 files, clear spec) | Cheap |
| Integration (multi-file, debugging) | Standard |
| Architecture/design, final review | Most capable |
| Fix-loop rounds 4-5 | One tier above stuck implementer |

**Always specify model explicitly.** Omitted model inherits session default (often most expensive).

**Turn count beats token price.** Cheap models take 2-3× more turns on multi-step work. Mid-tier as floor for reviewers and prose-based implementers.

## The Task Loop

### 1. Dispatch implementer

- Claim action: `memory_lease operation=acquire` → `memory_action_update status=active`
- Send brief via `memory_signal_send type=handoff` with full task description from DAG
- Include: project context, signal ID, interfaces from earlier tasks, ambiguity resolutions, report contract
- Record implementer's agent identity for fix-loop rounds 1-3
- Never dispatch multiple implementers in parallel

**Report contract:** Implementer saves report as observation (`memory_save type=observation`), returns observation ID in signal.

### 2. Handle report

| Status | Action |
|--------|--------|
| **DONE** | Save review package (`scripts/review-package`), dispatch task reviewer |
| **DONE_WITH_CONCERNS** | Read concerns, address if correctness/scope, note if observations |
| **NEEDS_CONTEXT** | Provide missing context, re-dispatch |
| **BLOCKED** | Assess: context problem → re-dispatch; needs reasoning → more capable model; too large → break up; plan wrong → rule and re-dispatch |

Never ignore an escalation or force same model to retry without changes.

### 3. Review the task

Per-task reviews are mandatory. Both spec compliance AND quality required.

- Send reviewer: report observation ID, review package observation ID, brief signal ID, global constraints
- Reviewer verdicts: spec ✅/❌ + quality approved/not approved
- "⚠️ Cannot verify from diff" items: resolve yourself before marking task complete
- Never pre-judge findings ("don't flag X", "at most Minor")

### 4. The fix loop

Triggers on: spec ❌, Critical/Important finding, or confirmed ⚠️ gap.

**Before loop:** Minor findings → record in DAG, defer to final review. Plan-mandated findings → rule and DAG it.

**Rounds 1-3:** Resume original implementer via signal with findings.

**Rounds 4-5:** Fresh implementer on more capable model. Framing: "Prior implementer attempted N times; you own it now."

**Cap at 5 rounds.** Breaker trips → adjudicate each finding:
- Reviewer wrong or contestable → park with ruling
- Real but not load-bearing → park with ruling
- Real and load-bearing → rule on smallest fix, DAG it, carry to next task

**Every round:** Implementer fixes → re-runs tests → saves fix report observation → re-reviewer verdicts each finding ADDRESSED/NOT ADDRESSED. Record in DAG: `Task <N>: fix round <R>/5`.

Never fix findings yourself in the controller session.

### 5. Complete task

- Append completion to DAG: `Task <N>: complete (commits <base>..<head>, review clean)`
- Release lease: `memory_lease operation=release`
- Move to next task

## Final Review

1. Save review package: `scripts/review-package <plan-id> MERGE_BASE HEAD`
2. Dispatch on most capable model using `superpowers:requesting-code-review`
3. Point at DAG's deferred-minors and parked findings
4. If findings: dispatch ONE fix subagent, then ONE scoped re-review
5. Adjudicate residuals: park with rulings or rule on load-bearing ones

No second fix wave — residuals surface when finishing-a-development-branch presents options.

## Finish

Collect every ruling from DAG into final message under "Rulings I made" — each with cost if wrong. This is the only place your decisions reach your human partner.

Use `superpowers:finishing-a-development-branch`.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Close enough on spec compliance" | Not done. Fix or hit cap and adjudicate. |
| "I'll fix it myself" | Controller fixes pollute context and skip review. Resume implementer. |
| "One more round will converge" | Past cap, failure is structural. Adjudicate. |
| "Reviewer will just find something new" | Scoped re-reviews verify fixes; new findings on untouched code go to DAG. |
| "Finding is obviously wrong" | Adjudicate only at cap. Every ruling is a DAG entry. |
| "Fix was small, skip re-review" | Unreviewed fixes = regressions. Every round ends with re-review. |
| "Reviews slow the loop" | Reviews are the loop's brakes and steering. |
| "DAG bookkeeping is overhead" | DAG survives compaction. Controllers without one re-dispatched completed tasks. |
| "Implementer spawned its own reviewer" | Duplicate seat. Worker-spawned reviewer is a defect to flag. |
