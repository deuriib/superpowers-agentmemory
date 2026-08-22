---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

Write implementation plans for engineers with zero codebase context. Document files, code, testing, and steps as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

## Plan Storage — agentmemory DAG

Plans live in the agentmemory action DAG, not in .md files. The DAG is the single source of truth.

### Creating a plan

1. **Read the spec slot:** `memory_slot_get` with `label=<spec slot label>`

2. **Create the plan root action:**
   ```
   memory_action_create
     title: "[Feature Name] Implementation Plan"
     description: |
       Goal: [One sentence]
       Architecture: [2-3 sentences]
       Tech Stack: [Key technologies]
       Spec: [slot reference]

       Global Constraints:
       - [Project-wide requirement 1]
       - [Project-wide requirement 2]
     priority: 10
     tags: plan, agentmemory
   ```

3. **Create one action per task:**
   ```
   memory_action_create
     title: "Task N: [Component Name]"
     description: |
       Files:
       - Create: path/to/file.py
       - Modify: path/to/existing.py:123-145
       - Test: tests/path/test.py

       Interfaces:
       - Consumes: [what this uses from earlier tasks]
       - Produces: [what later tasks rely on]

       Steps:
       1. Write the failing test [actual test code]
       2. Run test to verify it fails [command]
       3. Write minimal implementation [actual code]
       4. Run test to verify it passes [command]
       5. Commit [git add + commit command]
     parentId: <plan root action ID>
     requires: <action IDs of tasks this depends on>
     priority: <1-10>
     tags: task, plan:<plan_id>
   ```

4. **Tag all actions** with `memory_facet_tag`: `targetType=action`, `dimension=plan`, `value={plan_id}`

5. **Create the context slot:**
   ```
   memory_slot_create
     label: "{plan_id}_context"
     content: "Plan: <name>\nPlan ID: <action ID>\nSpec slot: <slot>\nTasks: <list with IDs>"
     pinned: false
   ```

## Guidelines

**Scope:** If the spec covers multiple independent subsystems, break into separate plans — one per subsystem. Each plan produces working, testable software on its own.

**File structure:** Map files before defining tasks. One clear responsibility per file. Files that change together live together. Follow existing patterns in established codebases.

**Task right-sizing:** Smallest unit with its own test cycle. Fold setup/config into the task that needs it. Split only where a reviewer could reject one task while approving its neighbor.

**Granularity:** Each step = one action (2-5 minutes). Write test → verify fail → implement → verify pass → commit.

## No Placeholders

Every step must contain actual content. These are **plan failures:**
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code)
- Steps that describe what without showing how
- References to types/functions not defined in any task

## Self-Review

After writing the plan, check against the spec:

1. **Spec coverage:** Can you point to a task for each requirement? List gaps.
2. **Placeholder scan:** Search for red flags from the list above. Fix them.
3. **Type consistency:** Do types, signatures, and names match across tasks?

Fix issues inline. If a spec requirement has no task, add it.

## Execution Handoff

After creating the plan, offer execution choice:

**"Plan complete in agentmemory DAG. Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task via `memory_signal_send`, review between tasks

**2. Inline Execution** — Execute in this session, update DAG as you go

**Which approach?"**

**Subagent-Driven:** Use `superpowers:subagent-driven-development` skill.

**Inline:** Use `memory_frontier` → `memory_lease` (acquire) → `memory_action_update` (status=done).
