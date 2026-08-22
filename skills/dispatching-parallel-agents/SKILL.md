---
name: dispatching-parallel-agents
description: Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies
---

# Dispatching Parallel Agents

**Core principle:** Dispatch one agent per independent problem domain. Let them work concurrently.

## Org Hierarchy

In the swarm hierarchy, dispatch follows department lines:

| C-Level | Dispatches To | Department |
|---------|---------------|------------|
| vasquez (CTO) | backend, frontend, devops, qa, architect, explore | engineering |
| dauhajre (CFO) | accountant, cost-analyst, credit-analyst, financial-analyst, fpna-analyst, payroll-specialist, risk-analyst, treasurer | finance |
| vera (CMO) | brand-strategist, content-strategist, copywriter, email-marketer, marketing-analyst, ppc-specialist, seo, social-media | marketing |
| subero (CLO) | compliance-officer, contract-drafter, ip-counsel, labor-counsel, legal-researcher, privacy-counsel | legal |

**Cross-department parallel dispatch:** Requires CEO (montilla) authorization.

## When to Use

**Use when:** 3+ test files failing with different root causes, multiple subsystems broken independently, each problem understood without context from others, no shared state.

**Don't use when:** Failures related (fix one might fix others), need full system state, agents would interfere with each other.

## The Pattern

### 1. Identify Independent Domains

Group failures by what's broken. Each domain is independent — fixing one doesn't affect others.

### 2. Create Focused Agent Tasks

Each agent gets: specific scope (one file/subsystem), clear goal (make these tests pass), constraints (don't change other code), expected output (summary of findings and fixes).

### 3. Dispatch in Parallel

Issue all dispatches in the same response — they run in parallel:

```text
Subagent (general-purpose): "Fix agent-tool-abort.test.ts failures"
Subagent (general-purpose): "Fix batch-completion-behavior.test.ts failures"
Subagent (general-purpose): "Fix tool-approval-race-conditions.test.ts failures"
```

Multiple dispatch calls in one response = parallel. One per response = sequential.

### 4. Review and Integrate

When agents return: read summaries, verify fixes don't conflict, run full test suite, integrate changes.

## Working on the Same Plan DAG

When parallel agents work on actions of the same plan, claim each action before dispatch:

1. Claim: `memory_lease operation=acquire actionId=<ID> agentId=<controller ID>`
2. Activate: `memory_action_update actionId=<ID> status=active`
3. Agents report: `memory_signal_send type=response from=<agent ID> to=<controller ID>`
4. Controller reads: `memory_signal_read agentId=<controller ID>`

No two agents work the same action. Controller receives structured completion signals.

## Agent Prompt Structure

Good prompts are: **focused** (one problem domain), **self-contained** (all context needed), **specific about output** (what to return).

```
Fix the 3 failing tests in src/agents/agent-tool-abort.test.ts:

1. "should abort tool with partial output capture" - expects 'interrupted at' in message
2. "should handle mixed completed and aborted tools" - fast tool aborted instead of completed
3. "should properly track pendingToolCount" - expects 3 results but gets 0

These are timing/race condition issues. Your task:
1. Read the test file and understand what each test verifies
2. Identify root cause - timing issues or actual bugs?
3. Fix by replacing arbitrary timeouts with event-based waiting

Do NOT just increase timeouts - find the real issue.
Return: Summary of what you found and what you fixed.
```

## Common Mistakes

| ❌ Wrong | ✅ Right |
|---------|---------|
| "Fix all the tests" | "Fix agent-tool-abort.test.ts" |
| "Fix the race condition" | Paste error messages and test names |
| No constraints | "Do NOT change production code" |
| "Fix it" | "Return summary of root cause and changes" |

## When NOT to Use

- **Related failures:** Fixing one might fix others — investigate together
- **Need full context:** Understanding requires seeing entire system
- **Exploratory debugging:** You don't know what's broken yet
- **Shared state:** Agents would interfere (same files, same resources)

## Verification

After agents return: review summaries, check for conflicts, run full suite, spot check (agents can make systematic errors).
