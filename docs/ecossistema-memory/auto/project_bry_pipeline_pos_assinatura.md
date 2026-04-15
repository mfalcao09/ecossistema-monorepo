---
name: bry_pipeline_pos_assinatura
description: Pipeline automático pós-assinatura: finalize → auto-carimbo síncrono → verificar pacote → aguardando_envio_registradora
type: project
---

Pipeline completo implementado (sessão 082, commits 613f151 + df83975):

1. Última assinatura (AD-RA eCNPJ) via BRy Signer → `finalize/route.ts`
2. Upload XML assinado para storage (`xml-diplomas/assinado/{id}/`)
3. **Auto-carimbo síncrono** (não fire-and-forget): `aplicarCarimboXmlInterno()` com XML já em memória (sem re-fetch)
4. Se todos XMLs carimbados → `verificarEAvancarPacote()` → `diplomas.status = 'aguardando_envio_registradora'`
5. Frontend `/diploma/assinaturas`: seção "Prontos para Registradora" com botão "Gerar Pacote"
6. `POST /api/diplomas/[id]/pacote-registradora` → ZIP com XMLs assinados + `.p7s` carimbo + PDFs/A + `manifest.json` v1.1

**Por que síncrono:** Vercel serverless corta execução após response → fire-and-forget não é confiável.

**Arquivos-chave:** `src/lib/bry/carimbo-pipeline.ts`, `src/lib/bry/timestamp-service.ts`, `src/app/api/diplomas/[id]/assinar/finalize/route.ts`, `src/app/api/diplomas/[id]/pacote-registradora/route.ts`

**Próximo passo:** Teste e2e completo com Token A3 USB (sessão 083).
