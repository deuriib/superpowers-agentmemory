#!/usr/bin/env bash
# Test: agentmemory as source of truth
# Verifies that the 5 modified skills use agentmemory tools
# instead of .md files for plan state.
set -euo pipefail

SKILLS_DIR="$(cd "$(dirname "$0")/../../skills" && pwd)"
PASS=0
FAIL=0

check() {
  local desc="$1" file="$2" pattern="$3" expect="${4:-present}"
  if grep -qE "$pattern" "$file" 2>/dev/null; then
    if [ "$expect" = "absent" ]; then
      echo "FAIL: $desc — found '$pattern' in $file (should be absent)"
      FAIL=$((FAIL + 1))
    else
      echo "PASS: $desc"
      PASS=$((PASS + 1))
    fi
  else
    if [ "$expect" = "absent" ]; then
      echo "PASS: $desc"
      PASS=$((PASS + 1))
    else
      echo "FAIL: $desc — '$pattern' not found in $file"
      FAIL=$((FAIL + 1))
    fi
  fi
}

echo "=== Agentmemory Source of Truth Flow Tests ==="
echo

# 1. All 5 skills exist
echo "--- File existence ---"
for skill in writing-plans subagent-driven-development executing-plans requesting-code-review finishing-a-development-branch; do
  file="$SKILLS_DIR/$skill/SKILL.md"
  if [ -f "$file" ]; then
    echo "PASS: $skill/SKILL.md exists"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $skill/SKILL.md missing"
    FAIL=$((FAIL + 1))
  fi
done
echo

# 2. No .md plan storage in writing-plans
echo "--- writing-plans: no .md plan storage ---"
check "No docs/superpowers/plans/ reference" \
  "$SKILLS_DIR/writing-plans/SKILL.md" \
  "docs/superpowers/plans/" \
  "absent"

check "Has action_create reference" \
  "$SKILLS_DIR/writing-plans/SKILL.md" \
  "action_create" \
  "present"

check "Has facet_tag reference" \
  "$SKILLS_DIR/writing-plans/SKILL.md" \
  "facet_tag" \
  "present"

check "Has slot_create reference" \
  "$SKILLS_DIR/writing-plans/SKILL.md" \
  "slot_create" \
  "present"
echo

# 3. SDD: no ledger file, uses DAG
echo "--- subagent-driven-development: DAG as ledger ---"
check "No progress.md as source" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "progress\.md.*needed" \
  "absent"

check "Has frontier reference" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "frontier" \
  "present"

check "Has signal_send reference" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "signal_send" \
  "present"

check "Has action_update reference" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "action_update" \
  "present"

check "No task-brief script" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "scripts/task-brief" \
  "absent"
echo

# 4. executing-plans: uses frontier/lease
echo "--- executing-plans: frontier/lease ---"
check "Has frontier reference" \
  "$SKILLS_DIR/executing-plans/SKILL.md" \
  "frontier" \
  "present"

check "Has lease reference" \
  "$SKILLS_DIR/executing-plans/SKILL.md" \
  "lease" \
  "present"

check "Has action_update reference" \
  "$SKILLS_DIR/executing-plans/SKILL.md" \
  "action_update" \
  "present"
echo

# 5. requesting-code-review: checkpoint integration
echo "--- requesting-code-review: checkpoint ---"
check "Has checkpoint_create reference" \
  "$SKILLS_DIR/requesting-code-review/SKILL.md" \
  "checkpoint_create" \
  "present"

check "Has checkpoint_resolve reference" \
  "$SKILLS_DIR/requesting-code-review/SKILL.md" \
  "checkpoint_resolve" \
  "present"

check "Has memory_save reference" \
  "$SKILLS_DIR/requesting-code-review/SKILL.md" \
  "memory_save" \
  "present"
echo

# 6. finishing-a-development-branch: crystallize + snapshot
echo "--- finishing-a-development-branch: closure ---"
check "Has crystallize reference" \
  "$SKILLS_DIR/finishing-a-development-branch/SKILL.md" \
  "crystallize" \
  "present"

check "Has snapshot_create reference" \
  "$SKILLS_DIR/finishing-a-development-branch/SKILL.md" \
  "snapshot_create" \
  "present"

check "Has slot closure" \
  "$SKILLS_DIR/finishing-a-development-branch/SKILL.md" \
  "closure" \
  "present"
echo

# Summary
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
