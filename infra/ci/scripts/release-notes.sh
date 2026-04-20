#!/usr/bin/env bash
# release-notes.sh — auto-gera release notes desde a última tag
# Uso: ./release-notes.sh [from_tag]
# Output: markdown com commits agrupados por tipo

set -euo pipefail

FROM_TAG="${1:-$(git describe --tags --abbrev=0 2>/dev/null || echo "")}"

if [ -z "$FROM_TAG" ]; then
  echo "Gerando release notes de todos os commits..."
  LOG=$(git log --oneline --no-merges)
else
  echo "Gerando release notes desde $FROM_TAG..."
  LOG=$(git log "$FROM_TAG..HEAD" --oneline --no-merges)
fi

if [ -z "$LOG" ]; then
  echo "Nenhum commit novo desde $FROM_TAG."
  exit 0
fi

# Função para filtrar por tipo
filter_by_type() {
  local type="$1"
  echo "$LOG" | grep "^[a-f0-9]* ${type}(" || true
}

DATE=$(date +%Y-%m-%d)
BRANCH=$(git rev-parse --abbrev-ref HEAD)

cat <<EOF
# Release Notes — $DATE ($BRANCH)

$(filter_by_type "feat" | wc -l | xargs) novas features · $(filter_by_type "fix" | wc -l | xargs) correções · $(filter_by_type "refactor" | wc -l | xargs) refatorações

## ✨ Features

$(filter_by_type "feat" | sed 's/^[a-f0-9]* feat/- feat/' || echo "_Nenhuma_")

## 🐛 Correções

$(filter_by_type "fix" | sed 's/^[a-f0-9]* fix/- fix/' || echo "_Nenhuma_")

## ♻️ Refatorações

$(filter_by_type "refactor" | sed 's/^[a-f0-9]* refactor/- refactor/' || echo "_Nenhuma_")

## 📚 Documentação

$(filter_by_type "docs" | sed 's/^[a-f0-9]* docs/- docs/' || echo "_Nenhuma_")

## 🏗️ Infraestrutura / Chore

$(filter_by_type "chore" | sed 's/^[a-f0-9]* chore/- chore/' || echo "_Nenhuma_")

---
_Gerado automaticamente por \`infra/ci/scripts/release-notes.sh\`_
EOF
