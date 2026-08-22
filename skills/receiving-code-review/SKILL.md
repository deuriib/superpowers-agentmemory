---
name: receiving-code-review
description: Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification, not performative agreement or blind implementation
---

# Code Review Reception

**Core principle:** Verify before implementing. Ask before assuming. Technical correctness over social comfort.

## Org Hierarchy

In the swarm hierarchy, specialists receive feedback from C-levels (Gate 1 REJECT):

1. C-level reviews your observation
2. C-level issues REJECT with findings
3. You receive findings via: `memory_signal_read agentId=<your specialist ID>`
4. You fix, save new observation, signal completion
5. Max 3 rounds — then C-level escalates to CEO

**Fix loop:** C-level sends findings → specialist fixes → specialist signals done → C-level re-reviews.

## The Response Pattern

1. **READ** — Complete feedback without reacting
2. **UNDERSTAND** — Restate requirement in own words (or ask)
3. **VERIFY** — Check against codebase reality + agentmemory context
4. **EVALUATE** — Technically sound for THIS codebase?
5. **RESPOND** — Technical acknowledgment or reasoned pushback
6. **IMPLEMENT** — One item at a time, test each

## Verify Against agentmemory

Before implementing, check for conflicts with past decisions:

1. `memory_smart_search` on review topic — past decisions, prior discussions
2. `memory_lesson_recall` on topic — "we tried this before and learned..."
3. `memory_file_history` on files touched — why the code is the way it is

Feedback contradicting recorded decisions → technical pushback, not blind implementation.

## Forbidden Responses

**NEVER:** "You're absolutely right!", "Great point!", "Let me implement that now" (before verification)

**INSTEAD:** Restate requirement, ask clarifying questions, push back with reasoning if wrong, just start working.

## Handling Unclear Feedback

If ANY item is unclear: **STOP** — do not implement anything yet. Ask for clarification on unclear items first.

Items may be related. Partial understanding = wrong implementation.

## Source-Specific Handling

**From your human partner:** Trusted, implement after understanding. Still ask if scope unclear. No performative agreement.

**From external reviewers:** Before implementing, check: technically correct? Breaks existing functionality? Reason for current implementation? (`memory_file_history`) Works on all platforms? Does reviewer understand full context?

If wrong → push back with reasoning. If can't verify → say so. If conflicts with human partner's decisions → stop and discuss.

**YAGNI check:** If reviewer suggests "implementing properly" → grep codebase for actual usage. If unused → "Remove it (YAGNI)?"

## Implementation Order

1. Clarify anything unclear FIRST
2. Then: blocking issues (breaks, security) → simple fixes (typos, imports) → complex fixes (refactoring, logic)
3. Test each fix individually
4. Verify no regressions
5. If lesson revealed: `memory_lesson_save` (tags `review,<topic>`)

## When To Push Back

Push back when: suggestion breaks functionality, reviewer lacks context, violates YAGNI, technically incorrect for stack, legacy/compatibility reasons, conflicts with human partner's decisions.

**How:** Technical reasoning, not defensiveness. Ask specific questions. Reference working tests/code. Involve human partner if architectural.

**If uncomfortable pushing back:** Name the tension, then tell your partner about the issue.

## Acknowledging Correct Feedback

```
✅ "Fixed. [Brief description]"
✅ "Good catch - [specific issue]. Fixed in [location]."
✅ [Just fix it and show in the code]

❌ "You're absolutely right!" / "Great point!" / "Thanks for catching that!" / ANY gratitude
```

Actions speak. Just fix it.

## Gracefully Correcting Pushback

If you pushed back and were wrong:
```
✅ "You were right - I checked [X] and it does [Y]. Implementing now."
❌ Long apology / defending / over-explaining
```

State correction factually and move on.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Performative agreement | State requirement or just act |
| Blind implementation | Verify against codebase first |
| Batch without testing | One at a time, test each |
| Assuming reviewer is right | Check if breaks things |
| Avoiding pushback | Technical correctness > comfort |
| Partial implementation | Clarify all items first |
| Can't verify, proceed anyway | State limitation, ask for direction |

## Real Examples

| Scenario | ❌ Wrong | ✅ Right |
|----------|---------|---------|
| "Remove legacy code" | "You're absolutely right! Let me remove..." | "Checking... build target needs 13+. Need legacy for backward compat." |
| "Implement proper metrics" | "Great point! Let me add that..." | "Grepped codebase - nothing calls this endpoint. Remove (YAGNI)?" |
| "Fix items 1-6" | Implement 1,2,3,6 now, ask about 4,5 later | "Understand 1,2,3,6. Need clarification on 4 and 5 before proceeding." |

## GitHub Thread Replies

Reply in the comment thread (`gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`), not as top-level PR comment.
