---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

C-level reviews specialist output directly using the 3 quality gates. No subagent dispatch — the C-level IS the reviewer.

**Core principle:** Evidence before claims. C-level verifies, specialist doesn't self-approve.

## Org Hierarchy

| Gate | Reviewer | Trigger | Verdict |
|------|----------|---------|---------|
| Gate 1 | C-Level | Every specialist deliverable | APPROVED / REJECT |
| Gate 2 | Cross-dept C-Level | Deliverable affects other department | CLEAR / BLOCKED |
| Gate 3 | CEO (montilla) | Major deliverables | DONE / REWORK |

## Gate 1: C-Level Review (mandatory)

Every specialist output goes through C-level review.

### Flow

1. Specialist saves report as observation: `memory_save type=observation`
2. Specialist signals completion: `memory_signal_send type=response from=<specialist> to=<c-level>`
3. C-level reads report: `memory_smart_search query="report for task <ID>"`
4. C-level evaluates against task spec
5. C-level issues verdict

### Verdicts

- **APPROVED:** Work meets spec. Release lease, mark action done.
- **REJECT:** Work doesn't meet spec. Send findings back to specialist.

### Fix Loop

- Rounds 1-3: Resume original specialist with findings
- After 3 rounds: Escalate to CEO with summary of attempts

## Gate 2: Cross-Department Check (conditional)

Triggered when deliverable affects another department.

**Trigger conditions:**
- Task touches files/data owned by another department
- Deliverable changes API contracts used by another team
- Marketing content requires legal review
- Financial data requires compliance review

**Flow:**
1. C-level identifies affected department
2. C-level sends review request: `memory_signal_send type=request from=<c-level> to=<affected-c-level>`
3. Affected C-level reviews
4. Verdict: CLEAR / BLOCKED

**BLOCKED → CEO adjudicates.**

## Gate 3: CEO Final (major deliverables only)

For deliverables with cross-department impact or strategic significance.

**What qualifies as "major":**
- New feature affecting multiple departments
- Architecture change
- Budget expenditure above threshold
- Public-facing content
- Legal/compliance changes

**Flow:**
1. C-level saves summary observation
2. C-level signals CEO: `memory_signal_send type=handoff from=<c-level> to=montilla`
3. CEO reviews
4. Verdict: DONE / REWORK

**REWORK → C-level dispatches fixes (max 2 rounds).**

## Lease Release

After all gates pass:
1. C-level releases lease: `memory_lease operation=release result="summary"`
2. Action marked done: `memory_action_update status=done`
3. Summary logged in DAG

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll review the diff myself" | You're the specialist — C-level reviews, not you. |
| "It's simple, skip review" | Gate 1 is mandatory. No exceptions. |
| "Reviewer needs my session history" | C-level reads your observation, not your history. |
| "I'll just approve it myself" | Self-approval defeats the purpose. C-level decides. |
