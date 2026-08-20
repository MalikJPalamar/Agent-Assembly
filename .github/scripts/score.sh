#!/usr/bin/env bash
# Usage: score.sh <jest.json>  -> prints KEY=value lines: score, tests_passed, tests_failed
# Fitness = number of passing jest tests. A run is only KEEP-able when tests_failed == 0.
# A missing/invalid report (jest crashed, syntax error) scores 0 with tests_failed=1.
set -euo pipefail
F="${1:-}"
if [ -z "$F" ] || ! jq -e '.numPassedTests != null' "$F" >/dev/null 2>&1; then
  echo "score=0"; echo "tests_passed=0"; echo "tests_failed=1"; exit 0
fi
P=$(jq -r '.numPassedTests' "$F")
FAILED=$(jq -r '.numFailedTests + (.numRuntimeErrorTestSuites // 0) + (if .success then 0 else (if (.numFailedTests + (.numRuntimeErrorTestSuites // 0)) == 0 then 1 else 0 end) end)' "$F")
echo "score=$P"; echo "tests_passed=$P"; echo "tests_failed=$FAILED"
