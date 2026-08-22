---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

Load plan from agentmemory DAG, review critically, execute all tasks, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** If subagents are available (Claude Code, Codex CLI, Codex App, Copilot CLI, Gemini CLI), use `superpowers:subagent-driven-development` instead — it's faster and higher quality.

## The Process

### 1. Load and Review Plan

1. Ensure isolated workspace (`superpowers:using-git-worktrees`)
2. Read plan: `memory_frontier project=<name>` returns unblocked tasks
3. Read brief if sent: `memory_signal_read agentId=<your ID>`
4. Read spec if referenced: `memory_slot_get label=<spec slot label>`
5. Review critically — raise concerns before starting

### 2. Execute Tasks

For each unblocked task from `memory_frontier`:

1. **Claim:** `memory_lease operation=acquire actionId=<task ID> agentId=<your ID>`
2. **Activate:** `memory_action_update actionId=<task ID> status=active`
3. **Execute:** Follow each step exactly as specified
4. **Verify:** Run all verifications specified in the task
5. **Complete:** `memory_action_update actionId=<task ID> status=done`
6. **Check:** `memory_frontier` shows next unblocked task

### 3. Complete Development

When `memory_frontier` returns empty:
- Use `superpowers:finishing-a-development-branch` to verify tests, present options, execute choice

## When to Stop

Stop immediately and ask for help when:
- Blocker hit (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing start
- Verification fails repeatedly
- Don't understand an instruction

**Ask for clarification rather than guessing.**

Return to Step 1 when partner updates the plan or approach needs rethinking.
