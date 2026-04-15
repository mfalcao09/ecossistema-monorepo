# Projeto Diploma Digital — FIC

**Status:** Ativo — Em Desenvolvimento (Sessão 010)
**Início:** 19 de março de 2026
**Última atualização:** 26 de março de 2026
**Abordagem:** Caminho Híbrido (core interno + APIs terceiros)

## Status Atual do Sistema (26/03/2026)
- ✅ **ERP estruturado** como multi-módulo (65 tabelas no banco)
- ✅ **Supabase** conectado com `service_role_key` (RLS bypass funcional)
- ✅ **Vercel** hospedando o frontend (Next.js 14) — deploy READY
- ✅ **Tela de login** redesenhada (card escuro, banner/logo do Supabase, vídeo ou imagem)
- ✅ **Cores dinâmicas** via CSS custom properties + ThemeProvider
- ✅ **Dark mode** via `darkMode: 'class'` + ThemeProvider + localStorage cache
- ✅ **TopBar** ampliada (h-[72px], logo maior, título centralizado)
- ✅ **Módulo Diplomados** com CRUD completo (158 diplomados, 157 diplomas)
- ✅ **Portal público** funcionando (diploma.ficcassilandia.com.br)
- ✅ **Módulo Pessoas** (8 tabelas — registro central unificado)
- ✅ **RBAC** completo (10 papéis, 36 módulos, 175 permissões)
- ✅ **Suite de Segurança** (Zod, rate limiting, audit trail, validação — score 8.7/10)
- ✅ **Acervo Digital** (5 tabelas — Portaria MEC 360/2022)
- ✅ **Fluxo de assinaturas** populado (785 registros)
- ✅ **Checklist documentos** (57 itens)
- ✅ **Configurações** expandidas (anos letivos, períodos, calendários, parâmetros)
- ✅ **Squad de 5 IAs** configurado (MiniMax, DeepSeek, Qwen, Kimi, Codestral)

## Objetivo
Criar uma ferramenta completa de publicação de diplomas digitais para a FIC, em conformidade com a Portaria MEC 554/2019, Portaria 70/2025, e Instruções Normativas SESU/MEC 1/2020 e 2/2021.

## Escopo dos Módulos

### 1. Painel Administrativo (Web) — ✅ Implementado
- Cadastro e gestão de diplomados
- Upload/integração de dados acadêmicos
- Acompanhamento do status de cada diploma (pipeline)
- Gestão de signatários (Reitor, Secretário Acadêmico)
- Dashboard com métricas
- RBAC com papéis e permissões granulares

### 2. Motor de Geração XML — Pendente
- Gerar 3 XMLs conforme XSD v1.06 do MEC:
  - DocumentacaoAcademicaRegistro
  - HistoricoEscolarDigital
  - DiplomaDigital
- Validar contra schemas oficiais
- Versionamento de schemas

### 3. Módulo de Assinatura Digital — Pendente
- Integração com API de assinatura ICP-Brasil (certificados A3)
- Orquestração da ordem obrigatória:
  1. Representantes com e-CPF (A3)
  2. IES Emissora com e-CNPJ
  3. IES Emissora com e-CNPJ Arquivamento (AD-RA)
- Carimbo de tempo (TSA credenciada)

### 4. Gerador de RVDD (PDF) — Pendente
- PDF com layout personalizado da FIC
- Anverso: layout visual + código de validação
- Verso: QR Code + URL de verificação
- Template configurável

### 5. Repositório Público — ✅ Implementado
- URL HTTPS para consulta de diplomas (diploma.ficcassilandia.com.br)
- API de verificação (código/QR)
- Armazenamento seguro

### 6. Portal do Diplomado — ✅ Parcial
- Consulta por CPF funcionando
- Visualização de diploma funcionando
- Login seguro — pendente
- Download da RVDD (PDF) — pendente

## Banco de Dados — 65 tabelas
| Área | Tabelas | Dados |
|------|---------|-------|
| Core Diploma | diplomas, diplomados, cursos, assinantes, fluxo_assinaturas | 157 diplomas, 785 assinaturas |
| Pessoas | 8 tabelas (registro central unificado) | Estrutura pronta |
| RBAC | papeis, modulos_sistema, permissoes, etc. | 10 papéis, 175 permissões |
| Acervo Digital | 5 tabelas (Portaria MEC 360/2022) | Estrutura pronta |
| Configurações | anos_letivos, periodos, calendarios, parametros | 4 parâmetros |
| Documentos Digitais | documentos_digitais, log | Engine centralizada |
| Segurança | audit_log, audit_trail, portal_logs | 4.282 registros |
| IA | ia_configuracoes, ia_usage_log | 7 agentes configurados |

## Decisões Técnicas — Status
- ✅ Stack: **Next.js 14 + TypeScript + Tailwind** (frontend) + **Next.js API Routes** (backend)
- ✅ Banco: **Supabase (PostgreSQL)** — 65 tabelas
- ✅ Deploy: **Vercel + Supabase**
- ✅ Dark mode: **`darkMode: 'class'`** via ThemeProvider
- ✅ Segurança: **Zod + Rate Limiting + Audit Trail**
- ✅ RBAC: **Papéis + Permissões granulares por módulo**
- [ ] Fornecedor de API de assinatura digital (BRy, Certisign ou Soluti)
- [ ] Layout visual do diploma da FIC (RVDD)
- [ ] Integração com sistema acadêmico atual da FIC

## Workflow Claude + Squad IAs
- **Claude (Opus 4):** Arquiteto-chefe — orquestra, planeja, revisa e integra
- **Buchecha (MiniMax M2.7):** Líder de codificação, code review, geração em massa
- **DeepSeek (V3.2):** Lógica complexa, debugging, queries SQL
- **Qwen (3-Coder 480B):** Frontend React/Next.js
- **Kimi (K2.5):** Bugs difíceis, fixes
- **Codestral (Mistral):** Code completion, refatoração multi-linguagem
