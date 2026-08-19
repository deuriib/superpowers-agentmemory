#!/usr/bin/env bash
# Test: agentmemory as source of truth
# Verifies that all skills use agentmemory tools instead of .md files
# for plan state, that every referenced tool exists in the manifest,
# and that key tool parameters are present.
set -euo pipefail

SKILLS_DIR="$(cd "$(dirname "$0")/../../skills" && pwd)"
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"
MANIFEST="$TEST_DIR/tools-manifest.txt"
PASS=0
FAIL=0

check() {
  local desc="$1" file="$2" pattern="$3" expect="${4:-present}"
  local found=false
  grep -qE "$pattern" "$file" 2>/dev/null && found=true
  if [ "$expect" = "absent" ]; then
    if [ "$found" = true ]; then
      echo "FAIL: $desc — found '$pattern' in $file (should be absent)"
      FAIL=$((FAIL + 1))
    else
      echo "PASS: $desc"
      PASS=$((PASS + 1))
    fi
  else
    if [ "$found" = true ]; then
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
echo "--- writing-plans: DAG storage + required tools ---"
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

# 7. Manifest validation: every memory_* tool reference must be a real tool
echo "--- Manifest validation: all memory_* tool references ---"
if [ ! -f "$MANIFEST" ]; then
  echo "FAIL: tools manifest missing at $MANIFEST"
  FAIL=$((FAIL + 1))
else
  for skill_dir in "$SKILLS_DIR"/*/; do
    skill_name="$(basename "$skill_dir")"
    file="$skill_dir/SKILL.md"
    [ -f "$file" ] || continue
    # \b prevents matching slot labels like agentmemory_source_of_truth_spec
    while IFS= read -r tool; do
      if grep -Fxq "$tool" "$MANIFEST"; then
        echo "PASS: $skill_name references valid tool memory_$tool"
        PASS=$((PASS + 1))
      else
        echo "FAIL: $skill_name references unknown tool 'memory_$tool' (not in manifest)"
        FAIL=$((FAIL + 1))
      fi
    done < <(grep -oE '\bmemory_[a-z_]+' "$file" | sed 's/^memory_//' | sort -u || true)
  done
fi
echo

# 8. Residue sweep across ALL skills: no .md plan storage, no obsolete scripts
echo "--- Residue sweep across all skills ---"
for skill_dir in "$SKILLS_DIR"/*/; do
  skill_name="$(basename "$skill_dir")"
  file="$skill_dir/SKILL.md"
  [ -f "$file" ] || continue
  check "$skill_name: no docs/superpowers/plans/ reference" \
    "$file" \
    "docs/superpowers/plans/" \
    "absent"
  check "$skill_name: no scripts/task-brief reference" \
    "$file" \
    "scripts/task-brief" \
    "absent"
  check "$skill_name: no progress.md used as source" \
    "$file" \
    "(cat|read|track|ledger|source of truth).{0,40}progress\.md" \
    "absent"
done
echo

# 9. Filesystem check: obsolete task-brief script must not exist
echo "--- Filesystem check ---"
if [ ! -f "$SKILLS_DIR/subagent-driven-development/scripts/task-brief" ]; then
  echo "PASS: skills/subagent-driven-development/scripts/task-brief does not exist"
  PASS=$((PASS + 1))
else
  echo "FAIL: skills/subagent-driven-development/scripts/task-brief still exists"
  FAIL=$((FAIL + 1))
fi
echo

# 10. Key-parameter checks per skill
echo "--- writing-plans: key parameters ---"
check "writing-plans: memory_frontier" \
  "$SKILLS_DIR/writing-plans/SKILL.md" \
  "memory_frontier" \
  "present"
check "writing-plans: memory_signal_send" \
  "$SKILLS_DIR/writing-plans/SKILL.md" \
  "memory_signal_send" \
  "present"
check "writing-plans: memory_action_update" \
  "$SKILLS_DIR/writing-plans/SKILL.md" \
  "memory_action_update" \
  "present"
check "writing-plans: memory_lease" \
  "$SKILLS_DIR/writing-plans/SKILL.md" \
  "memory_lease" \
  "present"
check "writing-plans: dimension=plan" \
  "$SKILLS_DIR/writing-plans/SKILL.md" \
  "dimension=plan" \
  "present"
check "writing-plans: memory_slot_get" \
  "$SKILLS_DIR/writing-plans/SKILL.md" \
  "memory_slot_get" \
  "present"
echo

echo "--- subagent-driven-development: key parameters ---"
check "SDD: memory_signal_read" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "memory_signal_read" \
  "present"
check "SDD: memory_facet_query" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "memory_facet_query" \
  "present"
check "SDD: memory_smart_search" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "memory_smart_search" \
  "present"
check "SDD: memory_save" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "memory_save" \
  "present"
check "SDD: memory_lease" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "memory_lease" \
  "present"
check "SDD: status=active" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "status=active" \
  "present"
check "SDD: memory_slot_get" \
  "$SKILLS_DIR/subagent-driven-development/SKILL.md" \
  "memory_slot_get" \
  "present"
echo

echo "--- executing-plans: key parameters ---"
check "executing-plans: memory_signal_read" \
  "$SKILLS_DIR/executing-plans/SKILL.md" \
  "memory_signal_read" \
  "present"
check "executing-plans: memory_slot_get" \
  "$SKILLS_DIR/executing-plans/SKILL.md" \
  "memory_slot_get" \
  "present"
check "executing-plans: status=active" \
  "$SKILLS_DIR/executing-plans/SKILL.md" \
  "status=active" \
  "present"
echo

echo "--- requesting-code-review: key parameters ---"
check "requesting-code-review: linkedActionIds" \
  "$SKILLS_DIR/requesting-code-review/SKILL.md" \
  "linkedActionIds" \
  "present"
check "requesting-code-review: type: approval" \
  "$SKILLS_DIR/requesting-code-review/SKILL.md" \
  "type: approval" \
  "present"
check "requesting-code-review: checkpointId" \
  "$SKILLS_DIR/requesting-code-review/SKILL.md" \
  "checkpointId" \
  "present"
check "requesting-code-review: status=passed" \
  "$SKILLS_DIR/requesting-code-review/SKILL.md" \
  "status=passed" \
  "present"
echo

echo "--- finishing-a-development-branch: key parameters ---"
check "finishing: memory_slot_create" \
  "$SKILLS_DIR/finishing-a-development-branch/SKILL.md" \
  "memory_slot_create" \
  "present"
check "finishing: {plan_id}_closure" \
  "$SKILLS_DIR/finishing-a-development-branch/SKILL.md" \
  "{plan_id}_closure" \
  "present"
check "finishing: pinned: false" \
  "$SKILLS_DIR/finishing-a-development-branch/SKILL.md" \
  "pinned: false" \
  "present"
check "finishing: memory_action_update" \
  "$SKILLS_DIR/finishing-a-development-branch/SKILL.md" \
  "memory_action_update" \
  "present"
check "finishing: memory_slot_delete" \
  "$SKILLS_DIR/finishing-a-development-branch/SKILL.md" \
  "memory_slot_delete" \
  "present"
echo

echo "--- brainstorming: key parameters ---"
check "brainstorming: memory_slot_create" \
  "$SKILLS_DIR/brainstorming/SKILL.md" \
  "memory_slot_create" \
  "present"
check "brainstorming: memory_slot_get" \
  "$SKILLS_DIR/brainstorming/SKILL.md" \
  "memory_slot_get" \
  "present"
check "brainstorming: memory_smart_search" \
  "$SKILLS_DIR/brainstorming/SKILL.md" \
  "memory_smart_search" \
  "present"
check "brainstorming: memory_lesson_recall" \
  "$SKILLS_DIR/brainstorming/SKILL.md" \
  "memory_lesson_recall" \
  "present"
check "brainstorming: memory_profile" \
  "$SKILLS_DIR/brainstorming/SKILL.md" \
  "memory_profile" \
  "present"
check "brainstorming: memory_sessions" \
  "$SKILLS_DIR/brainstorming/SKILL.md" \
  "memory_sessions" \
  "present"
check "brainstorming: memory_patterns" \
  "$SKILLS_DIR/brainstorming/SKILL.md" \
  "memory_patterns" \
  "present"
check "brainstorming: memory_graph_query" \
  "$SKILLS_DIR/brainstorming/SKILL.md" \
  "memory_graph_query" \
  "present"
check "brainstorming: memory_save" \
  "$SKILLS_DIR/brainstorming/SKILL.md" \
  "memory_save" \
  "present"
echo

echo "--- systematic-debugging: key parameters ---"
check "debugging: memory_commits" \
  "$SKILLS_DIR/systematic-debugging/SKILL.md" \
  "memory_commits" \
  "present"
check "debugging: memory_commit_lookup" \
  "$SKILLS_DIR/systematic-debugging/SKILL.md" \
  "memory_commit_lookup" \
  "present"
check "debugging: memory_timeline" \
  "$SKILLS_DIR/systematic-debugging/SKILL.md" \
  "memory_timeline" \
  "present"
check "debugging: memory_sessions" \
  "$SKILLS_DIR/systematic-debugging/SKILL.md" \
  "memory_sessions" \
  "present"
check "debugging: memory_lesson_save" \
  "$SKILLS_DIR/systematic-debugging/SKILL.md" \
  "memory_lesson_save" \
  "present"
echo

echo "--- dispatching-parallel-agents: key parameters ---"
check "parallel: memory_lease" \
  "$SKILLS_DIR/dispatching-parallel-agents/SKILL.md" \
  "memory_lease" \
  "present"
check "parallel: memory_signal_send" \
  "$SKILLS_DIR/dispatching-parallel-agents/SKILL.md" \
  "memory_signal_send" \
  "present"
check "parallel: memory_signal_read" \
  "$SKILLS_DIR/dispatching-parallel-agents/SKILL.md" \
  "memory_signal_read" \
  "present"
echo

echo "--- receiving-code-review: key parameters ---"
check "receiving: memory_lesson_save" \
  "$SKILLS_DIR/receiving-code-review/SKILL.md" \
  "memory_lesson_save" \
  "present"
check "receiving: memory_smart_search" \
  "$SKILLS_DIR/receiving-code-review/SKILL.md" \
  "memory_smart_search" \
  "present"
check "receiving: memory_lesson_recall" \
  "$SKILLS_DIR/receiving-code-review/SKILL.md" \
  "memory_lesson_recall" \
  "present"
check "receiving: memory_file_history" \
  "$SKILLS_DIR/receiving-code-review/SKILL.md" \
  "memory_file_history" \
  "present"
echo

# Summary
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
