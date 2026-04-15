---
name: XSD v1.05: DocumentacaoComprobatoria obrigatória no rito normal
description: XSD v1.05: DocumentacaoComprobatoria obrigatória no rito normal
type: project
project: erp
tags: ["xsd", "comprobatorios", "rito", "cardinalidade"]
success_score: 0.9
supabase_id: 7012d4e5-61ce-4c4d-87b1-05b6eb510b82
created_at: 2026-04-13 09:18:51.793075+00
updated_at: 2026-04-13 15:05:42.46602+00
---

Análise do XSD v1.05. Cardinalidade por rito: Normal (TRegistroReq) minOccurs=1 — OBRIGATÓRIA; NSF minOccurs=0 — Opcional; Segunda via minOccurs=0 — Opcional; Por decisão judicial minOccurs=0 — Opcional. Documento dentro de TDocumentacaoComprobatoria: minOccurs=1, maxOccurs=unbounded, repetição de tipos PERMITIDA. Enum TTipoDocumentacao (9 valores): DocumentoIdentidadeDoAluno, ProvaConclusaoEnsinoMedio, ProvaColacao, ComprovacaoEstagioCurricular, CertidaoNascimento, CertidaoCasamento, TituloEleitor, AtoNaturalizacao, Outros.
