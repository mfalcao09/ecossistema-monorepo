#!/usr/bin/env bash
# detect-changes.sh — detecta quais packages/services mudaram no PR
# Uso: ./detect-changes.sh [base_ref]
# Output: JSON com listas de packages, edge-functions e railway services afetados

set -euo pipefail

BASE_REF="${1:-HEAD^1}"
CHANGED_FILES=$(git diff --name-only "$BASE_REF" HEAD 2>/dev/null || git diff --name-only HEAD)

# Arrays de resultados
PACKAGES=()
EDGE_FUNCTIONS=()
RAILWAY_SERVICES=()

while IFS= read -r file; do
  # Packages TS
  if [[ "$file" =~ ^packages/([^/]+)/ ]]; then
    pkg="${BASH_REMATCH[1]}"
    [[ " ${PACKAGES[*]:-} " != *" $pkg "* ]] && PACKAGES+=("$pkg")
  fi

  # Edge Functions
  if [[ "$file" =~ ^infra/supabase/functions/([^/]+)/ ]]; then
    fn="${BASH_REMATCH[1]}"
    [[ " ${EDGE_FUNCTIONS[*]:-} " != *" $fn "* ]] && EDGE_FUNCTIONS+=("$fn")
  fi

  # Railway services
  [[ "$file" =~ ^apps/orchestrator/ ]] && [[ " ${RAILWAY_SERVICES[*]:-} " != *" orchestrator "* ]] && RAILWAY_SERVICES+=("orchestrator")
  [[ "$file" =~ ^apps/memory-consolidator/ ]] && [[ " ${RAILWAY_SERVICES[*]:-} " != *" memory-consolidator "* ]] && RAILWAY_SERVICES+=("memory-consolidator")
  [[ "$file" =~ ^infra/railway/litellm/ ]] && [[ " ${RAILWAY_SERVICES[*]:-} " != *" litellm "* ]] && RAILWAY_SERVICES+=("litellm")
  [[ "$file" =~ ^infra/railway/langfuse/ ]] && [[ " ${RAILWAY_SERVICES[*]:-} " != *" langfuse "* ]] && RAILWAY_SERVICES+=("langfuse")
done <<< "$CHANGED_FILES"

# Output JSON
printf '{\n'
printf '  "packages": [%s],\n' "$(IFS=,; echo "${PACKAGES[*]:-}" | sed 's/[^,]*/\"&\"/g')"
printf '  "edge_functions": [%s],\n' "$(IFS=,; echo "${EDGE_FUNCTIONS[*]:-}" | sed 's/[^,]*/\"&\"/g')"
printf '  "railway_services": [%s]\n' "$(IFS=,; echo "${RAILWAY_SERVICES[*]:-}" | sed 's/[^,]*/\"&\"/g')"
printf '}\n'
