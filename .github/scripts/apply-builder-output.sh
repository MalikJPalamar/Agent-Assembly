#!/usr/bin/env bash
# Usage: apply-builder-output.sh <model-output.json> <target-dir> <summary-out-file>
# Parses the Builder's strict JSON {"files":[{path,content}],"summary"} and writes
# the files under <target-dir>. Fails loudly on invalid JSON or unsafe paths.
set -euo pipefail
IN="$1"; TARGET="$2"; SUMMARY_OUT="$3"

if ! jq -e . "$IN" >/dev/null 2>&1; then
  echo "::error::Builder response is not valid JSON"
  echo "--- first 60 lines of model output ---"; head -60 "$IN"; echo
  exit 1
fi
if ! jq -e '(.files|type=="array") and (.files|length>0) and (.summary|type=="string")' "$IN" >/dev/null; then
  echo "::error::Builder JSON missing non-empty 'files' array or 'summary' string"
  jq -c 'del(.files[]?.content)' "$IN" || true
  exit 1
fi
if ! jq -e 'all(.files[]; (.path|type=="string") and (.content|type=="string"))' "$IN" >/dev/null; then
  echo "::error::Every file needs string 'path' and 'content'"
  exit 1
fi

COUNT=0
while IFS= read -r row; do
  path=$(printf '%s' "$row" | base64 -d | jq -r '.path')
  case "$path" in
    ""|/*|.github/*|*/.github/*) echo "::error::Rejected unsafe path: '$path'"; exit 1 ;;
  esac
  case "/$path/" in
    *"/../"*) echo "::error::Rejected path traversal: '$path'"; exit 1 ;;
  esac
  mkdir -p "$TARGET/$(dirname "$path")"
  printf '%s' "$row" | base64 -d | jq -r '.content' > "$TARGET/$path"
  echo "wrote $TARGET/$path ($(wc -c < "$TARGET/$path") bytes)"
  COUNT=$((COUNT+1))
done < <(jq -r '.files[] | @base64' "$IN")

jq -r '.summary' "$IN" > "$SUMMARY_OUT"
echo "Applied $COUNT file(s). Summary: $(cat "$SUMMARY_OUT")"
