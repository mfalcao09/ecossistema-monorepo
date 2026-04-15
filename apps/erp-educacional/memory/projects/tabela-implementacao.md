# Tabela de Implementação — Diploma Digital FIC

**Versão:** 1.0
**Data:** 2026-03-20
**Base:** fluxo-ia-native.md v1.4 + STACK-E-BANCO.md + estado atual do código

---

## Legenda de Status

| Símbolo | Significado |
|---------|-------------|
| ✅ | Concluído — existe no código |
| 🔄 | Parcial — iniciado mas incompleto |
| ⏳ | Pendente — planejado, não iniciado |
| 🔴 | Bloqueador — decisão pendente antes de iniciar |

---

## Estado Atual do Sistema (20/03/2026)

O que já existe no código:

| Componente | Status | Detalhe |
|------------|--------|---------|
| Projeto Next.js 14 + TypeScript + Tailwind | ✅ | Configurado, rodando, deploy na Vercel |
| Layout ERP com Sidebar + TopBar | ✅ | `src/components/layout/` |
| Route group `(erp)` | ✅ | Layout compartilhado para todas as telas do ERP |
| Tela Cadastro → IES | ✅ | `(erp)/cadastro/ies/page.tsx` |
| Tela Cadastro → Departamentos | ✅ | `(erp)/cadastro/departamentos/page.tsx` |
| Tela Diploma → Dashboard | ✅ | `(erp)/diploma/page.tsx` |
| Tela Diploma → Diplomados | ✅ | `(erp)/diploma/diplomados/page.tsx` |
| Tela Diploma → Diplomas (lista) | ✅ | `(erp)/diploma/diplomas/page.tsx` |
| Tela Diploma → Cursos | ✅ | `(erp)/diploma/cursos/page.tsx` |
| Tela Diploma → Assinantes | ✅ | `(erp)/diploma/assinantes/page.tsx` |
| API CRUD Instituições | ✅ | `api/instituicoes/route.ts` + `[id]/route.ts` |
| API CRUD Departamentos | ✅ | `api/departamentos/route.ts` + `[id]/route.ts` |
| API CRUD Diplomados | ✅ | `api/diplomados/route.ts` + `[id]/route.ts` |
| API CRUD Cursos | ✅ | `api/cursos/route.ts` |
| API Consulta CNPJ externo | ✅ | `api/cnpj/[cnpj]/route.ts` |
| API Consulta Código MEC | ✅ | `api/mec/[codigo]/route.ts` |
| API Consulta E-MEC | ✅ | `api/emec/route.ts` |
| API Processar Documento (OCR) | 🔄 | `api/processar-documento/route.ts` (estrutura criada) |
| Componente AIAssistant (Chat) | 🔄 | `components/ai/AIAssistant.tsx` (criado, integração pendente) |
| SmartCNPJInput | ✅ | `components/ai/SmartCNPJInput.tsx` |
| SmartCPFInput | ✅ | `components/ai/SmartCPFInput.tsx` |
| SmartCodigoMECInput | ✅ | `components/ai/SmartCodigoMECInput.tsx` |
| SmartEMECInput | ✅ | `components/ai/SmartEMECInput.tsx` |
| SmartUploadCredenciamento | ✅ | `components/ai/SmartUploadCredenciamento.tsx` |
| Supabase client/server configurado | ✅ | `lib/supabase/client.ts` + `server.ts` |
| Modelagem completa do banco (SQL) | ✅ | Documentada em STACK-E-BANCO.md (15 tabelas) |
| Modelagem aplicada no Supabase | 🔴 | Pendente — migration não executada ainda |

---

## Fase 0 — Fundação e Infraestrutura

**Objetivo:** Garantir que a base técnica está sólida antes de construir funcionalidades.
**Estimativa:** 1 semana

| # | Entregável | Status | Tipo | Observação |
|---|-----------|--------|------|------------|
| 0.1 | Migration do banco no Supabase (15 tabelas) | 🔴 | Banco | Executar SQL do STACK-E-BANCO.md no Supabase |
| 0.2 | RLS (Row Level Security) configurado para todas as tabelas | ⏳ | Banco/Segurança | Obrigatório antes de qualquer dado real |
| 0.3 | Supabase Auth configurado (login admin) | ⏳ | Auth | Email/senha para secretaria acadêmica |
| 0.4 | Variáveis de ambiente validadas em produção (Vercel) | 🔄 | Deploy | `.env.local` existe; Vercel precisa ser atualizado |
| 0.5 | Microserviço DocumentConverter (Docker + Ghostscript + veraPDF) | 🔴 | Infra | **Bloqueador da Fase 1** — conversão para PDF/A |
| 0.6 | Deploy do microserviço DocumentConverter (Fly.io ou Railway) | 🔴 | Infra | Depende do 0.5 |
| 0.7 | Decisão e contratação da API de assinatura digital (BRy / Certisign / Soluti) | 🔴 | Negócio | **Bloqueador da Fase 3** — prazo MEC urgente |
| 0.8 | Definição da IES Registradora para a FIC | 🔴 | Negócio | Necessário para configurar transmissão |
| 0.9 | Download e validação do XSD v1.06 oficial do MEC | ⏳ | Regulatório | Base para o motor XML |

---

## Fase 1 — Cadastro e Coleta de Dados (Wizard IA Native)

**Objetivo:** O secretário consegue cadastrar um diplomado completo com a IA guiando cada passo.
**Estimativa:** 2 semanas
**Corresponde a:** Fase 1 do macroprocesso, Etapas 1–3

| # | Entregável | Status | Tipo | Observação |
|---|-----------|--------|------|------------|
| 1.1 | Tela de cadastro de IES (formulário completo com SmartInputs) | 🔄 | Frontend | Tela existe; validação e persistência no Supabase pendentes |
| 1.2 | Tela de cadastro de Cursos (formulário completo) | 🔄 | Frontend | Tela existe; formulário completo pendente |
| 1.3 | Tela de cadastro de Assinantes (Reitor, Secretário, etc.) | 🔄 | Frontend | Tela existe; formulário pendente |
| 1.4 | **Etapa 1 — Auditoria Acadêmica automática** | ⏳ | Backend + Frontend | Checklist: pendências biblioteca, financeiro, colação |
| 1.5 | **Etapa 2 — Wizard de cadastro do diplomado** | ⏳ | Frontend | Upload RG/CNH + extração via OCR + confirmação |
| 1.6 | Integração DocumentReader (OCR/Vision API) | 🔄 | Backend | `api/processar-documento` criado; integração Vision API pendente |
| 1.7 | Extração de dados do RG/CNH via Vision API | ⏳ | IA | Nome, RG, nascimento, filiação, naturalidade |
| 1.8 | **Etapa 3 — Upload e extração do histórico escolar** | ⏳ | Frontend + IA | PDF/Excel → extração de disciplinas, notas, CH |
| 1.9 | Parser de histórico escolar (PDF/Excel) | ⏳ | Backend | `pdf-parse` + `xlsx` para extrair dados do histórico |
| 1.10 | Extração de dados da ata de colação | ⏳ | IA | Data da colação, nome do formando via OCR |
| 1.11 | Conversão automática de documentos para PDF/A | ⏳ | Backend | Chamar microserviço DocumentConverter (0.5/0.6) |
| 1.12 | Codificação Base64 dos documentos PDF/A | ⏳ | Backend | Documentos prontos para embutir no XML |
| 1.13 | **Etapa 4 — Revisão e validação inteligente** | ⏳ | Frontend + IA | Painel de resumo + checklist de validações MEC |
| 1.14 | DataValidator: validações técnicas obrigatórias (MEC) | ⏳ | Backend | Datas, CH mínima, CPF, nome, etc. |
| 1.15 | DataValidator: validações inteligentes via LLM | ⏳ | IA | Capitalização, naturalidade, disciplinas abreviadas |
| 1.16 | AIAssistant integrado no wizard (Etapas 2, 3, 4) | 🔄 | IA | Componente criado; contexto e integração pendentes |
| 1.17 | Persistência de todos os dados no Supabase | ⏳ | Banco | `diplomas`, `diploma_disciplinas`, `filiacoes`, `documentos` |
| 1.18 | Tela de lista de diplomas com pipeline visual | 🔄 | Frontend | Tela existe; status pipeline pendente |

---

## Fase 2 — Motor XML

**Objetivo:** Geração e validação dos 3 XMLs obrigatórios conforme XSD v1.06.
**Estimativa:** 2 semanas
**Corresponde a:** Fase 1 do macroprocesso, Etapa 5

| # | Entregável | Status | Tipo | Observação |
|---|-----------|--------|------|------------|
| 2.1 | Instalação e configuração de `xmlbuilder2` | ⏳ | Backend | Biblioteca XML para Node.js |
| 2.2 | Instalação e configuração de `libxmljs2` ou `xsd-schema-validator` | ⏳ | Backend | Validação XSD |
| 2.3 | Gerador XML 1: `DocumentacaoAcademicaRegistro` | ⏳ | Backend | Com documentos PDF/A embutidos em Base64 |
| 2.4 | Gerador XML 2: `HistoricoEscolarDigital` | ⏳ | Backend | Disciplinas, notas, CH conforme XSD |
| 2.5 | Gerador XML 3: `DiplomaDigital` | ⏳ | Backend | Dados públicos do diploma |
| 2.6 | Validador XSD automático (v1.06) | ⏳ | Backend | Valida cada XML gerado antes de avançar |
| 2.7 | API de geração XML (`/api/diplomas/[id]/gerar-xml`) | ⏳ | Backend | Endpoint que orquestra os 3 geradores |
| 2.8 | Armazenamento dos XMLs no Supabase Storage | ⏳ | Backend | XMLs salvos com URL atualizada no banco |
| 2.9 | Feedback da IA durante a geração (mensagens em tempo real) | ⏳ | Frontend | Status de cada XML gerado + erro em linguagem natural |
| 2.10 | Testes com schemas XSD oficiais do MEC | ⏳ | QA | Validação cruzada com portal do MEC |

---

## Fase 3 — Assinatura Digital e Transmissão

**Objetivo:** Assinar os XMLs com certificados ICP-Brasil A3 e transmitir para a registradora.
**Estimativa:** 2 semanas
**Corresponde a:** Fase 1 do macroprocesso, Etapas 6–7
**Bloqueador:** Decisão e contratação da API de assinatura (0.7)

| # | Entregável | Status | Tipo | Observação |
|---|-----------|--------|------|------------|
| 3.1 | Integração com API de assinatura escolhida (BRy / Certisign / Soluti) | 🔴 | Backend | Depende da contratação (0.7) |
| 3.2 | Orquestração da 1ª assinatura: Reitor (e-CPF A3) | ⏳ | Backend | Assina o nó `DadosDiploma` |
| 3.3 | Orquestração da 2ª assinatura: IES Emissora (e-CNPJ) | ⏳ | Backend | Assina o nó `DadosDiploma` |
| 3.4 | Orquestração da 3ª assinatura: IES AD-RA (e-CNPJ) | ⏳ | Backend | Assina o nó raiz `DocumentacaoAcademicaRegistro` |
| 3.5 | Carimbo de tempo TSA após assinaturas | ⏳ | Backend | TSA credenciada ICP-Brasil |
| 3.6 | Notificação por e-mail aos signatários (Resend/SendGrid) | ⏳ | Backend | Link de assinatura remota |
| 3.7 | Tela de acompanhamento de assinaturas (status em tempo real) | ⏳ | Frontend | Status: pendente / assinado / rejeitado por signatário |
| 3.8 | Transmissão do pacote para a IES Registradora | ⏳ | Backend | Envio dos 3 XMLs assinados + carimbo |
| 3.9 | Acompanhamento do retorno da registradora (polling/webhook) | ⏳ | Backend | Notificação quando XML registrado retornar |
| 3.10 | Recepção e armazenamento do XML registrado e assinado | ⏳ | Backend | XML final da registradora salvo no Supabase Storage |
| 3.11 | Atualização do status do diploma para `registrado` | ⏳ | Backend | Pipeline atualizado no banco |

---

## Fase 4 — Geração da RVDD e Entrega ao Diplomado

**Objetivo:** Gerar o PDF visual do diploma e entregar os dois arquivos ao diplomado.
**Estimativa:** 1–2 semanas
**Corresponde a:** Fase 3 do macroprocesso, Etapas 8–9

| # | Entregável | Status | Tipo | Observação |
|---|-----------|--------|------|------------|
| 4.1 | Design do layout visual da RVDD (anverso + verso) | 🔴 | Design | Decisão pendente com a FIC |
| 4.2 | Template HTML/CSS do diploma da FIC (anverso) | ⏳ | Frontend | Layout oficial com todos os campos do diploma |
| 4.3 | Template HTML/CSS verso: QR Code + URL + código alfanumérico | ⏳ | Frontend | Geração de QR Code via `qrcode` npm |
| 4.4 | Geração de PDF via Puppeteer (server-side, Node.js) | ⏳ | Backend | Render do HTML → PDF (mín. 300 DPI) |
| 4.5 | API de geração da RVDD (`/api/diplomas/[id]/gerar-rvdd`) | ⏳ | Backend | Endpoint que orquestra o Puppeteer |
| 4.6 | Armazenamento da RVDD no Supabase Storage | ⏳ | Backend | PDF salvo com URL no banco |
| 4.7 | Geração e registro do código de validação alfanumérico | ⏳ | Backend | `codigo_validacao` único por diploma |
| 4.8 | Publicação no repositório público (URL HTTPS ativa) | ⏳ | Backend | `/verify/[codigo]` acessível publicamente |
| 4.9 | Atualização do status do diploma para `publicado` | ⏳ | Banco | Pipeline finalizado |
| 4.10 | Notificação ao diplomado por e-mail | ⏳ | Backend | XML + RVDD PDF em anexo + link do portal |
| 4.11 | Portal do diplomado: tela de login | ⏳ | Frontend | Supabase Auth para o diplomado |
| 4.12 | Portal do diplomado: tela "meus diplomas" | ⏳ | Frontend | Lista de diplomas com download XML + RVDD |

---

## Fase 5 — Portal Público de Verificação

**Objetivo:** Qualquer pessoa pode verificar a autenticidade de um diploma.
**Estimativa:** 1 semana
**Corresponde a:** Fase 4 do macroprocesso

| # | Entregável | Status | Tipo | Observação |
|---|-----------|--------|------|------------|
| 5.1 | Tela de busca pública (`/verify`) | ⏳ | Frontend | Busca por código alfanumérico — sem login |
| 5.2 | Tela de exibição do diploma (`/verify/[codigo]`) | ⏳ | Frontend | Dados públicos (sem CPF — LGPD) + status assinaturas |
| 5.3 | API pública de verificação (`/api/verify/[codigo]`) | ⏳ | Backend | Retorna dados públicos sem informações sensíveis |
| 5.4 | Leitura de QR Code redirecionando para `/verify/[codigo]` | ⏳ | Frontend | QR Code embutido na RVDD aponta para esta URL |
| 5.5 | Download do XML assinado na tela pública | ⏳ | Frontend | Diplomado ou terceiro pode baixar o XML legal |
| 5.6 | Integração com `validadordiplomadigital.mec.gov.br` | ⏳ | Integ. | Link/instrução para validação independente pelo MEC |

---

## Fase 6 — IA Copiloto Completo

**Objetivo:** IA guia o usuário em todo o processo, não apenas extrai dados.
**Estimativa:** 2 semanas
**Pode ser desenvolvida em paralelo com Fases 2-5**

| # | Entregável | Status | Tipo | Observação |
|---|-----------|--------|------|------------|
| 6.1 | AIAssistant com contexto de etapa (sabe onde o usuário está) | 🔄 | IA | Componente base criado; contexto dinâmico pendente |
| 6.2 | AIAssistant na Etapa 1 (Auditoria Acadêmica) | ⏳ | IA | Explica pendências em linguagem natural |
| 6.3 | AIAssistant na Etapa 2 (Cadastro do diplomado) | ⏳ | IA | Guia o upload, confirma dados extraídos |
| 6.4 | AIAssistant na Etapa 3 (Histórico acadêmico) | ⏳ | IA | Identifica lacunas no histórico, pede complemento |
| 6.5 | AIAssistant na Etapa 4 (Revisão e validação) | ⏳ | IA | Explica cada erro/aviso em linguagem natural |
| 6.6 | AIAssistant durante assinatura (Etapa 6) | ⏳ | IA | Guia os signatários, explica o que assinar |
| 6.7 | Feedback em linguagem natural nos erros de XSD | ⏳ | IA | Traduz erro técnico XML para linguagem humana |
| 6.8 | Sugestões inteligentes de correção de dados | ⏳ | IA | "O nome está todo em maiúsculo — corrigir para..." |
| 6.9 | Chat livre para tirar dúvidas sobre o processo | ⏳ | IA | Perguntas sobre o fluxo, regulamentação, prazos |

---

## Fase 7 — Polimento, Testes e Produção

**Objetivo:** Sistema pronto para uso real pela secretaria da FIC.
**Estimativa:** 1–2 semanas

| # | Entregável | Status | Tipo | Observação |
|---|-----------|--------|------|------------|
| 7.1 | Testes de ponta a ponta: Fase 1 → 2 → 3 → 4 completo | ⏳ | QA | Simular emissão real de 1 diploma completo |
| 7.2 | Testes com a secretaria da FIC (usuários reais) | ⏳ | QA | Identificar pontos de fricção no UX |
| 7.3 | Conformidade LGPD: política de privacidade e retenção | ⏳ | Legal | Consentimento do diplomado, prazo de retenção de dados |
| 7.4 | Backup automático dos XMLs assinados (mínimo 10 anos) | ⏳ | Infra | Política de backup no Supabase Storage / R2 |
| 7.5 | Política de acesso e auditoria (audit_log) | ⏳ | Segurança | Quem fez o quê e quando |
| 7.6 | Documentação do sistema para a equipe da FIC | ⏳ | Docs | Manual de uso para secretaria acadêmica |
| 7.7 | Ajustes finais de UX no wizard | ⏳ | Frontend | Com base no feedback da Fase 7.2 |
| 7.8 | Deploy de produção com variáveis de ambiente corretas | ⏳ | Deploy | Vercel + Supabase produção |

---

## Resumo por Fase

| Fase | Nome | Itens | Concluídos | Pendentes | Bloqueadores | Estimativa |
|------|------|-------|-----------|-----------|--------------|-----------|
| 0 | Fundação e Infraestrutura | 9 | 0 | 4 | 5 | 1 semana |
| 1 | Cadastro e Coleta (Wizard IA) | 18 | 0 | 13 | 5 (infra) | 2 semanas |
| 2 | Motor XML | 10 | 0 | 10 | 0 | 2 semanas |
| 3 | Assinatura Digital e Transmissão | 11 | 0 | 10 | 1 | 2 semanas |
| 4 | Geração RVDD e Entrega | 12 | 0 | 11 | 1 (design) | 1-2 semanas |
| 5 | Portal Público de Verificação | 6 | 0 | 6 | 0 | 1 semana |
| 6 | IA Copiloto Completo | 9 | 1 | 8 | 0 | 2 semanas |
| 7 | Polimento, Testes e Produção | 8 | 0 | 8 | 0 | 1-2 semanas |
| **Total** | | **83** | **1** | **70** | **12** | **12–14 semanas** |

---

## Bloqueadores Críticos (resolver primeiro)

| # | Bloqueador | Impacto | Responsável |
|---|-----------|---------|------------|
| B1 | Executar migration do banco no Supabase | Bloqueia toda a persistência de dados | Marcelo / Dev |
| B2 | Microserviço DocumentConverter (Docker + Ghostscript) | Bloqueia conversão PDF/A — fase 1 | Dev |
| B3 | Deploy do microserviço (Fly.io / Railway) | Bloqueia a fase 1 em produção | Dev |
| B4 | Contratação da API de assinatura (BRy / Certisign / Soluti) | Bloqueia toda a Fase 3 | **Marcelo** |
| B5 | Definição da IES Registradora | Bloqueia transmissão (Fase 3.8+) | **Marcelo** |
| B6 | Design do layout visual da RVDD | Bloqueia toda a Fase 4 | **Marcelo + FIC** |

---

## Ordem de Execução Recomendada

```
B1 (migration) → Fase 1 (parcial: telas sem DocumentConverter)
                ↓
B2 + B3 (Docker) → Fase 1 completa (com PDF/A)
                ↓
Fase 2 (Motor XML) — pode rodar em paralelo com Fase 1 após B1
                ↓
B4 (API assinatura) + B5 (Registradora) → Fase 3
                ↓
B6 (Design RVDD) → Fase 4
                ↓
Fase 5 (Portal público) — pode rodar em paralelo com Fase 4
                ↓
Fase 6 (IA Copiloto) — pode rodar em paralelo com Fases 2-5
                ↓
Fase 7 (Polimento e produção)
```

---

*Documento elaborado em 2026-03-20 — v1.0. Baseado em: fluxo-ia-native.md v1.4, STACK-E-BANCO.md, diploma-digital.md, e levantamento do código existente em src/.*
