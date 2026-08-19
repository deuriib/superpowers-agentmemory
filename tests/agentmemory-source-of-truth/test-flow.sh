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

check "Has memory_action_create reference" \
  "$SKILLS_DIR/writing-plans/SKILL.md" \
  "memory_action_create" \
  "present"

check "Has memory_facet_tag reference" \
  "$SKILLS_DIR/writing-plans/SKILL.md" \
  "memory_facet_tag" \
  "present"

check "Has memory_slot_create reference" \
  "$SKILLS_DIR/writing-plans/SKILL.md" \
  "memory_slot_create" \
  "present"
echo

# 3. SDD: no ledger file, uses DAG
echo "--- subagent-driven-development: DAG as ledger ---"
check "No progress.md as source" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "progress\.md.*(is|as).*(needed|source)" \
  "absent"

check "Has memory_frontier reference" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "memory_frontier" \
  "present"

check "Has memory_signal_send reference" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "memory_signal_send" \
  "present"

check "Has memory_action_update reference" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "memory_action_update" \
  "present"

check "No task-brief script" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "scripts/task-brief" \
  "absent"
echo

# 4. executing-plans: uses frontier/lease
echo "--- executing-plans: frontier/lease ---"
check "Has memory_frontier reference" \
  "$SKILLS_DIR/executing-plans/SKILL.md" \
  "memory_frontier" \
  "present"

check "Has memory_lease reference" \
  "$SKILLS_DIR/executing-plans/SKILL.md" \
  "memory_lease" \
  "present"

check "Has memory_action_update reference" \
  "$SKILLS_DIR/executing-plans/SKILL.md" \
  "memory_action_update" \
  "present"
echo

# 5. requesting-code-review: checkpoint integration
echo "--- requesting-code-review: checkpoint ---"
check "Has memory_checkpoint reference" \
  "$SKILLS_DIR/requesting-code-review/SKILL.md" \
  "memory_checkpoint" \
  "present"

check "Has checkpoint create operation" \
  "$SKILLS_DIR/requesting-code-review/SKILL.md" \
  "operation: create" \
  "present"

check "Has checkpoint resolve operation" \
  "$SKILLS_DIR/requesting-code-review/SKILL.md" \
  "operation=resolve" \
  "present"

check "Has memory_save reference" \
  "$SKILLS_DIR/requesting-code-review/SKILL.md" \
  "memory_save" \
  "present"
echo

# 6. finishing-a-development-branch: crystallize + snapshot
echo "--- finishing-a-development-branch: closure ---"
check "Has memory_crystallize reference" \
  "$SKILLS_DIR/finishing-a-development-branch/SKILL.md" \
  "memory_crystallize" \
  "present"

check "Has memory_snapshot_create reference" \
  "$SKILLS_DIR/finishing-a-development-branch/SKILL.md" \
  "memory_snapshot_create" \
  "present"

check "Has slot closure" \
  "$SKILLS_DIR/finishing-a-development-branch/SKILL.md" \
  "closure" \
  "present"
echo

# Summary
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
