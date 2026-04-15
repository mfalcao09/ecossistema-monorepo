---
name: Decisão arquitetural — API Diploma Digital (Initialize/Finalize) + BRy Signer Desktop para Token A3 USB
description: Decisão arquitetural — API Diploma Digital (Initialize/Finalize) + BRy Signer Desktop para Token A3 USB
type: project
project: erp
tags: ["bry", "assinatura", "token-a3", "decisão-arquitetural", "hub-signer"]
success_score: 0.92
supabase_id: 45575494-32a6-482d-a43f-e17f64b60fba
created_at: 2026-04-14 09:13:32.660338+00
updated_at: 2026-04-14 10:07:23.506623+00
---

Decisão em 11/04/2026 (sessão 059):

**Cenário:** FIC usa certificado ICP-Brasil A3 em Token USB físico. A chave privada NUNCA sai do dispositivo.

**API escolhida: API de Diploma Digital (HUB Signer) — Initialize/Finalize**
- NÃO usa Easy Signer (produto separado, baseado em envelopes)
- NÃO usa KMS/Nuvem (certificado não está em cloud)
- Usa o fluxo padrão de 3 etapas da API de Diploma Digital

**Endpoints reais:**
- Token: `POST https://cloud-hom.bry.com.br/token-service/jwt` (client_credentials, form-urlencoded)
- Initialize: `POST https://diploma.hom.bry.com.br/api/xml-signature-service/v2/signatures/initialize` (multipart/form-data)
- Finalize: `POST https://diploma.hom.bry.com.br/api/xml-signature-service/v2/signatures/finalize` (multipart/form-data)
- Verify: `POST https://diploma.hom.bry.com.br/api/xml-verification-service/v1/signatures/verify`
