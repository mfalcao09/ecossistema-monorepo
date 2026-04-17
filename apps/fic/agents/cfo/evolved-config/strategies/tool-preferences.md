# Tool Preferences — CFO FIC

## Para lookups financeiros FIC
- SQL direto em `ifdnjieklngcfodmtied` via supabase-mcp
- Tabelas: `fic_boletos`, `fic_pagamentos`, `fic_inadimplentes`

## Para cobranças
- Banco Inter via `credential-mcp` → SC-29 `INTER_CLIENT_ID`
- Idempotência: sempre verificar `fic_boletos` antes de emitir

## Para comunicação com alunos
- WhatsApp via Evolution API (Fase 1)
- Email como fallback

## Para comunicação com Marcelo
- Alertas urgentes: WhatsApp (máx 3 linhas)
- Relatórios: Jarvis CLI com tabela markdown
