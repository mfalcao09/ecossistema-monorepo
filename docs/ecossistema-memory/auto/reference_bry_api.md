---
name: BRy API Documentation Reference
description: Documentação completa da API BRy de assinatura digital para Diploma Digital — endpoints, autenticação, parâmetros e fluxo
type: reference
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
- Suporta lote de até 10 documentos, máx 100MB

**Endpoints XML principais:**
- POST /api/xml-signature-service/v2/signatures/initialize
- POST /api/xml-signature-service/v2/signatures/finalize
- POST /api/xml-signature-service/v1/signatures/kms (certificado em nuvem)
- POST /xml/v1/upgrade/extra-archive-timestamp (carimbo extra)
- POST /api/xml-verification-service/v1/signatures/verify (verificação)

**GitLab exemplos:** https://gitlab.com/brytecnologia-team/integracao/api-autenticacao
