---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
---

# Systematic Debugging

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Iron Law:** NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.

## When to Use

Use for ANY technical issue: test failures, bugs, unexpected behavior, performance problems, build failures, integration issues.

**ESPECIALLY when:** under time pressure, "just one quick fix" seems obvious, you've tried multiple fixes already, or you don't fully understand the issue.

**Don't skip when:** issue seems simple, you're in a hurry, or manager wants it fixed NOW. Systematic is faster than thrashing.

## The Four Phases

Complete each phase before proceeding to the next.

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Recall from agentmemory** — `memory_smart_search` + `memory_lesson_recall` + `memory_file_history` on files in error. Past sessions may contain this exact bug and fix.
2. **Read error messages carefully** — don't skip. Stack traces, line numbers, error codes.
3. **Reproduce consistently** — exact steps, every time. If not reproducible → gather more data, don't guess.
4. **Check recent changes** — git diff, new deps, config changes. Check `memory_commits` for agent-linked commits.
5. **Gather evidence in multi-component systems** — log at each component boundary, run once to gather evidence, THEN analyze which layer fails.
6. **Trace data flow** — where does bad value originate? Trace up to source. Fix at source, not symptom.

### Phase 2: Pattern Analysis

1. **Find working examples** — similar working code in same codebase
2. **Compare against references** — read reference implementation COMPLETELY, don't skim
3. **Identify differences** — list every difference, however small
4. **Understand dependencies** — what settings, config, environment, assumptions

### Phase 3: Hypothesis and Testing

1. **Form single hypothesis** — "I think X is root cause because Y". Be specific.
2. **Test minimally** — SMALLEST possible change, one variable at a time
3. **Verify before continuing** — worked? → Phase 4. Didn't? → NEW hypothesis, don't stack fixes
4. **When you don't know** — say "I don't understand X". Don't pretend.

### Phase 4: Implementation

1. **Create failing test case** — simplest reproduction, automated if possible. Use `superpowers:test-driven-development`.
2. **Implement single fix** — address root cause, ONE change, no "while I'm here" improvements
3. **Verify fix** — tests pass, no regressions. Use `superpowers:verification-before-completion`.
4. **Save the lesson** — `memory_lesson_save` (tags `bug,<component>`, confidence 0.7)
5. **If fix doesn't work** — STOP. Count attempts. < 3 → return to Phase 1. ≥ 3 → **question architecture** (step 6)
6. **If 3+ fixes failed** — architectural problem. Each fix reveals new coupling. STOP and discuss with human partner before attempting more fixes. Query memory for past architectural discussions.

## Debugging Recall Protocol

Every session starts with memory queries. Skip only if server is down (503).

**Core queries (every bug):**
1. `memory_smart_search` — error message, symptom, or component name
2. `memory_lesson_recall` — topic
3. `memory_file_history` — files in error/stack trace

**Situation-specific:**

| Situation | Add |
|-----------|-----|
| Recent change suspected | `memory_commits` + `memory_commit_lookup` on breaking commit |
| 3+ fixes failed | `memory_smart_search` on architecture/pattern being questioned |
| Timing-dependent error | `memory_sessions` / `memory_timeline` around when it happened |

**Use results:** Past fix → test minimally. Past failed fix → don't repeat. Lesson → surface as constraint. File history → check what changed. Nothing relevant → proceed without forcing.

## Red Flags — STOP and Follow Process

If you catch yourself thinking:
- "Quick fix for now, investigate later"
- "Just try changing X and see"
- "Add multiple changes, run tests"
- "Skip the test, I'll manually verify"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "Pattern says X but I'll adapt it differently"
- "Here are the main problems: [lists fixes without investigation]"
- "This bug is new, no need to check memory"
- "I already know what this error means"
- Proposing solutions before tracing data flow
- **"One more fix attempt" (when already tried 2+)**
- **Each fix reveals new problem in different place**

**ALL mean: STOP. Return to Phase 1.** If 3+ fixes failed → question architecture.

## Human Partner Signals You're Doing It Wrong

- "Is that not happening?" — You assumed without verifying
- "Will it show us...?" — You should have added evidence gathering
- "Stop guessing" — Proposing fixes without understanding
- "Ultra-think this" — Question fundamentals, not just symptoms
- "We're stuck?" (frustrated) — Your approach isn't working

**When you see these:** STOP. Return to Phase 1.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple, don't need process" | Simple issues have root causes too. |
| "Emergency, no time for process" | Systematic is FASTER than thrashing. |
| "Just try this first, then investigate" | First fix sets the pattern. Do it right. |
| "I'll write test after confirming fix works" | Untested fixes don't stick. Test first. |
| "Multiple fixes at once saves time" | Can't isolate what worked. Causes new bugs. |
| "Reference too long, I'll adapt the pattern" | Partial understanding guarantees bugs. |
| "I see the problem, let me fix it" | Seeing symptoms ≠ understanding root cause. |
| "This bug is new, memory won't have it" | "New" bugs are often repeats. |
| "I already know what this error means" | Knowing error ≠ knowing what was tried. |
| "One more fix attempt" (after 2+ failures) | 3+ = architectural problem. Question pattern. |

## Quick Reference

| Phase | Key Activities | Success Criteria |
|-------|---------------|------------------|
| **1. Root Cause** | Recall, read errors, reproduce, check changes, gather evidence | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare | Identify differences |
| **3. Hypothesis** | Form theory, test minimally | Confirmed or new hypothesis |
| **4. Implementation** | Create test, fix, verify, save lesson | Bug resolved, tests pass |

## When Process Reveals "No Root Cause"

If investigation reveals truly environmental/timing/external issue:
1. Document what you investigated
2. Implement appropriate handling (retry, timeout, error message)
3. Add monitoring/logging for future investigation

**But:** 95% of "no root cause" cases are incomplete investigation.

## Supporting Techniques

- `root-cause-tracing.md` — Trace bugs backward through call stack
- `defense-in-depth.md` — Add validation at multiple layers after finding root cause
- `condition-based-waiting.md` — Replace arbitrary timeouts with condition polling
