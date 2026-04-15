---
name: Fluxo aprovado de criação de processo de diploma (07/04/2026)
description: Decisões sobre o novo fluxo de criação de processo no ERP FIC — drag-and-drop → extração → revisão pós-extração com gate de comprobatórios → criar processo
type: project
---

Fluxo aprovado por Marcelo em 07/04/2026 (sessão 023) para criação de novo processo de diploma:

**Tela 1 — "Novo Processo" (drag-and-drop)**
- Secretária abre tela e joga N arquivos no drag-and-drop (RG, histórico, certidão, etc.).
- Botão "Extrair dados" envia para pipeline de extração IA.

**Tela 2 — "Revisão pós-extração" (gate de comprobatórios)**
- Mostra formulário pré-preenchido com dados extraídos pela IA.
- Lista TODOS os arquivos enviados, com:
  - Checkbox "É comprobatório?" (se desmarcado, vira arquivo auxiliar)
  - Dropdown "Tipo XSD" (9 valores enum TTipoDocumentacao) — com **pré-sugestão IA** baseada na extração
  - Campo observações (livre)
- Dois botões:
  - "Salvar rascunho" → livre, salva tudo (arquivos + dados extraídos + seleção parcial), permite continuar de onde parou
  - "Criar processo" → BLOQUEADO até: (a) seleção de comprobatórios completa, (b) campos obrigatórios do XSD validados

**Tela 3 — Processo criado (accordion 12 seções)**
- Adicionar 12ª seção "Arquivos do Processo" no accordion existente, onde a secretária pode reclassificar/adicionar arquivos a qualquer momento.
- Mesma interface da Tela 2 (classificação + tipo XSD + observação).

**Why:** Contexto fresco (operador acabou de subir os arquivos), qualidade na origem (processo nasce com comprobatórios definidos), aproveita upload já feito (sem duplicação). Marcelo descartou as opções de modal no fim do pipeline (3A) e modal no salvar (3B) porque o momento mais natural é logo após a extração.

**How to apply:** Quando implementar a criação de processo, seguir esta arquitetura. Não criar wizard multi-rota — manter SPA com transição de telas. Validação visual progressiva (não bloquear silencioso).
