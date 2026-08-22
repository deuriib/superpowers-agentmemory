---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

Dispatch a code reviewer subagent to catch issues before they cascade. The reviewer gets precisely crafted context — never your session's history.

**Core principle:** Review early, review often.

## Org Hierarchy

Reviewer dispatch follows the swarm hierarchy:
- **Engineering reviews:** CTO (vasquez) dispatches to qa or architect specialist
- **Cross-department reviews:** CTO reviews marketing/legal changes that touch code
- **Final review:** CEO (montilla) for major deliverables

## When to Request Review

**Mandatory:** After each task in subagent-driven development, after completing major feature, before merge to main.

**Optional:** When stuck (fresh perspective), before refactoring (baseline check), after fixing complex bug.

## How to Request

**1. Get git SHAs:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Create a review checkpoint (agentmemory):**
```
memory_checkpoint operation=create name="Review: Task N" type=approval linkedActionIds=<task action ID>
```

**3. Dispatch code reviewer subagent:**

Use `general-purpose` subagent with template at [code-reviewer.md](code-reviewer.md). Fill placeholders:
- `{DESCRIPTION}` — what you built
- `{PLAN_OR_REQUIREMENTS}` — what it should do
- `{BASE_SHA}` — starting commit
- `{HEAD_SHA}` — ending commit

**4. Act on feedback and resolve checkpoint:**
- Critical → fix immediately
- Important → fix before proceeding
- Minor → note for later
- Reviewer wrong → push back with reasoning
- After fixing: `memory_checkpoint operation=resolve checkpointId=<ID> status=passed`
- Save findings: `memory_save content=<finding> concepts=<topics>`

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll review the diff myself" | You're the coordinator — reviewing inline burns context window. Dispatch a reviewer. |
| "Reviewer needs my session history" | Hand crafted context, never session history. Reviewer stays on work product. |

## Red Flags

**Never:** Skip review because "it's simple", ignore Critical issues, proceed with unfixed Important issues, argue with valid technical feedback.

**If reviewer wrong:** Push back with reasoning, show code/tests that prove it works, request clarification.

Template: [code-reviewer.md](code-reviewer.md)
