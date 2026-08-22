# Superpowers

Superpowers is a complete software development methodology for your OpenCode agents, built on top of a set of composable skills and a swarm agent hierarchy.

## Table of Contents

- [How it works](#how-it-works)
- [Getting Started](#installation)
- [Org Hierarchy](#org-hierarchy)
- [The Basic Workflow](#the-basic-workflow)
- [What's Inside](#whats-inside)
- [Philosophy](#philosophy)
- [License](#license)

## How it works

Superpowers starts from the moment you fire up your coding agent. As soon as it sees that you're building something, it *doesn't* just jump into trying to write code. Instead, it steps back and asks you what you're really trying to do.

Once it's teased a spec out of the conversation, it shows it to you in chunks short enough to actually read and digest.

After you've signed off on the design, your agent puts together an implementation plan that's clear enough for an enthusiastic junior engineer with poor taste, no judgement, no project context, and an aversion to testing to follow. It emphasizes true red/green TDD, YAGNI (You Aren't Gonna Need It), and DRY.

Next up, once you say "go", it launches a *subagent-driven-development* process, having agents work through each engineering task, inspecting and reviewing their work, and continuing forward. It's not uncommon for your agent to work autonomously for a couple hours at a time without deviating from the plan you put together.

There's a bunch more to it, but that's the core of the system. And because the skills trigger automatically, you don't need to do anything special. Your coding agent just has Superpowers.

## Installation

### OpenCode

Install Superpowers in OpenCode:

1. Clone this repository to your plugins directory:
   ```bash
   git clone <repo-url> ~/.config/opencode/plugins/superpowers
   ```

2. The plugin auto-registers skills and the agentmemory MCP server on startup.

## Org Hierarchy

Superpowers uses a swarm agent hierarchy for coordinated multi-agent work:

```
CEO (Montilla)
├── CTO (Vasquez)
│   └── backend, frontend, devops, qa, architect, explore
├── CFO (Dauhajre)
│   └── accountant, cost-analyst, credit-analyst, financial-analyst,
│       fpna-analyst, payroll-specialist, risk-analyst, treasurer
├── CMO (Vera)
│   └── brand-strategist, content-strategist, copywriter,
│       email-marketer, marketing-analyst, ppc-specialist, seo, social-media
└── CLO (Subero)
    └── compliance-officer, contract-drafter, ip-counsel,
        labor-counsel, legal-researcher, privacy-counsel
```

### Dispatch Protocol

All C-levels follow this 6-step sequence:

1. **CLAIM** — `memory_lease operation=acquire actionId=X agentId=<c-level>`
2. **ACTIVATE** — `memory_action_update actionId=X status=active`
3. **DISPATCH** — `memory_signal_send type=handoff from=<c-level> to=<specialist>`
4. **WORK** — Specialist executes, saves report as observation
5. **RESPOND** — `memory_signal_send type=response from=<specialist> to=<c-level>`
6. **COMPLETE** — `memory_lease operation=release result="summary"`

### Escalation Paths

- **Specialist → C-Level:** `type=alert` (blockers, ambiguity)
- **C-Level → CEO:** `type=handoff` (cross-department, budget)
- **C-Level ↔ C-Level:** `type=request` (coordination, requires CEO pre-authorization)

### Review Gates

1. **C-Level Review (mandatory):** APPROVED / REJECT with findings
2. **Cross-Department Check (conditional):** CLEAR / BLOCKED
3. **CEO Final (major deliverables):** DONE / REWORK

## The Basic Workflow

1. **brainstorming** - Activates before writing code. Refines rough ideas through questions, explores alternatives, presents design in sections for validation.

2. **using-git-worktrees** - Activates after design approval. Creates isolated workspace on new branch, runs project setup, verifies clean test baseline.

3. **writing-plans** - Activates with approved design. Breaks work into bite-sized tasks (2-5 minutes each). Every task has exact file paths, complete code, verification steps.

4. **subagent-driven-development** or **executing-plans** - Activates with plan. Dispatches fresh subagent per task with two-stage review (spec compliance, then code quality).

5. **test-driven-development** - Activates during implementation. Enforces RED-GREEN-REFACTOR: write failing test, watch it fail, write minimal code, watch it pass, commit.

6. **requesting-code-review** - Activates between tasks. Reviews against plan, reports issues by severity.

7. **finishing-a-development-branch** - Activates when tasks complete. Verifies tests, presents options (merge/PR/keep/discard), cleans up worktree.

## What's Inside

### Skills Library

**Testing**
- **test-driven-development** - RED-GREEN-REFACTOR cycle

**Debugging**
- **systematic-debugging** - 4-phase root cause process
- **verification-before-completion** - Ensure it's actually fixed

**Collaboration**
- **brainstorming** - Socratic design refinement
- **writing-plans** - Detailed implementation plans
- **executing-plans** - Batch execution with checkpoints
- **dispatching-parallel-agents** - Concurrent subagent workflows (org-aware)
- **subagent-driven-development** - Fast iteration with two-stage review (org-aware)
- **requesting-code-review** - Pre-review checklist (org-aware)
- **receiving-code-review** - Responding to feedback
- **using-git-worktrees** - Parallel development branches
- **finishing-a-development-branch** - Merge/PR decision workflow

**Meta**
- **writing-skills** - Create new skills following best practices
- **using-superpowers** - Introduction to the skills system

## Philosophy

- **Test-Driven Development** - Write tests first, always
- **Systematic over ad-hoc** - Process over guessing
- **Complexity reduction** - Simplicity as primary goal
- **Evidence over claims** - Verify before declaring success
- **Org-aware delegation** - C-levels dispatch, specialists execute, CEO oversees

## License

MIT License - see LICENSE file for details
