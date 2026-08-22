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
4. **WORK** — Specialist executes, saves report as observation
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
