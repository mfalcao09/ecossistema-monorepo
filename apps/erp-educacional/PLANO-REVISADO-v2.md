# Plano Revisado v2.0 — Diploma Digital FIC
**Data:** 30/03/2026
**Versão:** 2.0 (incorpora correções de 30/03)
**Status:** Aguardando aprovação do Marcelo

---

## 1. Visão Geral

O sistema de Diploma Digital da FIC abrange o ciclo completo de emissão, desde a importação de documentos do formando até o envio à registradora. Este plano organiza o trabalho em **6 Fases** com **12 etapas**, divididas em **5 Blocos de implementação**.

### Correções aplicadas nesta versão:
1. **Documentos do acervo são selecionados manualmente** — o operador escolhe quais documentos da Fase 1 integram o acervo acadêmico (não é automático)
2. **Editor de tratamento digital de imagens** — funcionalidade tipo Adobe Scan (crop, deskew, brilho, contraste, filtros) antes da conversão PDF/A
3. **FIC emite 2 XMLs, não 3** — DocumentoHistoricoEscolarFinal + DocumentacaoAcademicaRegistro. O XML do DiplomaDigital é gerado pela registradora (UFMS)

---

## 2. Fluxo Completo (12 Etapas em 6 Fases)

### FASE 1 — Importação e Extração
| Etapa | Ação | Responsável |
|-------|------|-------------|
| 1 | Upload de documentos do formando (RG, histórico anterior, certidão, etc.) | Operador |
| 2 | Extração IA dos dados (OCR + interpretação) | Sistema (IA) |

### FASE 2 — Revisão e Criação
| Etapa | Ação | Responsável |
|-------|------|-------------|
| 3 | Revisão no formulário (dados extraídos, campos faltantes em amarelo) | Operador |
| 4 | Confirmar e Criar Processo → status: `em_validacao` | Operador |

### FASE 3 — Validação e Assinatura XML
| Etapa | Ação | Responsável |
|-------|------|-------------|
| 5 | Validar dados completos → Gerar 2 XMLs (Histórico Escolar + Documentação Acadêmica) | Sistema |
| 6 | Assinar 2 XMLs via BRy KMS (ICP-Brasil, XAdES AD-RA, certificado A3) → status: `aguardando_documentos` | Sistema + Assinante |

**Ordem obrigatória de assinatura:** Primeiro o Histórico Escolar, depois a Documentação Acadêmica de Registro.

### FASE 4 — Preparação de Documentos Complementares
| Etapa | Ação | Responsável |
|-------|------|-------------|
| 7 | Gerar Histórico Escolar em PDF (template) → Assinar via BRy CMS | Sistema + Assinante |
| 8 | Gerar Termo de Expedição em PDF (template) → Assinar via BRy CMS | Sistema + Assinante |
| 9 | Gerar Termo de Responsabilidade em PDF (template) → Assinar via BRy CMS | Sistema + Assinante |

### FASE 5 — Digitalização e Acervo Acadêmico
| Etapa | Ação | Responsável |
|-------|------|-------------|
| 10 | Operador SELECIONA quais documentos da Fase 1 vão para o acervo (+ pode adicionar novos) | Operador |
| 11 | Documentos que são fotos passam pelo Editor de Imagem (crop, deskew, brilho, contraste, filtros) → Conversão PDF/A-2B (<1MB) → Importação no acervo acadêmico com metadados Decreto 10.278/2020 → Assinatura via BRy CMS | Operador + Sistema |

### FASE 6 — Envio à Registradora
| Etapa | Ação | Responsável |
|-------|------|-------------|
| 12 | Pacote completo pronto → Download manual → Upload no site da registradora | Operador |

**Futuro:** API automática para envio direto à registradora.

---

## 3. Máquina de Status

```
rascunho
  └→ em_extracao
       └→ aguardando_revisao
            └→ em_validacao
                 └→ aguardando_assinatura_xml
                      └→ xml_assinado
                           └→ aguardando_documentos         ← FASE 4
                                └→ gerando_documentos
                                     └→ documentos_assinados
                                          └→ aguardando_digitalizacao   ← FASE 5
                                               └→ acervo_completo
                                                    └→ aguardando_envio_registradora  ← FASE 6
                                                         └→ enviado_registradora
                                                              └→ registrado
                                                                   └→ gerando_rvdd
                                                                        └→ publicado
```

**Novos status adicionados:** `aguardando_documentos`, `gerando_documentos`, `documentos_assinados`, `aguardando_digitalizacao`, `acervo_completo`, `aguardando_envio_registradora`, `enviado_registradora`

---

## 4. Infraestrutura Existente (Reaproveitamento)

O que JÁ ESTÁ construído e será reaproveitado:

| Componente | Localização | Status |
|-----------|-------------|--------|
| Gerador de XML (2 tipos da emissora) | `src/lib/xml/gerador.ts` | Pronto |
| Validador de XML (XSD v1.05) | `src/lib/xml/validador.ts` | Pronto |
| Montador de dados para XML | `src/lib/xml/montador.ts` | Pronto |
| API de assinatura XML (BRy KMS) | `src/app/api/diplomas/[id]/assinar/route.ts` | Pronto |
| API de publicação | `src/app/api/diplomas/[id]/publicar/route.ts` | Pronto |
| Gerador de RVDD (HTML→PDF) | `src/app/api/diplomas/[id]/rvdd/route.ts` | Pronto |
| Pipeline visual (6 fases — será expandido) | `src/app/(erp)/diploma/diplomas/[id]/page.tsx` | Pronto |
| Microserviço PDF/A (Docker + Ghostscript + veraPDF + ImageMagick) | `services/document-converter/` | Pronto |
| Módulo Acervo (páginas + APIs) | `src/app/(erp)/acervo/` + `src/app/api/acervo/` | Pronto |
| Tabela documentos_digitais (storage unificado) | Supabase | Pronta |
| Document Engine (lifecycle management) | `src/lib/documentos/engine.ts` | Pronto |
| Tabela acervo_templates (templates HTML) | Supabase | Pronta |
| Tabela acervo_digitalizacao_meta (metadados MEC) | Supabase | Pronta |
| Tabela acervo_lotes (lotes de digitalização) | Supabase | Pronta |
| BRy CMS (assinatura PDF — já configurada p/ histórico) | Config existente | Pronto |
| Transação com rollback (criação de processos) | `src/app/api/processos/route.ts` | Pronto |

---

## 5. Blocos de Implementação

### BLOCO A — Correções Críticas de Navegação
**Prioridade:** URGENTE (pré-requisito para tudo)
**IA Líder:** Claude (Opus) | **Apoio:** Kimi (bugs)
**Estimativa:** 1-2 dias

#### A1. Corrigir dead-end processos/[id] → diplomas/[id]
- **Problema:** Após criar processo, operador vai para `processos/[id]` (chat IA) que NÃO tem saída para o pipeline
- **Solução:** Adicionar botão "Avançar para Pipeline" em `processos/[id]` que leva a `diplomas/[id]`
- **Arquivo:** `src/app/(erp)/diploma/processos/[id]/page.tsx`
- **Impacto:** ~30 linhas

#### A2. Corrigir redirecionamento pós-criação
- **Problema:** `criarProcesso()` redireciona para `processos/[id]` em vez de `diplomas/[id]`
- **Solução:** Mudar redirect para `diplomas/[id]` (onde está o pipeline completo)
- **Arquivo:** `src/app/(erp)/diploma/processos/page.tsx` (função `criarProcesso`, ~linha 1430)
- **Impacto:** ~5 linhas

#### A3. Salvar filiações no banco
- **Problema:** Filiações extraídas pela IA mas NÃO são salvas no POST /api/processos
- **Consequência:** O montador XML depende de filiações — sem elas, XML não pode ser gerado
- **Solução:** Adicionar insert na tabela `filiacoes` dentro da rota de criação de processo
- **Arquivo:** `src/app/api/processos/route.ts`
- **Impacto:** ~20 linhas

---

### BLOCO B — Geração de PDFs e Documentos Complementares (Fase 4)
**Prioridade:** ALTA
**IA Líder:** Buchecha (MiniMax) | **Apoio:** Qwen (frontend templates)
**Estimativa:** 3-4 dias

#### B1. Instalar biblioteca de geração PDF
- **Situação atual:** NENHUMA lib de PDF instalada no projeto
- **Decisão técnica:** Puppeteer para documentos ricos (histórico escolar — mesmo approach do RVDD) + pdf-lib como fallback para documentos simples
- **Ação:** `npm install puppeteer pdf-lib`

#### B2. Criar templates HTML para os 3 documentos
- **Usar tabela `acervo_templates`** que já existe no Supabase
- **Templates a criar:**
  - `historico_escolar_pdf` — disciplinas, notas, carga horária, dados do curso, dados da IES
  - `termo_expedicao` — dados do diploma emitido, datas, assinantes responsáveis
  - `termo_responsabilidade` — dados do diplomado, declaração de responsabilidade
- **Cada template:** HTML com variáveis dinâmicas (`{{nome_diplomado}}`, `{{curso}}`, `{{data_colacao}}`, etc.)
- **Benefício:** Templates editáveis pelo painel de templates do acervo, sem precisar de desenvolvedor

#### B3. Criar API de geração dos documentos
- **Nova rota:** `POST /api/diplomas/[id]/documentos/gerar`
- **Payload:** `{ tipo: "historico_escolar" | "termo_expedicao" | "termo_responsabilidade" }`
- **Fluxo:** Busca template → busca dados do diploma/diplomado → preenche variáveis → gera PDF (Puppeteer) → salva na tabela `documentos_digitais` via Document Engine
- **Retorno:** URL do PDF gerado + preview

#### B4. Criar API de assinatura CMS para PDFs
- **Nova rota:** `POST /api/diplomas/[id]/documentos/[doc_id]/assinar`
- **Tecnologia:** BRy CMS (API já configurada para histórico escolar)
- **Padrão:** CAdES ou PAdES (assinatura embutida no PDF)
- **Diferença do KMS:** KMS = XML/XAdES (diploma). CMS = PDF/PAdES (documentos complementares)
- **Assinantes:** Mesmos do diploma (2 eCPF + 1 eCNPJ da emissora)

---

### BLOCO C — Editor de Imagem + Digitalização + Acervo (Fase 5)
**Prioridade:** ALTA
**IA Líder:** DeepSeek (lógica metadados) + Qwen (frontend editor) | **Apoio:** Codestral (integração)
**Estimativa:** 4-5 dias

#### C1. Tela de seleção de documentos para o acervo
- **Localização:** Nova aba na página do diploma ou seção dedicada na Fase 5
- **Funcionalidade:**
  - Lista todos os documentos enviados na Fase 1 (upload original)
  - Checkbox para selecionar quais vão para o acervo acadêmico
  - Botão "Adicionar novo documento" para uploads extras
  - Classificação do tipo documental (RG, CPF, certidão nascimento, histórico anterior, etc.)
- **Regra:** Documentos NÃO selecionados ficam apenas no processo, sem ir para o acervo

#### C2. Editor de Imagem (tipo Adobe Scan)
- **Referência:** Vídeo do Adobe Scan enviado pelo Marcelo
- **Abordagem:** Caminho Híbrido — Canvas API no frontend (preview instantâneo) + Sharp/ImageMagick no backend (processamento final)
- **Funcionalidades MVP (Nível 1):**
  - Detecção automática de bordas e recorte (crop inteligente)
  - Correção de perspectiva (deskew — endireitar documento torto)
  - Filtros: cor original, escala de cinza, preto & branco alto contraste, "cor automática"
  - Sliders de brilho e contraste (preview em tempo real via Canvas)
  - Rotação (90°, 180°, 270°, livre)
  - Preview antes/depois
- **Funcionalidades futuras (Nível 2):**
  - Borracha mágica (remover sombras de dedos)
  - OCR integrado
  - Multi-página (várias fotos → 1 PDF)
- **Frontend:** Componente React com Canvas API (Qwen lidera)
- **Backend:** Sharp (Node.js) para processamento + microserviço Docker existente para conversão PDF/A

#### C3. Conversão PDF/A e validação de tamanho
- **Microserviço existente:** `services/document-converter/` (Docker + Ghostscript + veraPDF)
- **Fluxo:** Imagem tratada → enviar para microserviço → conversão PDF/A-2B (ISO 19005-2) → validar veraPDF → retornar
- **Validação de tamanho:** < 1MB obrigatório
  - Se > 1MB: recomprimir automaticamente (reduzir DPI, otimizar cor)
  - Se ainda > 1MB: alerta visual ao operador com opções (reduzir mais, trocar imagem)
- **Indicador visual:** Verde (< 500KB), Amarelo (500KB-1MB), Vermelho (> 1MB)

#### C4. Metadados do Decreto 10.278/2020
- **Tabela existente:** `acervo_digitalizacao_meta`
- **Campos obrigatórios:** tipo documental, data de digitalização, responsável pela digitalização, hash SHA-256 do arquivo original, resolução (DPI), formato (PDF/A-2B)
- **Preenchimento automático:** Sistema preenche data, hash, resolução, formato. Operador confirma tipo documental e responsável.

#### C5. Assinatura dos documentos digitalizados
- **API:** BRy CMS (mesma dos documentos complementares)
- **Atenção:** O assinante da digitalização pode ser DIFERENTE dos assinantes do diploma
  - Decreto 10.278 exige assinatura do **responsável pela digitalização** (pessoa designada pela IES)
  - Pode ser o mesmo signatário ou outra pessoa — configurável no sistema
- **Registro:** Salvar na tabela `documentos_digitais` via Document Engine

---

### BLOCO D — Interface do Pipeline Expandido
**Prioridade:** MÉDIA
**IA Líder:** Qwen (frontend React) | **Apoio:** Buchecha (review)
**Estimativa:** 3-4 dias

#### D1. Expandir pipeline visual
- **Arquivo:** `src/app/(erp)/diploma/diplomas/[id]/page.tsx`
- **Atual:** 6 estágios (Extração → XML → Assinatura → Registro → RVDD → Publicação)
- **Novo:** Expandir para refletir todas as 6 fases e 12 etapas do novo fluxo
- **Design:** Pipeline horizontal com ícones, status colorido, e indicador de fase atual

#### D2. Nova aba "Documentos Complementares"
- **Ao lado das abas existentes:** "Dados do diplomado", "XMLs", "Histórico"
- **Conteúdo:**
  - Card para cada documento (Histórico PDF, Termo Expedição, Termo Responsabilidade)
  - Status de cada: Pendente → Gerado → Assinado
  - Botão "Gerar" + Botão "Assinar" + Preview/Download
  - Indicador visual de progresso (0/3, 1/3, 2/3, 3/3)

#### D3. Nova aba "Acervo / Digitalização"
- **Conteúdo:**
  - Lista de documentos pessoais do formando (vindos da Fase 1 + adicionados)
  - Checkbox para selecionar quais vão para o acervo
  - Para cada documento: status (original / tratado / PDF-A / assinado)
  - Botão "Editar Imagem" que abre o editor (C2)
  - Indicador de tamanho por documento (verde/amarelo/vermelho)
  - Tipo documental (dropdown para classificação)

#### D4. Tela "Pacote para Registradora"
- **Quando exibir:** Quando TODOS os itens estiverem prontos (XMLs + docs + acervo)
- **Checklist visual:**
  - ✓ XML Histórico Escolar Digital — assinado
  - ✓ XML Documentação Acadêmica de Registro — assinado
  - ✓ Histórico Escolar PDF — assinado
  - ✓ Termo de Expedição — assinado
  - ✓ Termo de Responsabilidade — assinado
  - ✓ Documentos pessoais em PDF/A — X de Y assinados
- **Botão "Baixar Pacote Completo":** Gera ZIP com tudo organizado em pastas:
  ```
  pacote-diploma-{CPF}/
  ├── xmls/
  │   ├── HistoricoEscolarDigital_assinado.xml
  │   └── DocumentacaoAcademicaRegistro_assinado.xml
  ├── documentos/
  │   ├── HistoricoEscolar.pdf
  │   ├── TermoExpedicao.pdf
  │   └── TermoResponsabilidade.pdf
  ├── acervo/
  │   ├── RG_PDFA.pdf
  │   ├── CPF_PDFA.pdf
  │   └── ...
  └── manifesto.json
  ```
- **Futuro:** Botão "Enviar para Registradora" (API automática)

---

### BLOCO E — Status Machine e Transições
**Prioridade:** MÉDIA (executar junto com Bloco B/C)
**IA Líder:** DeepSeek (lógica) | **Apoio:** Claude (arquitetura)
**Estimativa:** 1-2 dias

#### E1. Migration SQL — Novos status
```sql
-- Adicionar novos valores ao enum de status
ALTER TYPE status_diploma ADD VALUE IF NOT EXISTS 'aguardando_documentos';
ALTER TYPE status_diploma ADD VALUE IF NOT EXISTS 'gerando_documentos';
ALTER TYPE status_diploma ADD VALUE IF NOT EXISTS 'documentos_assinados';
ALTER TYPE status_diploma ADD VALUE IF NOT EXISTS 'aguardando_digitalizacao';
ALTER TYPE status_diploma ADD VALUE IF NOT EXISTS 'acervo_completo';
ALTER TYPE status_diploma ADD VALUE IF NOT EXISTS 'aguardando_envio_registradora';
ALTER TYPE status_diploma ADD VALUE IF NOT EXISTS 'enviado_registradora';
```

#### E2. API de transição de status
- **Rota:** `PATCH /api/diplomas/[id]/status`
- **Validação:** Mapa de transições permitidas — não pode pular etapa
- **Log:** Cada transição registrada em `documentos_digitais_log` com timestamp, usuário, status anterior e novo

#### E3. Checklist automático por fase
- Antes de permitir avançar para o próximo status, sistema verifica:
  - `xml_assinado → aguardando_documentos`: 2 XMLs gerados e assinados
  - `documentos_assinados → aguardando_digitalizacao`: 3 PDFs gerados e assinados
  - `acervo_completo → aguardando_envio_registradora`: Todos docs selecionados convertidos e assinados
  - `aguardando_envio_registradora → enviado_registradora`: Confirmação do operador

---

## 6. Atribuição do Squad

| Bloco | IA Líder | Papel | Apoio |
|-------|---------|-------|-------|
| A (Navegação) | **Claude (Opus 4)** | Correções cirúrgicas de roteamento e salvamento | Kimi (bugs) |
| B (PDFs/Templates) | **Buchecha (MiniMax)** | Geração de código em massa, APIs, templates | Qwen (frontend) |
| C (Editor/Acervo) | **Qwen (frontend)** + **DeepSeek (lógica)** | Editor de imagem React + lógica de metadados | Codestral (integração) |
| D (Interface) | **Qwen** | Componentes React, abas, pipeline visual | Buchecha (code review) |
| E (Status Machine) | **DeepSeek** | Lógica de transições, validações, SQL | Claude (arquitetura) |

---

## 7. Cronograma Sugerido

| Sprint | Bloco | Entregas | Dias |
|--------|-------|----------|------|
| Sprint 1 | A + E1 | Navegação corrigida + novos status no banco | 2 dias |
| Sprint 2 | B | Lib PDF instalada + 3 templates + API geração + API assinatura CMS | 4 dias |
| Sprint 3 | C | Seleção de docs + Editor de imagem + Conversão PDF/A + Metadados + Assinatura | 5 dias |
| Sprint 4 | D | Pipeline expandido + abas novas + tela pacote registradora | 4 dias |
| Sprint 5 | E2 + E3 | API transição + checklist automático + testes | 2 dias |

**Total estimado: ~17 dias de desenvolvimento**

---

## 8. Decisões Técnicas Pendentes

| Decisão | Opções | Recomendação |
|---------|--------|-------------|
| Lib PDF principal | Puppeteer vs pdf-lib vs React-pdf | Puppeteer (consistente com RVDD existente) |
| Editor de imagem | Frontend puro vs Backend puro vs Híbrido | Híbrido (Canvas + Sharp) |
| Assinante do acervo | Mesmo do diploma vs Configurável | Configurável (Decreto 10.278 exige responsável designado) |
| Pacote ZIP | JSZip no frontend vs archiver no backend | Backend (archiver) — mais seguro e confiável |

---

## 9. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Puppeteer pesado no deploy (Vercel) | Pode estourar limite de 50MB | Usar @sparticuz/chromium (versão serverless) ou mover para microserviço |
| Detecção de bordas imprecisa | UX ruim no editor de imagem | Permitir crop manual como fallback |
| PDF/A > 1MB mesmo após compressão | Documento rejeitado | Redução automática de DPI + alerta ao operador |
| BRy CMS indisponível | Não consegue assinar PDFs | Modo offline: gerar docs e assinar depois (fila de assinatura) |
| Registradora muda requisitos | Pacote rejeitado | Manifesto JSON versionado, fácil de adaptar |

---

## 10. Benefícios Estratégicos

1. **Cumprimento MEC:** Atende Portaria 70/2025, IN SESU 1/2020 e 2/2021
2. **Acervo Acadêmico:** Cumpre Decreto 10.278/2020 — mata 2 problemas com 1 solução
3. **Escalabilidade:** Tudo construído sobre Document Engine e tabela unificada — novos tipos de documento entram fácil
4. **Digitalização em lote:** Módulo de acervo já suporta lotes — pode digitalizar alunos antigos independente do diploma
5. **Base para SaaS:** Pacote para registradora e editor de imagem são diferenciais para a Intentus
