---
name: Decisões arquiteturais Bloco 3 — assinatura BRy (08/04/2026)
description: Decisões arquiteturais Bloco 3 — assinatura BRy (08/04/2026)
type: project
project: erp
tags: ["bry", "assinatura", "decisão-arquitetural", "token-a3", "bloco3"]
success_score: 0.88
supabase_id: f016cd16-45d3-4cfe-a14b-a840491321eb
created_at: 2026-04-14 09:13:32.660338+00
updated_at: 2026-04-14 10:07:22.611649+00
---

Decisões finais de Marcelo (08/04/2026) fechando arquitetura da assinatura BRy:

**D2 — Caminho de chave privada: NAVEGADOR + EXTENSÃO BRy Signer**
- NÃO é KMS em nuvem
- NÃO é PKCS#12 em arquivo
- É opção C: assinatura híbrida. Servidor orquestra initialize + finalize; ETAPA 2 (cifrar signedAttributes com chave privada) acontece no browser do signatário via extensão BRy.
- Implica: token A3 físico conectado na máquina do signatário + extensão instalada no browser + tela "Assinar" no ERP

**D3 — Certificados (ambiente homologação):**
- e-CPF Aleciana (Diretora Acadêmica) — token físico dela
- e-CPF Marcelo (Diretor Presidente) — token físico dele
- e-CNPJ FIC — custodiante físico é o próprio Marcelo

**D4 — Priorização: Sprint 2 completa com extração Railway**
