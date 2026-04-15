---
name: BRy Finalize pode retornar sucesso sem XML assinado
description: BRy Finalize pode retornar sucesso sem XML assinado
type: feedback
project: erp
tags: ["bry", "assinatura", "bug", "xml-diplomas", "bucket", "fix"]
success_score: 0.88
supabase_id: 9470d133-68bb-46f8-882d-cd410567e451
created_at: 2026-04-15 00:44:24.911009+00
updated_at: 2026-04-15 00:44:24.911009+00
---

BRy Finalize retornou sucesso para o diploma da Kauana mas sem XML assinado (nem inline nem via downloadUrl). Neste caso, xml_gerados.status fica como validado e arquivo_url fica null. Solução aplicada: usar conteudo_xml (XML original não assinado) como substituto temporário. Bucket xml-diplomas NÃO existia — precisou ser criado via SQL INSERT em storage.buckets. Por: em produção, o bucket deve ser criado nas migrations, não presumir existência.
