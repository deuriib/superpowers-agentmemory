---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

# Verification Before Completion

**Core principle:** Evidence before claims, always.

**Iron Law:** NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE. If you haven't run the verification command in this message, you cannot claim it passes.

## Org Context

This is **pre-gate verification** — you (the specialist) self-check BEFORE the C-level reviews your work.

After you verify and signal completion, Gate 1 (C-Level Review) triggers. The C-level then independently evaluates your output.

**Flow:** Your verification → Signal done → C-level reviews (Gate 1)

## The Gate

BEFORE claiming any status or expressing satisfaction:

1. **IDENTIFY** — What command proves this claim?
2. **RUN** — Execute the FULL command (fresh, complete)
3. **READ** — Full output, check exit code, count failures
4. **VERIFY** — Does output confirm the claim?
   - NO → State actual status with evidence
   - YES → State claim WITH evidence
5. **ONLY THEN** — Make the claim

Skip any step = lying, not verifying.

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Regression test | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |

## Red Flags — STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!")
- About to commit/push/PR without verification
- Trusting agent success reports
- Relying on partial verification
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler |
| "Agent said success" | Verify independently |
| "I'm tired" | Exhaustion ≠ excuse |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |

## Key Patterns

| What | ✅ Correct | ❌ Wrong |
|------|-----------|---------|
| **Tests** | Run command → see "34/34 pass" → "All tests pass" | "Should pass now" / "Looks correct" |
| **Regression** | Write → pass → revert → MUST FAIL → restore → pass | "I've written a regression test" (no red-green) |
| **Build** | Run build → exit 0 → "Build passes" | "Linter passed" (linter ≠ compiler) |
| **Requirements** | Re-read plan → checklist → verify each → report | "Tests pass, phase complete" |
| **Agent** | Agent success → check VCS diff → verify changes | Trust agent report |

## When To Apply

**ALWAYS before:** ANY success/completion claims, expressions of satisfaction, positive statements about work state, committing, PR creation, task completion, moving to next task, delegating to agents.

**Applies to:** exact phrases, paraphrases, synonyms, implications of success, ANY communication suggesting completion/correctness.
