# Plano de Implementação — Categorização de Pessoas + Controle de Acesso

> ERP Educacional FIC — Módulo Pessoas
> Data: 05/04/2026 | Autor: Claude (Arquiteto)

---

## Visão Geral

Ao clicar em "Nova Pessoa", um diálogo permite escolher uma ou mais categorias (Aluno, Professor, Colaborador). A pessoa é cadastrada já categorizada, com badges coloridas visíveis em toda a interface. Apenas pessoas categorizadas aparecem nas configurações de acesso do sistema.

---

## O que já existe no sistema

| Recurso | Status | Onde |
|---------|--------|------|
| `TipoVinculo` enum | ✅ Existe | `src/types/pessoas.ts` — 7 valores |
| Tabela `pessoa_vinculos` | ✅ Existe | DB — pessoa_id, tipo, status, cargo, data_inicio/fim |
| API `pessoa_vinculos` | ✅ Existe | `/api/pessoas/[id]/vinculos` — GET/POST |
| RBAC completo | ✅ Existe | papéis, permissões, usuario_papeis, diretas |
| Checklist documentos por tipo_vinculo | ✅ Existe | `/api/checklist-documentos?tipo_vinculo=X` |
| Filtro por tipo_vinculo na lista | ✅ Existe | `pessoas/page.tsx` — cards de estatísticas |
| Diálogo de seleção de categoria | ❌ Não existe | Precisa criar |
| Badges coloridas por categoria | ❌ Não existe | Precisa criar |
| Multi-categoria por pessoa | ⚠️ Parcial | DB suporta (N vinculos), mas UI cria só 1 |
| Filtro de acesso por categoria | ❌ Não existe | Precisa vincular ao RBAC |

**Conclusão:** A infraestrutura de banco já suporta multi-categoria via `pessoa_vinculos`. O trabalho é majoritariamente de **UI/UX + lógica de filtro no acesso**.

---

## Arquitetura da Solução

```
┌─────────────────────────────────────────────────────────────┐
│  FLUXO: Nova Pessoa                                          │
│                                                              │
│  [Botão "Nova Pessoa"]                                       │
│       ↓                                                      │
│  ┌──────────────────────────────────┐                       │
│  │  DIÁLOGO: Selecionar Categorias  │                       │
│  │                                  │                       │
│  │  ☑ 🎓 Aluno        (azul)       │                       │
│  │  ☐ 👨‍🏫 Professor   (verde)      │                       │
│  │  ☐ 💼 Colaborador  (laranja)     │                       │
│  │                                  │                       │
│  │  Mínimo 1 categoria obrigatória  │                       │
│  │                                  │                       │
│  │  [ Cancelar ]  [ Continuar → ]   │                       │
│  └──────────────────────────────────┘                       │
│       ↓                                                      │
│  /pessoas/novo?categorias=aluno,professor                   │
│       ↓                                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Nova Pessoa  🎓 Aluno  👨‍🏫 Professor                │   │
│  │  ────────────────────────────────────────────────────│   │
│  │  • Upload de documentos (checklist combinado)        │   │
│  │  • Scanner USB                                       │   │
│  │  • Dados Pessoais                                    │   │
│  │  • Dados Acadêmicos (se Aluno)                       │   │
│  │  • Dados Profissionais (se Professor/Colaborador)    │   │
│  │  • Documentos Específicos por categoria              │   │
│  └──────────────────────────────────────────────────────┘   │
│       ↓                                                      │
│  POST /api/pessoas (cria pessoa + N vínculos)                │
│       ↓                                                      │
│  pessoa_vinculos: [{tipo:'aluno'}, {tipo:'professor'}]       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  CONFIGURAÇÕES DE ACESSO                                     │
│                                                              │
│  Filtro: "Apenas pessoas com vínculo ativo"                  │
│  → Quem NÃO tem nenhum vínculo em pessoa_vinculos            │
│    NÃO aparece na lista de usuários para atribuir acesso     │
│                                                              │
│  Sugestão automática de papel:                               │
│  • Aluno → papel "estudantes"                                │
│  • Professor → papel "coordenacao_curso"                     │
│  • Colaborador → papel "aux_secretaria" (ou custom)          │
└─────────────────────────────────────────────────────────────┘
```

---

## Design de Cores e Badges

| Categoria | Cor | Badge | Ícone | Hex |
|-----------|-----|-------|-------|-----|
| Aluno | Azul | `bg-blue-100 text-blue-700` | 🎓 GraduationCap | #1d4ed8 |
| Professor | Verde | `bg-green-100 text-green-700` | 👨‍🏫 BookOpen | #15803d |
| Colaborador | Laranja | `bg-orange-100 text-orange-700` | 💼 Briefcase | #c2410c |
| Candidato | Roxo | `bg-purple-100 text-purple-700` | 📋 ClipboardList | #7e22ce |
| Ex-Aluno | Cinza | `bg-gray-100 text-gray-600` | 🎓 GraduationCap | #4b5563 |
| Visitante | Rosa | `bg-pink-100 text-pink-700` | 👤 UserCircle | #be185d |
| Prestador | Amarelo | `bg-yellow-100 text-yellow-700` | 🔧 Wrench | #a16207 |

**Múltiplas badges:** aparecem lado a lado no header e na lista:
```
João Silva  🎓 Aluno  👨‍🏫 Professor
```

---

## Fases de Implementação

### FASE 1: Diálogo de Seleção de Categorias (1-2 dias)

**O que fazer:**
1. Criar componente `DialogoCategoriaPessoa.tsx` — modal com checkboxes
2. Modificar `pessoas/page.tsx` — ao clicar "Nova Pessoa", abrir diálogo
3. Passar categorias selecionadas via query params para `/pessoas/novo`
4. Modificar `pessoas/novo/page.tsx` — ler categorias e exibir badges

**Arquivos a criar:**
- `src/components/pessoas/DialogoCategoriaPessoa.tsx`
- `src/components/pessoas/BadgeCategoria.tsx`

**Arquivos a modificar:**
- `src/app/(erp)/pessoas/page.tsx` — adicionar estado do diálogo
- `src/app/(erp)/pessoas/novo/page.tsx` — ler query params, exibir badges

**Dependências:** Nenhuma

---

### FASE 2: Badges e Visual na Lista e Detalhe (1 dia)

**O que fazer:**
1. Componente `BadgeCategoria.tsx` reutilizável (cor, ícone, texto)
2. Na lista de pessoas (`page.tsx`), exibir badges de cada pessoa
3. Na página de detalhe de pessoa, exibir badges no header
4. Permitir adicionar/remover categorias na edição

**Arquivos a criar:**
- `src/components/pessoas/BadgeCategoria.tsx` (se não criado na Fase 1)
- `src/components/pessoas/SeletorCategorias.tsx` (edição inline)

**Arquivos a modificar:**
- `src/app/(erp)/pessoas/page.tsx` — renderizar badges na tabela/cards
- `src/app/(erp)/pessoas/[id]/page.tsx` — exibir e editar categorias

---

### FASE 3: Criação com Vínculos Automáticos (1 dia)

**O que fazer:**
1. Modificar `POST /api/pessoas` para aceitar `categorias: string[]`
2. Ao criar pessoa, inserir automaticamente em `pessoa_vinculos`
3. Carregar checklist combinado (se aluno+professor, mostrar docs de ambos)
4. Seções condicionais no form (Dados Acadêmicos ↔ Aluno, Dados Profissionais ↔ Professor)

**Arquivos a modificar:**
- `src/app/api/pessoas/route.ts` — aceitar e criar vínculos
- `src/app/(erp)/pessoas/novo/page.tsx` — seções condicionais
- `src/app/api/checklist-documentos/route.ts` — aceitar múltiplos tipo_vinculo

---

### FASE 4: Filtro de Acesso por Categoria (1-2 dias)

**O que fazer:**
1. Na página de configuração de usuários, filtrar: **só mostra pessoas com pelo menos 1 vínculo ativo**
2. Adicionar filtro por categoria na tela de RBAC
3. Criar sugestão automática de papel ao vincular acesso:
   - Aluno → papel "estudantes"
   - Professor → papel "coordenacao_curso"
   - Colaborador → papel sugerido pelo admin
4. API: novo endpoint `GET /api/pessoas?com_vinculo=true` para lista filtrada

**Arquivos a modificar:**
- `src/app/(erp)/configuracoes/usuarios/page.tsx` — filtro por categorias
- `src/app/api/pessoas/route.ts` — parâmetro `com_vinculo`
- `src/lib/supabase/rbac.ts` — sugestão de papel

---

### FASE 5: Inteligência e Automação (1-2 dias)

**O que fazer:**
1. Ao categorizar pessoa como Aluno: pré-criar `pessoa_dados_academicos`
2. Ao categorizar como Professor: pré-criar `pessoa_dados_profissionais`
3. IA sugere categoria baseada nos documentos enviados:
   - Se IA detecta histórico escolar → sugere "Aluno"
   - Se IA detecta diploma + Lattes → sugere "Professor"
   - Se IA detecta CTPS → sugere "Colaborador"
4. Atualizar assistente IA com contexto das categorias selecionadas

**Arquivos a modificar:**
- `src/lib/ai/prompts/system-pessoa.ts` — incluir categoria no contexto
- `src/app/(erp)/pessoas/novo/page.tsx` — lógica de sugestão

---

## Cronograma Resumido

| Fase | Entrega | Prazo | Dificuldade |
|------|---------|-------|-------------|
| **F1** | Diálogo + query params + badges no form | 1-2 dias | Fácil |
| **F2** | Badges na lista e detalhe | 1 dia | Fácil |
| **F3** | Vínculos automáticos no POST + checklist combinado | 1 dia | Média |
| **F4** | Filtro de acesso + sugestão de papel | 1-2 dias | Média |
| **F5** | IA + automação + dados condicionais | 1-2 dias | Média |
| **Total** | | **5-9 dias** | |

---

## Arquivos Completos a Criar/Modificar

### Novos (6 arquivos)
```
src/components/pessoas/DialogoCategoriaPessoa.tsx   ← Modal de seleção
src/components/pessoas/BadgeCategoria.tsx            ← Badge reutilizável
src/components/pessoas/SeletorCategorias.tsx         ← Edição inline
src/lib/pessoas/categoria-config.ts                 ← Cores, ícones, labels
src/lib/pessoas/sugerir-categoria.ts                ← IA sugere categoria
docs/PLANO-CATEGORIAS-PESSOAS.md                    ← Este documento
```

### Modificados (8 arquivos)
```
src/app/(erp)/pessoas/page.tsx                      ← Diálogo + badges na lista
src/app/(erp)/pessoas/novo/page.tsx                 ← Ler categorias + seções condicionais
src/app/(erp)/pessoas/[id]/page.tsx                 ← Exibir/editar categorias
src/app/api/pessoas/route.ts                        ← Criar vínculos no POST
src/app/api/checklist-documentos/route.ts           ← Múltiplos tipo_vinculo
src/app/(erp)/configuracoes/usuarios/page.tsx       ← Filtrar por categoria
src/lib/ai/prompts/system-pessoa.ts                 ← Contexto da categoria
src/types/pessoas.ts                                ← Helpers de categoria
```

---

## Skills e Squad para Execução

### Skills
| Skill | Para quê |
|-------|----------|
| **edu-management** | Regras de negócio educacional (aluno, professor, colaborador) |
| **saas-product** | Arquitetura, API design, banco de dados |
| **ui-ux-pro-max** | Design do diálogo, badges, layout responsivo |
| **timexquads-frontend-design** | Componentes React avançados |
| **timexquads-security** | Validar que filtro de acesso é seguro |

### Squad de IAs
| IA | Tarefa |
|----|--------|
| **Claude (Opus)** | Arquitetar, orquestrar, integrar |
| **Qwen** | Componentes React (Diálogo, Badges, Seletor) |
| **DeepSeek** | Lógica SQL, queries de vínculo, filtro no RBAC |
| **Buchecha (MiniMax)** | Code review de cada fase |
| **Kimi** | Debugging se houver bugs |

---

## Decisões Arquiteturais

### 1. Onde armazenar as categorias?
**Decisão: `pessoa_vinculos` (já existe)**
- Não criar tabela nova — usar a que já existe
- Cada categoria = 1 registro em `pessoa_vinculos` com `tipo` e `status='ativo'`
- Multi-categoria = múltiplos registros
- Regra: mínimo 1 vínculo ativo para aparecer no acesso

### 2. Como passar categorias para o formulário?
**Decisão: Query params**
- URL: `/pessoas/novo?categorias=aluno,professor`
- O formulário lê e ajusta (checklist, seções, badges)
- Simples, sem estado global

### 3. Como filtrar no acesso?
**Decisão: JOIN com pessoa_vinculos**
```sql
SELECT p.* FROM pessoas p
INNER JOIN pessoa_vinculos pv ON pv.pessoa_id = p.id
WHERE pv.status = 'ativo'
GROUP BY p.id
```
- Se não tem vínculo ativo → não aparece

### 4. E se remover todas as categorias?
- Pessoa continua existindo, mas "perde acesso"
- Aviso: "Esta pessoa não tem categorias — não aparecerá nas configurações de acesso"
- Soft-block, não hard-delete

---

## Mockup do Diálogo

```
┌────────────────────────────────────────────────┐
│  ╳                                              │
│                                                 │
│  📋 Selecione as Categorias                     │
│                                                 │
│  Escolha uma ou mais categorias para esta       │
│  pessoa. Isso define quais documentos serão     │
│  solicitados e quais acessos poderão ser        │
│  configurados.                                  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ ☑  🎓  Aluno                             │  │
│  │     Matrícula, histórico, notas           │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ ☐  📚  Professor                         │  │
│  │     Docência, currículo, disciplinas      │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ ☐  💼  Colaborador                       │  │
│  │     Administrativo, RH, financeiro        │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│          [ Cancelar ]  [ Continuar → ]          │
│                                                 │
└────────────────────────────────────────────────┘
```

---

## Riscos

| Risco | Probabilidade | Mitigação |
|-------|--------------|-----------|
| Pessoa sem categoria tenta logar | Baixa | Aviso ao admin + bloqueio suave |
| Performance com JOIN nos vínculos | Baixa | Índice em pessoa_vinculos.tipo + status |
| Conflito de checklist (aluno+professor) | Média | Unir checklists sem duplicar docs |
| Migração de dados existentes | Alta | Script para vincular pessoas existentes |

---

## Próximos Passos

Após aprovação deste plano:
1. Começar pela **Fase 1** (diálogo + badges) — resultado visual imediato
2. **Fase 3** em paralelo (API vínculos) — backend pronto
3. Testar com dados reais
4. **Fase 4** (acesso) depende de F1-F3 estarem prontas
5. **Fase 5** (IA) é incremental e pode vir depois
