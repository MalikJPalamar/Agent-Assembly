#!/usr/bin/env bash
# Usage: prev-best.sh <results.tsv> [spec_id]
# Prints the highest score among KEEP rows (optionally only for one spec). 0 if none.
# results.tsv columns: date run_id spec change score prev_best verdict
set -euo pipefail
F="$1"; SPEC="${2:-}"
[ -f "$F" ] || { echo 0; exit 0; }
awk -F'\t' -v spec="$SPEC" 'NR>1 && $7=="KEEP" && (spec=="" || $3==spec) && $5+0>best {best=$5+0} END {print best+0}' "$F"
