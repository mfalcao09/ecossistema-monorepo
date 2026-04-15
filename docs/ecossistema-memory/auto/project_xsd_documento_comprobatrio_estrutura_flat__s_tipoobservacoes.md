---
name: XSD Documento Comprobatório: estrutura FLAT — só tipo+observacoes+base64
description: XSD Documento Comprobatório: estrutura FLAT — só tipo+observacoes+base64
type: project
project: erp
tags: ["xsd", "documento-comprobatorio", "flat", "xml"]
success_score: 0.9
supabase_id: ef04d47d-cbb0-4f72-8e38-17dbf66533ec
created_at: 2026-04-13 09:18:05.848052+00
updated_at: 2026-04-13 15:05:36.02206+00
---

O elemento <Documento> dentro de <DocumentacaoComprobatoria> no XSD v1.05 é FLAT: só atributos tipo (enum TTipoDocumentacao 9 valores) e observacoes (opcional) + conteúdo base64Binary. NÃO existem subelementos NumeroDocumento, OrgaoEmissor, UfEmissor, DataExpedicao. Campos de numero_documento, orgao_emissor etc. ficam como metadata interna do ERP (auditoria/exibição no painel admin) mas NÃO são serializados no XML. O gerador XML usa apenas tipo_xsd, observacao e pdfa.base64.
