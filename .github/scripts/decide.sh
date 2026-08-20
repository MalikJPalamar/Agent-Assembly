#!/usr/bin/env bash
# Usage: decide.sh <score> <prev_best> <tests_failed> <files_changed> [max_files]
# Prints KEEP or DISCARD plus a reason on stderr. Pure function, no side effects.
#
# KEEP  iff tests_failed == 0 AND score > prev_best AND files_changed <= max_files
# Anything else is DISCARD. This is the only place the keep/discard rule lives.
set -euo pipefail
SCORE="${1:-0}"; PREV="${2:-0}"; FAILED="${3:-1}"; FILES="${4:-0}"; MAX="${5:-25}"

reason() { echo "$1" >&2; }

if ! [[ "$SCORE" =~ ^[0-9]+$ && "$PREV" =~ ^[0-9]+$ && "$FAILED" =~ ^[0-9]+$ && "$FILES" =~ ^[0-9]+$ ]]; then
  reason "DISCARD: non-numeric input (score=$SCORE prev=$PREV failed=$FAILED files=$FILES)"
  echo DISCARD; exit 0
fi
if [ "$FAILED" -ne 0 ]; then
  reason "DISCARD: $FAILED failing test(s)"; echo DISCARD; exit 0
fi
if [ "$FILES" -gt "$MAX" ]; then
  reason "DISCARD: $FILES files changed exceeds cap of $MAX"; echo DISCARD; exit 0
fi
if [ "$SCORE" -le "$PREV" ]; then
  reason "DISCARD: score $SCORE did not beat previous best $PREV"; echo DISCARD; exit 0
fi
reason "KEEP: score $SCORE > $PREV, all tests green, $FILES file(s)"
echo KEEP
