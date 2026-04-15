---
name: Processo real de emissão de diploma - mapeamento via áudios
description: 16 etapas do processo real de diploma digital da FIC conforme secretária acadêmica (26/03/2026), gaps críticos e prioridades
type: project
---

Mapeamento completo do processo real de emissão de diploma digital da FIC, obtido via 4 áudios da secretária acadêmica em 26/03/2026.

**Why:** Sem entender o processo real, o sistema pode ficar incompleto e inutilizável. A secretária revelou etapas que não estavam contempladas no sistema.

**How to apply:** Usar como referência para todas as decisões de implementação do módulo Diploma Digital. Documento completo salvo em `docs/MAPEAMENTO-PROCESSO-DIPLOMA-FIC.docx`.

## Gaps críticos identificados (P1-P4 ALTA):
1. **PDF/A + compressão 1MB** — UFMS rejeita arquivos fora do padrão. Bloqueador total.
2. **Ofício + comprovantes de pagamento** — Sem isso, UFMS nem abre o processo.
3. **Assinatura digital em cascata** — Diretora pedagógica → Representante legal → XML. Ordem fixa obrigatória.
4. **Fluxo ida-e-volta com registradora** — Correções são frequentes. Precisa de status "devolvido", log de motivos, edição e reenvio.

## Gaps médios (P5-P8):
5. Validação cruzada de nomes (casamento)
6. Cadastro de corpo docente (obrigatório para histórico digital)
7. Geração automática de Termos de Expedição e Registro
8. Importação do XML registrado de volta da UFMS

## Informação chave: sistema anterior era Diplomax (Debarri)
- Tudo era digitado manualmente
- Dados duplicados entre alunos da mesma turma
- Sem corpo docente cadastrado
- Nosso sistema já resolve o maior gargalo (IA faz extração automática)
