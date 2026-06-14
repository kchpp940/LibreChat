#!/usr/bin/env bash
#
# scan-render-boundary.sh — Static boundary check for message content rendering
#
# Ensures that no file outside Content/ imports directly from:
#   - Content/renderer/  (internal renderer layer)
#   - Content/parser/    (internal parser layer)
#
# All external consumers MUST import from Content/render.ts instead.
# This script runs independently of ESLint and can be used in CI pipelines.
#
# Usage:
#   bash scripts/scan-render-boundary.sh [--fix]
#
# Exit codes:
#   0 — no violations found
#   1 — violations found (prints report to stdout)
#

set -euo pipefail

CLIENT_SRC="client/src"
CONTENT_DIR="components/Chat/Messages/Content"

ALLOWED_FILES=(
  "${CONTENT_DIR}/render"
  "${CONTENT_DIR}/Part"
  "${CONTENT_DIR}/ContentParts"
  "${CONTENT_DIR}/Parts/Attachment"
  "${CONTENT_DIR}/renderer/"
  "${CONTENT_DIR}/parser/"
  "hooks/Messages/useParsedMessageContent"
)

FORBIDDEN_PATTERNS=(
  "${CONTENT_DIR}/renderer/"
  "${CONTENT_DIR}/parser/"
)

VIOLATIONS=0

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  while IFS= read -r line; do
    FILE=$(echo "$line" | cut -d: -f1 | sed "s|${CLIENT_SRC}/||")
    LINE_NUM=$(echo "$line" | cut -d: -f2)
    IMPORT_PATH=$(echo "$line" | grep -oE "(from|import\(|require\()['\"]([^'\"]*)['\"]" | head -1 || true)

    IS_ALLOWED=false
    for allowed in "${ALLOWED_FILES[@]}"; do
      if [[ "$FILE" == "${allowed}"* ]] || [[ "$FILE" == "${allowed}" ]]; then
        IS_ALLOWED=true
        break
      fi
    done

    if [[ "$IS_ALLOWED" == "false" ]]; then
      echo "❌ BOUNDARY VIOLATION: ${FILE}:${LINE_NUM}"
      echo "   Imports from internal path: ${pattern}"
      echo "   Use: import { ... } from '~/components/Chat/Messages/Content/render'"
      echo ""
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done < <(grep -rn "from.*['\"].*${pattern}" "${CLIENT_SRC}" --include='*.ts' --include='*.tsx' 2>/dev/null || true)
done

# Also check for direct imports of v1 renderer APIs that were removed
REMOVED_EXPORTS=(
  "RenderContentPart"
  "RenderToolCallContent"
  "RenderAttachment"
  "findContentPartRenderer"
  "findToolCallRenderer"
  "findAttachmentRenderer"
  "contentPartRegistry"
  "toolCallRegistry"
  "attachmentRegistry"
)

for exp in "${REMOVED_EXPORTS[@]}"; do
  while IFS= read -r line; do
    FILE=$(echo "$line" | cut -d: -f1 | sed "s|${CLIENT_SRC}/||")
    LINE_NUM=$(echo "$line" | cut -d: -f2)

    if [[ "$FILE" != "${CONTENT_DIR}/renderer/"* ]]; then
      echo "❌ REMOVED EXPORT USAGE: ${FILE}:${LINE_NUM}"
      echo "   Uses removed v1 API: ${exp}"
      echo "   Use: import { RenderStandardItem } from '~/components/Chat/Messages/Content/render'"
      echo ""
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done < <(grep -rn "import.*${exp}" "${CLIENT_SRC}" --include='*.ts' --include='*.tsx' 2>/dev/null || true)
done

if [[ $VIOLATIONS -gt 0 ]]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Found ${VIOLATIONS} boundary violation(s)."
  echo "All message content rendering must go through Content/render.ts"
  echo "See: client/src/components/Chat/Messages/Content/render.ts"
  exit 1
fi

echo "✅ No render boundary violations found."
exit 0
