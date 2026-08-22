---
name: using-superpowers
description: Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before ANY response including clarifying questions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## The Rule

**Invoke relevant or requested skills BEFORE any response or action** — including clarifying questions, exploring the codebase, or checking files. If it turns out wrong for the situation, you don't have to use it.

**If you haven't already brainstormed** - invoke the brainstorming skill first.

Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it has a checklist, create a todo per item.

## Skill Priority

Process skills first (brainstorming, systematic-debugging), then implementation skills. Examples:
- "Let's build X" → brainstorming first, then implementation
- "Fix this bug" → systematic-debugging first, then domain skills

## Red Flags — STOP, You're Rationalizing

| Thought | Reality |
|---------|---------|
| "Simple question" | Questions are tasks. Check for skills. |
| "Need more context first" | Skill check BEFORE clarifying questions. |
| "Explore codebase first" | Skills tell you HOW to explore. |
| "Check git/files quickly" | Files lack conversation context. |
| "Gather information first" | Skills tell you HOW to gather. |
| "Doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "Doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "Just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. |
| "I know what that means" | Knowing ≠ using the skill. |

## User Instructions

User instructions (CLAUDE.md, AGENTS.md, GEMINI.md, direct requests) take precedence over skills, which override default behavior. Only skip skill workflows when your human partner explicitly tells you to.
