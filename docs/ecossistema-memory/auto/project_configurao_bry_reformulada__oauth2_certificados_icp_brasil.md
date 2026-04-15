---
name: Configuração BRy reformulada — OAuth2, certificados ICP-Brasil
description: Configuração BRy reformulada — OAuth2, certificados ICP-Brasil
type: project
project: erp
tags: ["bry", "oauth2", "icpbrasil", "assinatura"]
success_score: 0.9
supabase_id: 99a905c1-8409-478f-b0e5-ef180c8be3ce
created_at: 2026-04-13 09:18:05.848052+00
updated_at: 2026-04-13 15:05:35.074107+00
---

Reformulação completa em commit ef136cc (27/03/2026). Bloco 1: Credenciais OAuth2 — bry_client_id + bry_client_secret_enc, fluxo POST /token-service/jwt com grant_type=client_credentials. Bloco 2: Certificado Digital ICP-Brasil — tipo hsm_cloud/pkcs12/manual. Bloco 3: Endpoints auto-preenchidos — Token: https://cloud.bry.com.br/token-service/jwt (prod). XML Signature: https://diploma.bry.com.br/api/xml-signature-service/v2/signatures. Homologação: *.hom.bry.com.br. HTTP 400 do verify = sucesso (token válido, payload vazio esperado).
