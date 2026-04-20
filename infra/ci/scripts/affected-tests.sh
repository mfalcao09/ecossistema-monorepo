#!/usr/bin/env bash
# affected-tests.sh — roda apenas testes dos packages afetados
# Uso: ./affected-tests.sh [base_ref]
# Requer: pnpm + turbo instalados

set -euo pipefail

BASE_REF="${1:-HEAD^1}"

echo "🔍 Detectando packages afetados desde $BASE_REF..."

# Detectar packages com mudanças
CHANGED=$(git diff --name-only "$BASE_REF" HEAD 2>/dev/null \
  | grep '^packages/' \
  | awk -F'/' '{print $2}' \
  | sort -u)

if [ -z "$CHANGED" ]; then
  echo "ℹ️  Nenhum package TS modificado — pulando testes."
  exit 0
fi

echo "📦 Packages afetados:"
echo "$CHANGED" | while read -r pkg; do echo "   • $pkg"; done

# Montar filtros turbo
FILTERS=""
while IFS= read -r pkg; do
  FILTERS="$FILTERS --filter=@ecossistema/$pkg..."
done <<< "$CHANGED"

echo ""
echo "🧪 Rodando testes: pnpm turbo test $FILTERS"
pnpm turbo test $FILTERS
