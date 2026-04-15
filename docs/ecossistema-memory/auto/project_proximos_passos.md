---
name: Próximos passos após Sprints 1-5
description: Módulos pendentes do ERP Diploma Digital — XML engine, assinatura BRy, RVDD, portal diplomado, registradora real
type: project
---

## Módulos implementados (Sprints 1-5)
- Pipeline visual 6 fases / 25 status
- API transição de status com validação
- Geração de PDFs (pdf-lib): Histórico, Termo Expedição, Termo Responsabilidade
- Editor de imagem tipo Adobe Scan (Canvas API)
- Acervo digital (upload, listagem, finalização)
- Pacote ZIP para registradora (archiver)
- Abas interativas: dados, xmls, documentos, acervo, historico

## Módulos pendentes (próximos sprints)
1. **Motor de Geração XML** — gerar os 2 XMLs da FIC (HistoricoEscolar + DocumentacaoAcademica) conforme XSD v1.06
2. **Validação XSD** — validar XMLs gerados contra schemas oficiais do MEC
3. **Integração BRy (Assinatura Digital)** — API OAuth2, assinatura XAdES AD-RA com certificado A3 ICP-Brasil
4. **Gerador de RVDD (PDF visual)** — representação visual do diploma digital
5. **Integração com Registradora** — envio real do pacote para registradora (UFMS ou outra)
6. **Portal do Diplomado** — área pública para consulta e validação de diplomas
7. **Repositório Público (HTTPS)** — armazenamento e acesso público aos XMLs registrados

## Migrations pendentes no banco
- Enum StatusDiploma precisa ser expandido no Supabase (atualmente pode ter menos valores que o código espera)
- Tabela `documentos_digitais` pode precisar ser criada
- Tabela/bucket `acervo-digital` no Supabase Storage

**Why:** Manter visão clara do que falta para completar o sistema.
**How to apply:** Consultar ao planejar próximos sprints.
