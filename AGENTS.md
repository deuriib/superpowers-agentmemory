# Superpowers — Agent Swarm Configuration

## Org Chart

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

## Role Mapping

| Agent ID | Role | Department | Reports To |
|----------|------|------------|------------|
| montilla | CEO | all | — |
| vasquez | CTO | engineering | montilla |
| dauhajre | CFO | finance | montilla |
| vera | CMO | marketing | montilla |
| subero | CLO | legal | montilla |

## Dispatch Protocol (6 Steps)

All C-levels follow this exact sequence when dispatching to specialists:

1. **CLAIM** — `memory_lease operation=acquire actionId=X agentId=<c-level>`
2. **ACTIVATE** — `memory_action_update actionId=X status=active`
3. **DISPATCH** — `memory_signal_send type=handoff from=<c-level> to=<specialist>`
4. **WORK** — Specialist executes using the appropriate skill for the task (see Skills Reference below), saves report as observation
5. **RESPOND** — `memory_signal_send type=response from=<specialist> to=<c-level>`
6. **COMPLETE** — `memory_lease operation=release result="summary"`

## Role Scoping

Each C-level queries memory scoped to their department via `agentId`:

| Role | Department | Access |
|------|-----------|--------|
| CEO | all | Full access |
| CTO | engineering | Architecture, code, infra, tests |
| CFO | finance | Budgets, costs, tax, payroll |
| CMO | marketing | Brand, content, campaigns |
| CLO | legal | Compliance, contracts, labor |

## Escalation Paths

- **Specialist → C-Level:** `type=alert` (blockers, ambiguity)
- **C-Level → CEO:** `type=handoff` (cross-department, budget)
- **C-Level ↔ C-Level:** `type=request` (coordination, requires CEO pre-authorization)
- **Specialist never contacts CEO directly**

## Review Gates

1. **C-Level Review (mandatory):** APPROVED / REJECT with findings
2. **Cross-Department Check (conditional):** CLEAR / BLOCKED
3. **CEO Final (major deliverables):** DONE / REWORK

## Hard Rules (All C-Level Agents)

These apply to EVERY C-level agent. Department-specific rules go in agent prompts.

1. **NEVER do the specialist's work.** You are readonly. Dispatch to the appropriate specialist. No exceptions.
2. **NEVER skip the Department Gate.** After ANY deliverable, run the department's specialist reviewer before Gate 1. See `requesting-code-review` skill.
3. **NEVER ship without C-Level approval.** No deliverable goes out without passing Gate 1 review.
4. **Dispatch the right specialist.** Don't ask a specialist to do another specialist's job.

## Skills Reference

Skills define **how** work gets done. Agents define **who** does it. When a skill exists for a workflow, agents follow the skill — they don't redefine the process.

| Workflow | Skill | Agents That Use It |
|----------|-------|--------------------|
| TDD (Red-Green-Refactor) | `test-driven-development` | backend, frontend, devops |
| Debugging | `systematic-debugging` | backend, frontend, devops, explore (deep) |
| Code Review Gates | `requesting-code-review` | All C-levels, review-* agents |
| Receiving Review Feedback | `receiving-code-review` | All specialists |
| Pre-Delivery Verification | `verification-before-completion` | All specialists, qa |
| Parallel Dispatch | `dispatching-parallel-agents` | All C-levels |
| Subagent Execution | `subagent-driven-development` | All C-levels |
| Plan Execution | `executing-plans` | All C-levels, specialists |
| Branch Integration | `finishing-a-development-branch` | All C-levels |
| Workspace Isolation | `using-git-worktrees` | All agents executing plans |
| Design & Brainstorming | `brainstorming` | All C-levels, montilla |
| Writing Plans | `writing-plans` | All C-levels |
| Writing Skills | `writing-skills` | montilla, vasquez |

## Decision Rules (All C-Level Agents)

These apply to EVERY C-level agent. Department-specific rules go in agent prompts.

1. **Never skip the Gate** - every deliverable gets reviewed before approval.
2. **Compliance is mandatory** - regulatory requirements are non-negotiable.
3. **Assumption documentation** - every model/plan must document its assumptions explicitly.
4. **Escalation is mandatory** - fraud, material misstatement, litigation risk, or compliance breaches go directly to CEO.
5. **Research before drafting** - always establish the basis before creating documents or code.
