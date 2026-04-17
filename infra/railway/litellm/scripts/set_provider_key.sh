#!/usr/bin/env bash
# Helper seguro para setar uma chave de provider no service litellm.
#
# Uso:
#   1. Copia a chave no browser (Cmd+C)
#   2. Roda:  ./scripts/set_provider_key.sh anthropic
#      (ou: openai, gemini, maritaca)
#
# O script LÊ o clipboard, VALIDA o prefixo, mostra info redactada,
# e só salva depois que você confirmar "y".

set -euo pipefail

PROVIDER="${1:-}"
if [[ -z "$PROVIDER" ]]; then
  echo "uso: $0 {anthropic|openai|gemini|maritaca}"
  exit 1
fi

# Mapa: provider → nome da env var no Railway + regex de validação do prefixo
case "$PROVIDER" in
  anthropic)  VAR="ANTHROPIC_API_KEY";  PREFIX_RE='^sk-ant-'  ;;
  openai)     VAR="OPENAI_API_KEY";     PREFIX_RE='^sk-'      ;;
  gemini)     VAR="GEMINI_API_KEY";     PREFIX_RE='^AIza'     ;;
  maritaca)   VAR="MARITACA_API_KEY";   PREFIX_RE='^[0-9]'    ;;
  openrouter) VAR="OPENROUTER_API_KEY"; PREFIX_RE='^sk-or-v1-';;
  *) echo "provider desconhecido: $PROVIDER"; exit 1 ;;
esac

# Lê clipboard e remove TODO whitespace
VAL=$(pbpaste | tr -d '[:space:]')

if [[ -z "$VAL" ]]; then
  echo "❌ clipboard vazio — nada pra colar. Copia a chave no browser primeiro (Cmd+C)."
  exit 1
fi

# Info sem expor o valor
LEN=${#VAL}
PREFIX_SHOW="${VAL:0:10}"
SUFFIX_SHOW="${VAL: -4}"

echo "Preparando para setar $VAR"
echo "  clipboard   tamanho=$LEN  prefix=${PREFIX_SHOW}…  suffix=…${SUFFIX_SHOW}"

# Valida prefixo
if ! [[ "$VAL" =~ $PREFIX_RE ]]; then
  echo "❌ prefixo não bate com $PROVIDER (esperado regex: $PREFIX_RE)"
  echo "   o que está no seu clipboard NÃO parece ser a chave certa."
  echo "   provável causa: você copiou outra coisa (ex.: o próprio comando do terminal)."
  echo "   ação: vá no browser, copie a chave certa, rode de novo."
  exit 1
fi

# Pede confirmação
echo
read -r -p "Salvar no Railway? [y/N] " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "cancelado — nada foi salvo"
  exit 0
fi

# Salva via stdin para nunca aparecer em logs
printf '%s' "$VAL" | railway variables --service litellm --set-from-stdin "$VAR" --skip-deploys
echo "✅ $VAR salvo no Railway (service litellm)"
