---
name: finishing-a-development-branch
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work
---

# Finishing a Development Branch

**Core principle:** Verify tests → Detect environment → Present options → Execute choice → Clean up.

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

## Org Context

Only run this AFTER review gates pass:
- **Gate 1 + Gate 2 clear** → proceed to finish
- **Gate 3 (CEO Final) DONE** → proceed to finish
- **Any gate BLOCKED/REWORK** → fix first, don't finish yet

## Step 1: Verify Tests

Run the full test suite. If tests fail, report failures and stop — menu comes after a green suite.

## Step 2: Detect Environment

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

| State | Menu | Cleanup |
|-------|------|---------|
| `GIT_DIR == GIT_COMMON` (normal repo) | 3 options | No worktree cleanup |
| `GIT_DIR != GIT_COMMON`, named branch | 3 options | Provenance-based |
| `GIT_DIR != GIT_COMMON`, detached HEAD | 2 options (no merge) | Externally managed |

## Step 3: Determine Base Branch

Ask: "This branch split from <best guess> - is that correct?" Confirm before merging — merging into wrong base is expensive to undo.

## Step 4: Present Options

**Normal/named-branch worktree:**
```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)

Which option?
```

**Detached HEAD:**
```
Implementation complete. You're on a detached HEAD (externally managed workspace).

1. Push as new branch and create a Pull Request
2. Keep as-is (I'll handle it later)

Which option?
```

Discard only in response to explicit request. Wait for their answer — integration decision is theirs.

## Step 5: Execute Choice

### Option 1: Merge Locally

```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
git checkout <base-branch> && git pull
git merge <feature-branch>
<test command>
```

If tests fail on merged result: stop, leave worktree/branch in place, investigate.
If green: `git worktree remove` (Step 6), then `git branch -d <feature-branch>`.

### Option 2: Push and Create PR

```bash
git push -u origin <feature-branch>
# Detached HEAD: git push origin HEAD:refs/heads/<new-branch>
```

Create PR against `<base-branch>` using forge's tooling. Report URL. Keep worktree for PR feedback.

### Option 3: Keep As-Is

Report: "Keeping branch <name>. Worktree preserved at <path>."

### Discard (explicit request only)

Confirm:
```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for exact `discard` confirmation, then:
```bash
MAIN_ROOT=$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)
cd "$MAIN_ROOT"
git worktree remove "$WORKTREE_PATH"
git branch -D <feature-branch>
```

## Step 6: Cleanup Workspace

Runs for Option 1 and confirmed discards only.

- **`GIT_DIR == GIT_COMMON`:** No worktree to clean. Done.
- **Under `.worktrees/` or `worktrees/`:** Superpowers created it — clean up:
  ```bash
  git worktree remove "$WORKTREE_PATH" && git worktree prune
  ```
- **Removal refused:** Files exist nowhere else. Show `git -C "$WORKTREE_PATH" status --porcelain -uall` and ask:
  ```
  Worktree removal refused — these files were never committed:
  <file list>
  1. Commit them to <branch>
  2. Move them into <main repo root>
  3. Delete them (unrecoverable)
  Which?
  ```
- **Otherwise:** Host environment owns workspace — leave in place.

## Step 7: Close the Plan in agentmemory

1. **Crystallize:** `memory_crystallize actionIds=<completed IDs> project=<name>`
2. **Snapshot:** `memory_snapshot_create message="Completed: <feature>. Tasks: <N>. Branch: <branch>."`
3. **Closure slot:**
   ```
   memory_slot_create
     label: "{plan_id}_closure"
     content: "Plan: <name>\nCompleted: <date>\nBranch: <branch>\nCommits: <range>\nSummary: <what>\nDecisions: <rulings>\nLessons: <learned>"
     pinned: false
   ```
4. **Mark done:** `memory_action_update actionId=<plan root> status=done`
5. **Clean context:** `memory_slot_delete label="{plan_id}_context"`
6. **Clean diffs:** `rm -rf .superpowers/sdd/<plan>/review-*.diff`

## Quick Reference

| Option | Merge | Push | Keep Worktree | Cleanup Branch |
|--------|-------|------|---------------|----------------|
| 1. Merge locally | ✓ | - | - | ✓ |
| 2. Create PR | - | ✓ | ✓ | - |
| 3. Keep as-is | - | - | ✓ | - |
| Discard (explicit only) | - | - | - | ✓ (force) |

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Tests passed earlier" | Run suite on the tree you're integrating. |
| "They obviously want it merged" | Present menu and wait. |
| "I'll offer to discard it" | Menu is complete as written. Discard only when explicitly asked. |
| "'Yeah, get rid of it'" | Only typed `discard` authorizes deletion. |
| "PR is up, worktree is clutter" | PR feedback gets fixed there. It stays until work lands. |
| "Removal refused — `--force`" | Files exist only in that worktree. `--force` destroys them. Show and ask. |
| "Merged failure is flaky" | Failing merged result stops everything. Investigate. |
| "Base branch is obviously main" | Confirm fork point. Wrong base is expensive to undo. |
