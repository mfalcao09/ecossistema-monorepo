---
name: XSD Documento Comprobatório é estrutura FLAT
description: <Documento> do XSD v1.05 só tem 2 atributos (tipo, observacoes) + base64; subelementos numero/orgao/uf/data NÃO existem no XML
type: project
---

O elemento `<Documento>` dentro de `<DocumentacaoComprobatoria>` no XSD v1.05 tem estrutura FLAT — só 2 atributos e o conteúdo:

```xml
<Documento tipo="DocumentoIdentidadeDoAluno" observacoes="...">{base64_pdfa}</Documento>
```

- `tipo` (required): atributo do enum TTipoDocumentacao (9 valores, ver project_xsd_versao_105)
- `observacoes` (optional): atributo TString
- conteúdo: TPdfA = xs:base64Binary puro (PDF/A do documento)

**NÃO existem** subelementos `<NumeroDocumento>`, `<OrgaoEmissor>`, `<UfEmissor>`, `<DataExpedicao>`.

**Why:** descobri lendo `leiautedocumentacaoacademicaregistrodiplomadigital_v1-05.xsd` (linhas 228-244) e `tiposbasicos_v1-05.xsd` (TPdfA na linha 158).

**How to apply:** os campos `numero_documento`, `orgao_emissor`, `uf_emissor`, `data_expedicao` na tabela `diploma_documentos_comprobatorios` ficam como **metadata interna do ERP** (rastreabilidade/auditoria/exibição no painel admin) mas NÃO são serializados no XML. O gerador XML deve usar apenas `tipo_xsd`, `observacao` (vira atributo `observacoes`) e o `pdfa.base64`.

A interface `DocumentoComprobatorioParaXml` em `converter-service.ts` reflete isso explicitamente: campos `tipo_xsd`/`observacao`/`pdfa` separados de `metadata_interna`.
