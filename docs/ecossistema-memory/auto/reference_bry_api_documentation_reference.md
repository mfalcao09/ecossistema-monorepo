---
name: BRy API Documentation Reference
description: BRy API Documentation Reference
type: reference
project: erp
tags: ["bry", "api", "assinatura", "endpoints", "documentação"]
success_score: 0.9
supabase_id: 18f29e10-b7ea-43d6-a578-a764fb7744b0
created_at: 2026-04-14 09:15:14.333791+00
updated_at: 2026-04-14 11:07:33.018494+00
---

A documentação completa da API BRy de assinatura digital foi extraída e consolidada em:
`docs/bry-api-referencia-tecnica.md` no repositório ERP-Educacional.

**Ambientes:**
- Homologação: https://diploma.hom.bry.com.br/api/xml-signature-service/v2/signatures/
- Produção: https://diploma.bry.com.br/api/xml-signature-service/v2/signatures/
- Token: POST https://cloud-hom.bry.com.br/token-service/jwt (grant_type=client_credentials)
- Swagger: https://hub2.hom.bry.com.br/swagger-ui/index.html

**Conta Nexvy:** Já cadastrada no BRy Cloud Homologação (NEXVY TECNOLOGIA E COMUNICACAO LTDA)

**Fluxo de assinatura:** 3 etapas (initialize → assinar com chave privada → finalize)
- Diploma Digital usa XAdES ENVELOPED, SHA256
- Profiles: ADRT (maioria) e ADRA (envelope/final)
