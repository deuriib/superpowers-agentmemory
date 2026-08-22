---
name: brainstorming
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation."
---

# Brainstorming Ideas Into Designs

Turn ideas into designs through collaborative dialogue. Classify the task, recall context, explore, clarify, present a design, get approval — then implement.

<HARD-GATE>
Do NOT invoke any implementation skill, write any code, scaffold any
project, or take any implementation action until you have told your
human partner what you intend and they have approved it. The ceremony
scales with the task; the approval gate never does.
</HARD-GATE>

## Three Paths

Classify the request and announce it:

- **Spike** — feasibility question ("can we...", "is it possible..."). Present 2-3 sentence probe plan, get a nod, investigate, report findings. Throwaway code only.
- **Bounded** — well-scoped change to existing code (one file, one endpoint, one flag). Ask clarifying questions, present short design in chat, get explicit yes. No plan doc.
- **Architectural** — new projects, subsystems, restructuring. Full process: questions → approaches → sectioned design → spec → writing-plans skill.

**Rule:** When in doubt, take the heavier path. Hidden complexity discovered mid-task upgrades the path — never downgrade.

## Anti-Pattern: "Too Simple To Need Approval"

Every path ends with approval before implementation. Even a two-sentence design needs approval. Simple tasks cause the most wasted work from unexamined assumptions.

## Red Flags

| Thought | Reality |
|---------|---------|
| "Too simple to need a design" | Simple = short design, not no design. Two sentences, then approval. |
| "I'll call it bounded and skip the spec" | Reaching for a label to skip work IS the doubt — take the heavier path. |
| "It's obvious — I'll start while they read" | Gate is approval, not design length. Present, then stop until yes. |
| "I understand this kind of app, so it's bounded" | Bounded measures the repo, not your familiarity. No existing flow = architectural. |
| "The spike works, so I'll keep the code" | Spike output is an answer. Keeping code is a new request. |
| "It grew, but I'm almost done" | Hidden complexity upgrades mid-task. Stop and say so. |
| "They approved the spike, so follow-up is approved too" | Each task gets its own classification and approval. |

## Checklists

### Spike
1. Recall: `memory_smart_search` + `memory_lesson_recall`
2. Explore project context (frame the probe)
3. Present question + probe plan (2-3 sentences)
4. Get approval (a nod)
5. Investigate cheaply
6. Report findings as recommendation

### Bounded
1. Recall: `memory_smart_search` + `memory_lesson_recall` + `memory_file_history` on affected files
2. Explore project context (files, docs, commits)
3. Ask clarifying questions (one at a time)
4. Present short design in chat (approach, files, testing)
5. Get approval — STOP and wait for explicit yes
6. Implement via normal workflow (TDD applies)

### Architectural
1. Recall: full protocol (`memory_smart_search` + `memory_lesson_recall` + `memory_profile` + `memory_sessions` + `memory_patterns` + `memory_graph_query`)
2. Explore project context
3. Offer visual companion just-in-time (not upfront)
4. Ask clarifying questions (purpose, constraints, success criteria)
5. Propose 2-3 approaches with trade-offs and recommendation
6. Present design sections, get approval after each
7. Save spec: `memory_slot_create` label `spec_<topic_slug>`, pinned: false
8. Self-review: placeholders, contradictions, scope, ambiguity — fix inline
9. User reviews saved spec
10. Invoke writing-plans skill

## Recall Protocol

Every session starts with memory queries. Core (all paths):

1. **`memory_smart_search`** — past decisions, errors, related work
2. **`memory_lesson_recall`** — "we tried this before and learned..."

Path additions:

| Path | Add |
|------|-----|
| Spike | Core only |
| Bounded | + `memory_file_history` |
| Architectural | + `memory_profile`, `memory_sessions`, `memory_patterns`, `memory_graph_query` |

Use results: reference decisions in questions, surface lessons as constraints, check if past work is reusable, follow established patterns.

## Cross-Department Work

When brainstorming involves multiple departments:
- C-levels coordinate via `memory_signal_send type=request` (requires CEO pre-authorization)
- CEO (montilla) approves cross-department scope before proceeding
- Each department's C-level owns their domain's implementation

**Presenting:** Scale sections to complexity (sentences if simple, paragraphs if nuanced). Ask after each section. Cover architecture, components, data flow, error handling, testing.

**Isolation:** Each unit has one clear purpose, well-defined interface, independently testable. If you can't change internals without breaking consumers, boundaries need work.

**Existing codebases:** Explore before proposing. Follow patterns. Include targeted improvements where they affect the work. Don't propose unrelated refactoring.

## Visual Companion

Offer **just-in-time** when a question would genuinely be clearer shown than told. Offer as its own message. Per-question decision: browser for visual content, terminal for text/conceptual.
