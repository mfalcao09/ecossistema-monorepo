---
name: FIC exige 4 comprobatórios mínimos para criar processo de diploma
description: FIC exige 4 comprobatórios mínimos para criar processo de diploma
type: project
project: erp
tags: ["comprobatorios", "fic", "xsd", "validacao"]
success_score: 0.9
supabase_id: d48cc793-1abc-47cf-a1f3-3d777e55256a
created_at: 2026-04-13 09:18:51.793075+00
updated_at: 2026-04-13 15:05:40.57284+00
---

Regra de negócio FIC (mais estrita que XSD). Mínimo obrigatório: 1) DocumentoIdentidadeDoAluno (RG, sempre), 2) ProvaConclusaoEnsinoMedio (histórico do EM, sempre), 3) CertidaoNascimento OU CertidaoCasamento (pelo menos uma), 4) TituloEleitor (sempre). XSD v1.05 exige apenas minOccurs=1 (qualquer tipo). Implementar lista configurável COMPROBATORIOS_OBRIGATORIOS_FIC (não cravar no código — outras IES podem ter regras diferentes). Validação visual progressiva: checklist com 4 itens, botão Criar processo desabilitado enquanto incompleto.
