---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load plan from the agentmemory DAG, review critically, execute all tasks, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note:** Tell your human partner that Superpowers works much better with access to subagents (Claude Code, Codex CLI, Codex App, Copilot CLI, and Gemini CLI all qualify; see the per-platform tool refs in `../using-superpowers/references/`). If subagents are available, use superpowers:subagent-driven-development instead of this skill.

## The Process

### Step 1: Load and Review Plan
1. Ensure an isolated workspace: use superpowers:using-git-worktrees to create one or verify the existing one
2. Read plan from the DAG: `memory_frontier project=<name>` returns unblocked tasks with descriptions
3. Review critically — identify any questions or concerns about the plan
4. If concerns: Raise them with your human partner before starting
5. If no concerns: proceed to execution

### Step 2: Execute Tasks

For each unblocked task (from `memory_frontier`):
1. Claim the action: `memory_lease` with `operation=acquire`, `actionId=<task ID>`, `agentId=<your ID>` (prevents other agents from working it)
2. Follow each step exactly (task description has bite-sized steps)
3. Run verifications as specified
4. Mark as done: `memory_action_update` with `actionId=<task ID>`, `status=done`
5. Verify: `memory_frontier` now shows the next unblocked task

### Step 3: Complete Development

After all tasks complete and verified (memory_frontier returns empty):
- Announce: "I'm using the finishing-a-development-branch skill to complete this work."
- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch
- Follow that skill to verify tests, present options, execute choice

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** — stop and ask.

## Remember
- Review plan critically first (from the DAG, not a file)
- Follow task steps exactly
- Don't skip verifications
- Use `memory_lease` (`operation=acquire`) to claim before working, `memory_action_update` (`status=done`) to complete
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent
