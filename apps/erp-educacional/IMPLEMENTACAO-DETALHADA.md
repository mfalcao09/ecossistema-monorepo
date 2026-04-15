# Planejamento de Implementação Detalhado
**Projeto:** Diploma Digital FIC v2.0
**Data:** 30/03/2026
**Baseado em:** Plano Revisado v2.0 (aprovado)
**Consultores:** Buchecha (MiniMax), UI/UX Pro Max, Exploração do Codebase

---

## Estratégia de Implementação

### Ordem de Execução (validada com Buchecha)

```
SPRINT 1: A + E1 (Fundação)
    ↓
SPRINT 2: E2 + E3 + D1 (Infraestrutura + Pipeline Visual)
    ↓
SPRINT 3: B (Geração de PDFs + Assinatura CMS)
    ↓
SPRINT 4: C (Editor de Imagem + Acervo)
    ↓
SPRINT 5: D2 + D3 + D4 (Abas Novas + Pacote Registradora)
```

**Lógica:** Infraestrutura (status, navegação) antes de features. Interface expandida antes das features que a utilizam. Isso permite que cada sprint tenha algo visível e testável.

### Decisões Técnicas (consolidadas com squad)

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| **Lib PDF** | `pdf-lib` (principal) + Puppeteer (só RVDD, já existe) | Buchecha: Puppeteer na Vercel é problemático (cold starts, memória). pdf-lib é serverless-friendly e leve. |
| **Editor de imagem** | Canvas API frontend + Sharp backend | Buchecha: padrão comum e sólido. Canvas para preview/interação, Sharp para processamento final. |
| **Pacote ZIP** | `archiver` no backend | Buchecha: mais confiável e seguro. Integridade dos documentos é crítica para assinatura digital. |
| **Pipeline visual** | Stepper agrupado por fase | UI/UX Pro Max: multi-step-progress + progressive-disclosure. 6 fases principais com sub-etapas expansíveis. |

---

## SPRINT 1 — Fundação (2 dias)
**Objetivo:** Destravar o fluxo natural e criar base de dados para novos status.
**Squad:** Claude (líder) + Kimi (bugs)

### Etapa 1.1 — Corrigir navegação (A1 + A2)
**Arquivo:** `src/app/(erp)/diploma/processos/page.tsx`

**O que fazer:**
1. Na função `criarProcesso()` (~linha 1458), mudar o redirect:
   ```typescript
   // ANTES:
   router.push(`/diploma/processos/${processo.id}`)
   // DEPOIS:
   router.push(`/diploma/diplomas/${processo.diploma_id}`)
   ```
2. Verificar se o `POST /api/processos` retorna o `diploma_id` na resposta (hoje retorna `processo.id`)

**Arquivo:** `src/app/(erp)/diploma/processos/[id]/page.tsx`

**O que fazer:**
1. Adicionar botão "Avançar para Pipeline" no topo ou rodapé
2. Buscar o `diploma_id` associado ao processo
3. Link para `/diploma/diplomas/${diploma_id}`

**Entregável:** Operador consegue criar processo e chegar ao pipeline naturalmente.

---

### Etapa 1.2 — Salvar filiações (A3)
**Arquivo:** `src/app/api/processos/route.ts`

**O que fazer:**
1. No payload recebido, aceitar campo `filiacoes` (array)
2. Após criar diplomado, inserir filiações na tabela `filiacoes`:
   ```typescript
   // Dentro do bloco de criação, após diplomado:
   if (dados.filiacoes?.length) {
     for (const filiacao of dados.filiacoes) {
       const { error } = await supabase.from('filiacoes').insert({
         diplomado_id: criados.diplomado_id,
         nome: filiacao.nome,
         tipo: filiacao.tipo, // 'pai' | 'mae' | 'responsavel'
         // demais campos conforme tabela
       })
       if (error) {
         await rollback(supabase, criados)
         return NextResponse.json({ erro: `Erro ao salvar filiação: ${error.message}` }, { status: 500 })
       }
     }
   }
   ```
3. Incluir rollback de filiações no helper `rollback()`

**Entregável:** Filiações salvas no banco, montador XML consegue gerar XMLs completos.

---

### Etapa 1.3 — Migration: Novos status (E1)
**Onde:** Supabase SQL Editor

**O que fazer:**
1. Verificar se `status` é um enum ou TEXT no banco
2. Se for enum, executar migration:
   ```sql
   ALTER TYPE status_diploma ADD VALUE IF NOT EXISTS 'aguardando_documentos';
   ALTER TYPE status_diploma ADD VALUE IF NOT EXISTS 'gerando_documentos';
   ALTER TYPE status_diploma ADD VALUE IF NOT EXISTS 'documentos_assinados';
   ALTER TYPE status_diploma ADD VALUE IF NOT EXISTS 'aguardando_digitalizacao';
   ALTER TYPE status_diploma ADD VALUE IF NOT EXISTS 'acervo_completo';
   ALTER TYPE status_diploma ADD VALUE IF NOT EXISTS 'aguardando_envio_registradora';
   ALTER TYPE status_diploma ADD VALUE IF NOT EXISTS 'enviado_registradora';
   ```
3. Atualizar o tipo TypeScript `StatusDiploma` em `src/types/diplomas.ts`:
   ```typescript
   export type StatusDiploma =
     | 'rascunho'
     | 'preenchido'
     | 'xml_gerado'
     | 'em_assinatura'
     | 'assinado'
     | 'aguardando_registro'
     | 'registrado'
     | 'aguardando_documentos'      // NOVO
     | 'gerando_documentos'          // NOVO
     | 'documentos_assinados'        // NOVO
     | 'aguardando_digitalizacao'    // NOVO
     | 'acervo_completo'             // NOVO
     | 'aguardando_envio_registradora' // NOVO
     | 'enviado_registradora'        // NOVO
     | 'gerando_rvdd'
     | 'rvdd_gerado'
     | 'publicado'
   ```
4. Atualizar o array `STATUS_DIPLOMA_ORDEM` com a sequência completa

**Entregável:** Banco e tipos prontos para o fluxo expandido.

---

### Checklist Sprint 1:
- [ ] Redirect `criarProcesso()` para `diplomas/[id]`
- [ ] Botão "Avançar" em `processos/[id]`
- [ ] Filiações salvas no POST /api/processos
- [ ] Rollback inclui filiações
- [ ] 7 novos status no banco
- [ ] Tipo TypeScript atualizado
- [ ] Array de ordem atualizado
- [ ] Commit + deploy + teste no preview

---

## SPRINT 2 — Infraestrutura + Pipeline Visual (3 dias)
**Objetivo:** API de transição de status + pipeline visual expandido.
**Squad:** DeepSeek (lógica transições) + Qwen (frontend pipeline) + Claude (orquestração)

### Etapa 2.1 — API de transição de status (E2)
**Nova rota:** `src/app/api/diplomas/[id]/status/route.ts`

**O que fazer:**
1. Criar `PATCH` handler que recebe `{ novoStatus: StatusDiploma }`
2. Mapa de transições permitidas:
   ```typescript
   const TRANSICOES: Record<StatusDiploma, StatusDiploma[]> = {
     rascunho: ['preenchido'],
     preenchido: ['xml_gerado'],
     xml_gerado: ['em_assinatura'],
     em_assinatura: ['assinado'],
     assinado: ['aguardando_documentos'],
     aguardando_documentos: ['gerando_documentos'],
     gerando_documentos: ['documentos_assinados'],
     documentos_assinados: ['aguardando_digitalizacao'],
     aguardando_digitalizacao: ['acervo_completo'],
     acervo_completo: ['aguardando_envio_registradora'],
     aguardando_envio_registradora: ['enviado_registradora'],
     enviado_registradora: ['registrado'],
     registrado: ['gerando_rvdd'],
     gerando_rvdd: ['rvdd_gerado'],
     rvdd_gerado: ['publicado'],
   }
   ```
3. Validar que transição é permitida antes de atualizar
4. Registrar no log (`documentos_digitais_log`): status anterior, novo status, timestamp, usuário
5. Lembrar: `skipCSRF: true` no protegerRota

**Entregável:** API que controla transições e impede pulos de etapa.

---

### Etapa 2.2 — Checklist automático por fase (E3)
**Arquivo:** `src/lib/diploma/checklist.ts` (novo)

**O que fazer:**
1. Criar função `verificarChecklist(diplomaId, statusDesejado)`:
   ```typescript
   export async function verificarChecklist(
     supabase: SupabaseClient,
     diplomaId: string,
     statusDesejado: StatusDiploma
   ): Promise<{ aprovado: boolean; pendencias: string[] }> {
     const pendencias: string[] = []

     switch (statusDesejado) {
       case 'aguardando_documentos':
         // Verificar: 2 XMLs gerados E assinados
         break
       case 'aguardando_digitalizacao':
         // Verificar: 3 PDFs (histórico, termos) gerados E assinados
         break
       case 'aguardando_envio_registradora':
         // Verificar: docs selecionados convertidos PDF/A E assinados
         break
       // ...
     }

     return { aprovado: pendencias.length === 0, pendencias }
   }
   ```
2. Integrar na API de transição (Etapa 2.1): antes de permitir mudança de status, rodar checklist

**Entregável:** Sistema impede avanço sem documentos completos.

---

### Etapa 2.3 — Pipeline visual expandido (D1)
**Arquivo:** `src/app/(erp)/diploma/diplomas/[id]/page.tsx`

**Design (baseado em UI/UX Pro Max guidelines):**

**Padrão escolhido: Stepper Agrupado por Fase**
- 6 fases principais no topo (horizontal)
- Cada fase é clicável e expande para mostrar sub-etapas
- Fase ativa fica destacada (cor primária), fases futuras em cinza
- Sub-etapas aparecem abaixo da fase ativa com ícones menores

**Guidelines UX aplicadas:**
- `multi-step-progress`: Indicador de progresso por fase (barra ou ícones)
- `progressive-disclosure`: Sub-etapas só aparecem quando a fase está ativa/expandida
- `state-clarity`: Estados hover/pressed/disabled distintos
- `touch-target-size`: Mínimo 44×44px para cada item clicável
- `nav-state-active`: Localização atual destacada visualmente
- `color-not-only`: Ícone + texto + cor para indicar status (não só cor)

**Estrutura do componente:**
```typescript
const FASES = [
  {
    id: 'importacao',
    label: 'Importação',
    icone: Upload,
    etapas: [
      { id: 'upload', label: 'Upload Documentos', status: [...] },
      { id: 'extracao', label: 'Extração IA', status: [...] },
    ]
  },
  {
    id: 'revisao',
    label: 'Revisão',
    icone: ClipboardCheck,
    etapas: [
      { id: 'formulario', label: 'Revisar Dados', status: [...] },
      { id: 'criar', label: 'Criar Processo', status: [...] },
    ]
  },
  {
    id: 'xml',
    label: 'XML & Assinatura',
    icone: FileSignature,
    etapas: [
      { id: 'gerar_xml', label: 'Gerar 2 XMLs', status: [...] },
      { id: 'assinar_xml', label: 'Assinar XMLs (ICP-A3)', status: [...] },
    ]
  },
  {
    id: 'documentos',
    label: 'Documentos',
    icone: FileText,
    etapas: [
      { id: 'historico_pdf', label: 'Histórico Escolar PDF', status: [...] },
      { id: 'termo_exp', label: 'Termo Expedição', status: [...] },
      { id: 'termo_resp', label: 'Termo Responsabilidade', status: [...] },
    ]
  },
  {
    id: 'acervo',
    label: 'Acervo Digital',
    icone: Archive,
    etapas: [
      { id: 'selecionar', label: 'Selecionar Documentos', status: [...] },
      { id: 'digitalizar', label: 'Tratar & Converter PDF/A', status: [...] },
    ]
  },
  {
    id: 'registro',
    label: 'Registradora',
    icone: Building2,
    etapas: [
      { id: 'pacote', label: 'Preparar Pacote', status: [...] },
      { id: 'enviar', label: 'Enviar p/ Registro', status: [...] },
    ]
  },
]
```

**Cores por estado (semantic tokens — guideline `color-semantic`):**
- Concluído: `emerald-500` + ícone ✓
- Em progresso: `blue-500` + ícone spinner/pulso
- Pendente: `slate-300` + ícone outline
- Erro/Bloqueado: `red-500` + ícone alerta

**Entregável:** Pipeline visual mostrando 6 fases com sub-etapas, estados claros, responsivo.

---

### Checklist Sprint 2:
- [ ] API PATCH /diplomas/[id]/status funcionando
- [ ] Transições validadas (não pula etapa)
- [ ] Log de cada transição salvo
- [ ] Checklist automático integrado
- [ ] Pipeline visual com 6 fases + sub-etapas
- [ ] Estados visuais corretos (concluído/progresso/pendente)
- [ ] Responsivo (mobile/desktop)
- [ ] Acessível (contraste 4.5:1, focus rings, aria-labels)
- [ ] Commit + deploy + teste

---

## SPRINT 3 — Geração de PDFs + Assinatura CMS (4 dias)
**Objetivo:** Gerar e assinar os 3 documentos complementares.
**Squad:** Buchecha (líder código) + Qwen (frontend templates) + Claude (orquestração)

### Etapa 3.1 — Instalar pdf-lib
```bash
npm install pdf-lib @pdf-lib/fontkit
```

**Por que pdf-lib e não Puppeteer?**
- Buchecha recomendou: Vercel tem limites de memória e cold starts com Puppeteer
- pdf-lib é ~200KB (vs ~400MB do Puppeteer)
- Funciona perfeitamente em serverless
- Para o RVDD (que já usa Puppeteer): manter como está, não mexer

---

### Etapa 3.2 — Criar templates para os 3 documentos (B2)

**Abordagem:** Templates definidos em código TypeScript (não HTML) usando pdf-lib para layout programático.

**Criar:** `src/lib/documentos/templates/`
```
templates/
├── historico-escolar.ts    — Dados do curso, disciplinas, notas, CH
├── termo-expedicao.ts      — Dados do diploma emitido, assinantes
├── termo-responsabilidade.ts — Dados do diplomado, declaração
└── base.ts                 — Funções comuns (cabeçalho FIC, rodapé, estilos)
```

**Cada template exporta:**
```typescript
export async function gerarHistoricoEscolarPDF(dados: DadosDiploma): Promise<Uint8Array>
export async function gerarTermoExpedicaoPDF(dados: DadosDiploma): Promise<Uint8Array>
export async function gerarTermoResponsabilidadePDF(dados: DadosDiploma): Promise<Uint8Array>
```

**Dados vêm do montador existente:** `src/lib/xml/montador.ts` → `montarDadosDiploma()` retorna todos os dados necessários.

---

### Etapa 3.3 — API de geração de documentos (B3)
**Nova rota:** `src/app/api/diplomas/[id]/documentos/gerar/route.ts`

```typescript
// POST /api/diplomas/[id]/documentos/gerar
// Body: { tipo: "historico_escolar" | "termo_expedicao" | "termo_responsabilidade" }
//
// Fluxo:
// 1. Buscar dados do diploma via montador
// 2. Chamar template correspondente
// 3. Gerar PDF (Uint8Array)
// 4. Upload para Supabase Storage
// 5. Registrar na tabela documentos_digitais via Document Engine
// 6. Retornar URL + preview
```

**Lembrar:** `skipCSRF: true` no protegerRota.

---

### Etapa 3.4 — API de assinatura CMS para PDFs (B4)
**Nova rota:** `src/app/api/diplomas/[id]/documentos/[docId]/assinar/route.ts`

```typescript
// POST /api/diplomas/[id]/documentos/[docId]/assinar
//
// Fluxo:
// 1. Buscar documento da tabela documentos_digitais
// 2. Baixar PDF do Storage
// 3. Enviar para BRy CMS (API já configurada)
//    - Endpoint: /cms/sign (PAdES)
//    - Certificado: mesmo da assinatura XML (eCPF/eCNPJ)
// 4. Salvar PDF assinado no Storage (substituir original)
// 5. Atualizar status via Document Engine (registrarAssinatura)
// 6. Se todos 3 assinados → transicionar para 'documentos_assinados'
```

---

### Checklist Sprint 3:
- [ ] pdf-lib instalada e funcionando
- [ ] Template Histórico Escolar PDF gerando corretamente
- [ ] Template Termo Expedição PDF gerando corretamente
- [ ] Template Termo Responsabilidade PDF gerando corretamente
- [ ] API POST /diplomas/[id]/documentos/gerar funcionando para os 3 tipos
- [ ] Documentos salvos no Storage + registrados em documentos_digitais
- [ ] API de assinatura CMS funcionando (ou mock para teste)
- [ ] Transição automática para 'documentos_assinados' quando 3/3 assinados
- [ ] Commit + deploy + teste

---

## SPRINT 4 — Editor de Imagem + Acervo (5 dias)
**Objetivo:** Editor tipo Adobe Scan + integração com acervo acadêmico.
**Squad:** Qwen (frontend editor — React/Canvas) + DeepSeek (lógica metadados) + Codestral (integração Sharp)

### Etapa 4.1 — Componente Editor de Imagem (C2)
**Novo componente:** `src/components/editor-imagem/EditorImagem.tsx`

**Arquitetura de sub-componentes:**
```
EditorImagem/
├── EditorImagem.tsx         — Componente principal, estado global
├── CanvasPreview.tsx        — Canvas com preview em tempo real
├── ToolbarFiltros.tsx       — Botões: Original, Automático, P&B, Cinza
├── SliderAjustes.tsx        — Sliders de brilho e contraste
├── ControleCrop.tsx         — Crop com handles arrastáveis
├── ControleRotacao.tsx      — Botões 90°, -90°, flip
└── hooks/
    ├── useCanvasFilters.ts  — Hook para aplicar filtros via Canvas 2D
    ├── useCropDetection.ts  — Hook para detecção de bordas (client-side)
    └── useImageTransform.ts — Hook para rotação e flip
```

**Guidelines UI/UX Pro Max aplicadas:**
- `touch-target-size`: Botões de filtro mínimo 44×44px
- `touch-spacing`: Gap mínimo 8px entre controles
- `loading-buttons`: Spinner durante processamento
- `progressive-disclosure`: Filtros avançados ocultos por padrão
- `submit-feedback`: Preview antes/depois com slider deslizante
- `tap-feedback-speed`: Feedback visual < 100ms ao mexer sliders
- `safe-area-awareness`: Toolbar não invade areas seguras em mobile
- `multi-step-progress`: Indicador de etapa (1. Crop → 2. Ajustes → 3. Salvar)

**Libs necessárias:**
```bash
npm install react-advanced-cropper  # Crop com detecção de bordas
# Canvas API nativa para filtros (sem lib extra)
# Sharp já existe no backend (microserviço Docker)
```

**Preview em tempo real via Canvas:**
```typescript
// useCanvasFilters.ts
function aplicarFiltros(ctx: CanvasRenderingContext2D, filtros: Filtros) {
  const { brilho, contraste, filtro } = filtros
  ctx.filter = `brightness(${brilho}%) contrast(${contraste}%)`
  if (filtro === 'pb') ctx.filter += ' grayscale(100%) contrast(130%)'
  if (filtro === 'cinza') ctx.filter += ' grayscale(100%)'
  ctx.drawImage(imagemOriginal, 0, 0)
}
```

---

### Etapa 4.2 — Backend de processamento (C2 backend)
**Arquivo:** `src/app/api/acervo/processar-imagem/route.ts` (novo)

```typescript
// POST /api/acervo/processar-imagem
// Body: FormData com imagem + parâmetros (crop, brilho, contraste, filtro, rotação)
//
// Fluxo:
// 1. Receber imagem (JPEG/PNG)
// 2. Aplicar transformações com Sharp:
//    - Crop (coordenadas do frontend)
//    - Rotação
//    - Brilho/contraste (sharp.modulate + sharp.linear)
//    - Filtro P&B (sharp.grayscale)
// 3. Retornar imagem processada (JPEG otimizado)
```

---

### Etapa 4.3 — Tela de seleção para o acervo (C1)
**Novo componente:** `src/components/acervo/SelecionarDocumentosAcervo.tsx`

**Funcionalidade:**
- Lista todos docs enviados na Fase 1 (do processo)
- Checkbox para cada documento
- Dropdown para classificar tipo documental (RG, CPF, Certidão, Histórico Anterior, etc.)
- Botão "Adicionar novo documento" (upload)
- Para cada doc selecionado: botão "Editar Imagem" que abre o EditorImagem
- Indicador de tamanho: verde (<500KB), amarelo (500KB-1MB), vermelho (>1MB)

**Guidelines UX:**
- `input-labels`: Label visível para tipo documental
- `empty-states`: Mensagem quando nenhum documento selecionado
- `confirmation-dialogs`: Confirmar antes de remover documento da seleção
- `color-not-only`: Ícone + cor para indicar tamanho (não só cor)

---

### Etapa 4.4 — Conversão PDF/A + metadados (C3 + C4)
**Fluxo pós-edição:**
1. Imagem tratada → enviar para microserviço Docker existente (`/convert`)
2. Microserviço converte para PDF/A-2B + valida com veraPDF
3. Verificar tamanho < 1MB (se não, recomprimir via DPI reduzido)
4. Preencher metadados Decreto 10.278/2020 na tabela `acervo_digitalizacao_meta`:
   - tipo_documental, data_digitalizacao, responsavel, hash_sha256, resolucao_dpi, formato
5. Registrar no Document Engine (`registrarDocumento`)

---

### Etapa 4.5 — Assinatura docs digitalizados (C5)
- Usar mesma API CMS do Sprint 3 (Etapa 3.4)
- Atenção: assinante pode ser diferente (responsável pela digitalização)
- Adicionar campo "Responsável pela digitalização" nas configurações

---

### Checklist Sprint 4:
- [ ] Componente EditorImagem renderizando com canvas
- [ ] Crop funcionando (manual + detecção se possível)
- [ ] Filtros (original, automático, P&B, cinza) aplicando em tempo real
- [ ] Sliders brilho/contraste com preview instantâneo
- [ ] Rotação 90°
- [ ] Backend Sharp processando imagem final
- [ ] Tela de seleção de docs para acervo (checkboxes + tipo documental)
- [ ] Upload de novos docs na mesma tela
- [ ] Conversão PDF/A via microserviço Docker
- [ ] Validação tamanho < 1MB com feedback visual
- [ ] Metadados Decreto 10.278 preenchidos
- [ ] Assinatura CMS dos docs digitalizados
- [ ] Commit + deploy + teste

---

## SPRINT 5 — Abas Novas + Pacote Registradora (3 dias)
**Objetivo:** Interface completa com todas as abas e download do pacote.
**Squad:** Qwen (frontend) + Buchecha (review) + Claude (orquestração)

### Etapa 5.1 — Aba "Documentos Complementares" (D2)
**Arquivo:** `src/app/(erp)/diploma/diplomas/[id]/page.tsx`

**O que fazer:**
1. Expandir tabs de `"dados" | "xmls" | "historico"` para incluir `"documentos" | "acervo"`
2. Design da aba:
   - 3 cards (Histórico PDF, Termo Expedição, Termo Responsabilidade)
   - Cada card: ícone, título, status badge, botões (Gerar / Assinar / Preview / Download)
   - Barra de progresso: 0/3 → 1/3 → 2/3 → 3/3

**Guidelines UX:**
- `state-clarity`: Badge de status com cor + texto
- `loading-buttons`: Spinner no botão durante geração/assinatura
- `submit-feedback`: Toast de sucesso após cada ação
- `primary-action`: Apenas 1 CTA primário por card (o próximo passo lógico)
- `bottom-nav-limit`: Máximo 5 abas — estamos com 5 (Dados, XMLs, Documentos, Acervo, Histórico)

---

### Etapa 5.2 — Aba "Acervo / Digitalização" (D3)
**O que fazer:**
1. Integrar componente `SelecionarDocumentosAcervo` (Sprint 4)
2. Para cada documento selecionado, mostrar pipeline mini:
   ```
   [Original] → [Tratado] → [PDF/A] → [Assinado]
   ```
3. Botão "Editar" que abre EditorImagem em modal/drawer
4. Contagem geral: "X de Y documentos prontos"

---

### Etapa 5.3 — Tela "Pacote para Registradora" (D4)
**Nova rota:** `src/app/api/diplomas/[id]/pacote/route.ts`

**Backend (archiver):**
```bash
npm install archiver @types/archiver
```

```typescript
// GET /api/diplomas/[id]/pacote
//
// Fluxo:
// 1. Verificar checklist completo (todos docs prontos)
// 2. Buscar todos os arquivos do Storage:
//    - 2 XMLs assinados
//    - 3 PDFs assinados (histórico, termos)
//    - N PDFs/A do acervo
// 3. Montar ZIP com archiver:
//    pacote-diploma-{CPF}/
//    ├── xmls/
//    ├── documentos/
//    ├── acervo/
//    └── manifesto.json
// 4. Stream o ZIP como response
```

**Frontend — Seção de Pacote:**
- Checklist visual com todos os itens necessários
- Cada item: ✓ verde (pronto) ou ✗ vermelho (pendente)
- Botão "Baixar Pacote Completo" (só habilitado quando 100%)
- Após download: botão "Marcar como Enviado" que transiciona status

---

### Checklist Sprint 5:
- [ ] Aba "Documentos Complementares" com 3 cards funcionais
- [ ] Aba "Acervo / Digitalização" integrada com editor
- [ ] 5 abas no total sem congestionamento visual
- [ ] API de geração de pacote ZIP funcionando
- [ ] ZIP com estrutura de pastas organizada + manifesto.json
- [ ] Checklist visual completo
- [ ] Botão download habilitado quando 100%
- [ ] Botão "Marcar como Enviado" transiciona status
- [ ] Commit + deploy + teste end-to-end

---

## Resumo Executivo

| Sprint | Dias | Entregas Principais | IAs |
|--------|------|---------------------|-----|
| 1 | 2 | Navegação corrigida + filiações + 7 novos status | Claude + Kimi |
| 2 | 3 | API transição + checklist + pipeline visual 6 fases | DeepSeek + Qwen |
| 3 | 4 | pdf-lib + 3 templates + API geração + API assinatura CMS | Buchecha + Qwen |
| 4 | 5 | Editor imagem + seleção acervo + PDF/A + metadados | Qwen + DeepSeek + Codestral |
| 5 | 3 | 2 abas novas + pacote ZIP + checklist registradora | Qwen + Buchecha |
| **Total** | **17** | **Sistema completo de emissão de diploma** | **Squad completo** |

---

## Pré-requisitos para Iniciar

1. **Acesso Supabase** para executar migrations SQL
2. **BRy CMS** confirmada e configurada (credenciais OAuth2)
3. **Microserviço Docker** rodando (para PDF/A — já existe)
4. **Decisão**: Manter deploy Vercel ou considerar alternativa para Puppeteer (se RVDD precisar mudar)

---

## Próximo Passo

**Começar Sprint 1, Etapa 1.1** — Corrigir navegação.
Posso iniciar agora. É a mudança mais simples (~35 linhas) e mais impactante (desbloqueia todo o fluxo).
