# Sprint 7 — Documentos do Processo
**Criado em:** 15/04/2026  
**Sessão de abertura:** 095  
**Status:** 🎯 EM EXECUÇÃO  
**Referência:** [PLANO-PIPELINE-END-TO-END.md](PLANO-PIPELINE-END-TO-END.md)

---

## Objetivo
Gerar os documentos necessários para o envio à registradora (UFMS):
- Histórico Escolar em PDF
- Termo de Expedição
- Termo de Registro
- Assinatura digital desses documentos via **BRy api-assinatura-digital**

Ao final desta sprint, o operador terá todos os documentos assinados e prontos para o pacote ZIP (Sprint 8).

---

## Gaps Fechados
| Gap | Descrição |
|-----|-----------|
| G4  | Histórico Escolar em PDF não implementado |
| G5  | Termo de Expedição não implementado |
| G6  | Termo de Registro não implementado |
| G7  | BRy `api-assinatura-digital` não integrada |

---

## Estimativa: 5–7 dias

---

## Items da Sprint

### 7.1 — Histórico Escolar em PDF (G4)
**Abordagem:** Template HTML → Puppeteer (mesmo microserviço Railway)  
**Nova rota Next.js:** `POST /api/documentos/historico-escolar`  
**Nova rota Railway:** `POST /historico-escolar` (Puppeteer)

**Dados do PDF:**
- Cabeçalho institucional FIC (nome, CNPJ, endereço, código MEC)
- Dados do diplomado: nome, CPF, data nascimento, curso, data conclusão
- Tabela de disciplinas: nome, CH, nota/conceito, período
- Rodapé: data de expedição, local, assinatura (placeholder até BRy)

**Fluxo:**
1. Operador clica "Gerar Histórico Escolar" na UI da Etapa 2
2. API Next.js monta o payload e chama Puppeteer no Railway
3. PDF salvo no bucket `documentos-processo/[diploma_id]/historico.pdf`
4. Status: `pendente → gerado → enviado_assinatura → assinado`

**Tabela nova no Supabase:** `diploma_documentos_processo`

---

### 7.2 — Termos de Expedição e Registro (G5, G6)
**Abordagem:** Mesma — templates HTML → Puppeteer  
**Rotas:**
- `POST /api/documentos/termos/expedicao`
- `POST /api/documentos/termos/registro`

**Campos dinâmicos nos templates:**
```
{{nome_diplomado}}, {{cpf}}, {{curso}}, {{habilitacao}}
{{data_conclusao}}, {{data_expedicao}}, {{ies_emissora}}
{{ies_registradora}}, {{numero_registro_livro}}, {{folha}}
```

**Distinção:**
- **Termo de Expedição:** emitido pela FIC — formaliza que o diploma foi expedido
- **Termo de Registro:** acompanha o pacote para a UFMS — confirma o envio para registro

---

### 7.3 — Integração BRy Assinatura Digital (G7)
**API:** `api-assinatura-digital` da BRy (OAuth app **diferente** do api-diploma-digital)

**Variáveis de ambiente a adicionar no Vercel:**
- `BRY_ASSINATURA_CLIENT_ID`
- `BRY_ASSINATURA_CLIENT_SECRET`
- `BRY_ASSINATURA_BASE_URL` (hom vs prod)

**Novo arquivo:** `src/lib/bry/assinatura-digital.ts`  
**Endpoints BRy:**
1. `POST /token` (OAuth2 client_credentials)
2. `POST /documents` (upload do PDF)
3. `POST /documents/{id}/signatures` (solicitar assinatura)
4. Webhook: retorno da confirmação de assinatura

**Webhook endpoint:** `POST /api/webhooks/bry-assinatura`

**Status de cada documento:**
```
pendente → gerado → enviado_assinatura → assinado | erro_assinatura
```

**Signatários (confirmar com FIC antes de implementar):**
- Diretor Geral da FIC
- Coordenador do curso
- Secretário acadêmico

---

### 7.4 — UI de Documentos do Processo
**Onde:** `src/app/(erp)/diploma/diplomas/[id]/page.tsx` → nova aba/seção na Etapa 2

**Cards a exibir:**
- 📄 Histórico Escolar PDF
- 📄 Termo de Expedição
- 📄 Termo de Registro

**Cada card mostra:**
- Status: "Não gerado" / "Gerado" / "Aguardando assinatura" / "Assinado ✓" / "Erro"
- Botão "Gerar" (quando pendente)
- Botão "Enviar para assinatura" (quando gerado)
- Preview/download do PDF assinado

**Gate para Sprint 8:**
Botão "Preparar pacote ZIP" só habilitado quando:
- Acervo confirmado (Sprint 6 ✅)
- Histórico Escolar assinado ✅
- Termo de Expedição assinado ✅
- Termo de Registro assinado ✅

---

## Arquivos a Criar

### Migrations Supabase (ERP: ifdnjieklngcfodmtied)
- `supabase/migrations/20260415_diploma_documentos_processo.sql`
  - Tabela `diploma_documentos_processo`
  - Tabela `diploma_registro_ufms` (preparar para Sprint 8)
  - Buckets: `documentos-processo`, `pacotes-registradora` (preparar para Sprint 8)

### Backend Next.js
- `src/app/api/documentos/historico-escolar/route.ts`
- `src/app/api/documentos/termos/expedicao/route.ts`
- `src/app/api/documentos/termos/registro/route.ts`
- `src/app/api/webhooks/bry-assinatura/route.ts`
- `src/lib/bry/assinatura-digital.ts`

### Templates HTML
- `src/templates/historico-escolar.html`
- `src/templates/termo-expedicao.html`
- `src/templates/termo-registro.html`

### Microserviço Railway (Puppeteer)
- Nova rota `/historico-escolar` no server.js existente
- Nova rota `/termo` (genérico — recebe templateName + dados)

### Frontend
- `src/components/diploma/AbaDocumentosProcesso.tsx` (novo componente)
- Modificar `src/app/(erp)/diploma/diplomas/[id]/page.tsx`

---

## Ordem de Execução Recomendada

```
1. Migration Supabase (tabelas + buckets)
2. Templates HTML (layouts dos documentos)
3. Puppeteer no Railway (rotas /historico-escolar + /termo)
4. APIs Next.js (gerar + salvar PDFs)
5. BRy assinatura-digital.ts (cliente OAuth)
6. Webhook BRy Assinatura
7. UI AbaDocumentosProcesso
8. Integração página diplomas/[id]
9. Testes e deploy
```

---

## Bloqueadores Potenciais
- **Credenciais BRy Assinatura:** `BRY_ASSINATURA_CLIENT_ID` + `BRY_ASSINATURA_CLIENT_SECRET` precisam estar disponíveis no Vercel
- **Templates FIC:** Layouts de Histórico, Termo Expedição e Registro precisam ser fornecidos pela FIC (Marcelo tem os modelos)
- **Signatários:** Confirmar CPF + cargo dos 3 signatários da FIC

---

## Pré-Requisitos (todos ✅)
- Sprint 6 concluída ✅ (acervo digital completo)
- Puppeteer Railway funcionando ✅ (usado para PDF/A)
- BRy api-diploma-digital integrada ✅ (referência para api-assinatura-digital)
- Decisão D1 ✅ (layouts FIC disponíveis)
- Decisão D2 ✅ (contrato BRy ativo)

---

*Criado na Sessão 095 — 15/04/2026*
