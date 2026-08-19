---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** If working in an isolated worktree, it should have been created via the `superpowers:using-git-worktrees` skill at execution time.

## Plan Storage — agentmemory DAG

Plans live in the agentmemory action DAG, not in .md files. The DAG is the single source of truth for plan state.

### Creating a plan

1. **Read the spec slot:** `memory_slot_get` with `label=<spec slot label>` — the spec is the authority the plan argues from; conflicts inside the plan resolve against it.

2. **Create the plan root action:**
   ```
   memory_action_create
     title: "[Feature Name] Implementation Plan"
     description: |
       Goal: [One sentence]
       Architecture: [2-3 sentences]
       Tech Stack: [Key technologies]
       Spec: [slot or reference to the spec]

       Global Constraints:
       [Project-wide requirements — one line each]
     parentId: (none — this is the root)
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
       - Consumes: [what this task uses from earlier tasks]
       - Produces: [what later tasks rely on]

       Steps:
       1. Write the failing test
       2. Run test to verify it fails
       3. Write minimal implementation
       4. Run test to verify it passes
       5. Commit
     parentId: <plan root action ID>
     requires: <action IDs of tasks this depends on>
     priority: <1-10>
     tags: task, plan:<plan_id>
   ```

4. **Tag all actions** with `memory_facet_tag`: for each action, call it with `targetId=<action ID>`, `targetType=action`, `dimension=plan`, `value={plan_id}` for querying.

5. **Create the context slot:**
   ```
   memory_slot_create
     label: "{plan_id}_context"
     content: "Plan: <name>\nPlan ID: <action ID>\nSpec slot: <slot>\nTasks: <list with IDs>"
     pinned: false
   ```

### What changes vs. the old .md approach

- **No .md files generated.** The DAG is the plan.
- **memory_frontier** replaces file scanning: `memory_frontier project=<name>` returns unblocked tasks.
- **Briefs via signals:** the controller reads the action description and sends it via `memory_signal_send` (`from`=controller, `to`=implementer, `content`=task description) to the implementer.
- **Ledger replaced by DAG:** `memory_action_update` with `status=done` = task complete. No `progress.md`.

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Task Right-Sizing

A task is the smallest unit that carries its own test cycle and is worth a
fresh reviewer's gate. When drawing task boundaries: fold setup,
configuration, scaffolding, and documentation steps into the task whose
deliverable needs them; split only where a reviewer could meaningfully
reject one task while approving its neighbor. Each task ends with an
independently testable deliverable.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan root action MUST include this in its description:**

```
Goal: [One sentence describing what this builds]
Architecture: [2-3 sentences about approach]
Tech Stack: [Key technologies/libraries]
Spec: [slot reference — e.g. slot agentmemory_source_of_truth_spec]

Global Constraints:
- [Project-wide requirement 1 — exact value]
- [Project-wide requirement 2 — exact value]
```

## Task Structure

Each task is an action in the DAG. The description contains the full task text:

```
Title: "Task N: [Component Name]"

Description:
  Files:
  - Create: exact/path/to/file.py
  - Modify: exact/path/to/existing.py:123-145
  - Test: tests/exact/path/to/test.py

  Interfaces:
  - Consumes: [what this task uses from earlier tasks — exact signatures]
  - Produces: [what later tasks rely on — exact function names, types]

  Steps:
  1. Write the failing test [actual test code]
  2. Run test to verify it fails [command + expected output]
  3. Write minimal implementation [actual code]
  4. Run test to verify it passes [command + expected output]
  5. Commit [git add + commit command]

  parentId: <plan root action ID>
  requires: <comma-separated action IDs this depends on>
```

## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## Self-Review

After writing the complete plan, look at the spec with fresh eyes and check the plan against it. This is a checklist you run yourself — not a subagent dispatch.

**1. Spec coverage:** Skim each section/requirement in the spec. Can you point to a task that implements it? List any gaps.

**2. Placeholder scan:** Search your plan for red flags — any of the patterns from the "No Placeholders" section above. Fix them.

**3. Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

If you find issues, fix them inline. No need to re-review — just fix and move on. If you find a spec requirement with no task, add the task.

## Execution Handoff

After creating the plan in the DAG, offer execution choice:

**"Plan complete and registered in agentmemory DAG. Task 1 is unblocked (`memory_frontier` confirms). Two execution options:**

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task via `memory_signal_send`, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session, updating the DAG as you go

**Which approach?"**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use superpowers:subagent-driven-development
- Fresh subagent per task + two-stage review
- Briefs sent via `memory_signal_send`, not file-based

**If Inline Execution chosen:**
- Execute directly from the DAG
- Use `memory_frontier` to find unblocked tasks, `memory_lease` (`operation=acquire`) to claim, `memory_action_update` (`status=done`) to mark done
