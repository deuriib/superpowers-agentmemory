---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans - ensures an isolated workspace exists via native tools or git worktree fallback
---

# Using Git Worktrees

**Core principle:** Detect existing isolation first. Then use native tools. Then fall back to git. Never fight the harness.

**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

## Step 0: Detect Existing Isolation

**Before creating anything, check if already in an isolated workspace:**

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

**Submodule guard:** `GIT_DIR != GIT_COMMON` is also true inside submodules. Verify not in submodule:
```bash
git rev-parse --show-superproject-working-tree 2>/dev/null
```

**If `GIT_DIR != GIT_COMMON` (and not submodule):** Already in linked worktree. Skip to Step 2. Do NOT create another worktree.

Report: "Already in isolated workspace at `<path>` on branch `<name>`." or "(detached HEAD, externally managed)."

**If `GIT_DIR == GIT_COMMON` (or in submodule):** Normal repo checkout. Ask consent before creating worktree:
> "Would you like me to set up an isolated worktree? It protects your current branch from changes."

Honor existing preference without asking. If declined, work in place and skip to Step 2.

## Step 1: Create Isolated Workspace

### 1a. Native Worktree Tools (preferred)

Use if available (`EnterWorktree`, `WorktreeCreate`, `/worktree` command, `--worktree` flag). Native tools handle directory placement, branch creation, and cleanup automatically.

Using `git worktree add` when you have a native tool creates phantom state your harness can't see or manage.

### 1b. Git Worktree Fallback

**Only if no native tool available.** Create worktree manually.

**Directory selection priority:**
1. Declared preference in instructions (use without asking)
2. Existing project-local directory (`.worktrees` preferred over `worktrees`)
3. Default: `.worktrees/` at project root

**Safety verification — MUST verify ignored:**
```bash
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```
If NOT ignored: add to .gitignore, commit, then proceed.

**Create worktree:**
```bash
path="$LOCATION/$BRANCH_NAME"
git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

**Sandbox fallback:** If `git worktree add` fails with permission error, inform user and work in current directory instead.

## Step 2: Project Setup

Auto-detect and run:
```bash
[ -f package.json ] && npm install
[ -f Cargo.toml ] && cargo build
[ -f requirements.txt ] && pip install -r requirements.txt
[ -f pyproject.toml ] && poetry install
[ -f go.mod ] && go mod download
```

## Step 3: Verify Clean Baseline

Run tests: `npm test / cargo test / pytest / go test ./...`

**If tests fail:** Report failures, ask whether to proceed or investigate.
**If tests pass:** Report ready.

```
Worktree ready at <full-path>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| Already in linked worktree | Skip creation (Step 0) |
| In a submodule | Treat as normal repo (Step 0 guard) |
| Native worktree tool available | Use it (Step 1a) |
| No native tool | Git worktree fallback (Step 1b) |
| `.worktrees/` exists | Use it (verify ignored) |
| `worktrees/` exists | Use it (verify ignored) |
| Both exist | Use `.worktrees/` |
| Neither exists | Check instruction file, then default `.worktrees/` |
| Directory not ignored | Add to .gitignore + commit |
| Permission error on create | Sandbox fallback, work in place |
| Tests fail during baseline | Report failures + ask |
| No package.json/Cargo.toml | Skip dependency install |

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Obviously not in a worktree" | Run Step 0. Harness isolation and submodules fool eyeballing. |
| "`git worktree add` is quicker" | Native tool owns placement, branching, cleanup. Bypassing creates phantom state. |
| "Directory is surely ignored" | Run `git check-ignore`. Unignored directory commits whole tree into repo. |
| "Any directory name works" | Explicit > existing project-local > `.worktrees/` default. |
| "Baseline tests can wait" | Dirty baseline makes every later failure ambiguous. Run now. |
