# Análise Completa: Assinaturas Emissora vs Registradora

> **Data:** 2026-03-23
> **Autor:** Claude (Arquiteto) + Buchecha (MiniMax M2.7, Senior Dev)
> **Status:** Análise concluída — aguardando aprovação para execução

---

## 1. Resumo Executivo

A investigação profunda do banco de dados, código-fonte e normas técnicas revelou que o sistema atual **funciona**, mas classifica as assinaturas de forma **imprecisa e frágil**. As 5 assinaturas por diploma estão corretamente ordenadas nos 157 legados, porém o modelo de dados não distingue explicitamente quem é Emissora e quem é Registradora.

**Achados principais:**
- 157 diplomas, TODOS com exatamente 5 assinaturas ✅
- Padrão 100% consistente: 2 emissora + 3 registradora ✅
- Classificação usa CNPJs hardcoded no código — frágil ⚠️
- Tabela `fluxo_assinaturas` NÃO tem coluna `papel` — lacuna crítica ❌
- PFs da emissora e registradora são misturadas como "signatários" no código ❌
- Cargo "responsavel_registro" usado para pessoa da FIC (emissora) — semanticamente incorreto ⚠️

---

## 2. Mapeamento Real das Assinaturas (Banco de Dados)

### 2.1 Instituições cadastradas

| Instituição | Tipo | Código MEC | CNPJ | Papel Real |
|-------------|------|-----------|------|------------|
| Faculdades Integradas de Cassilândia | emissora | 1606 | (sem CNPJ¹) | **EMISSORA** |
| Sociedade Educacional Vale do Apore Ltda | mantenedora_emissora | 1054 | 02.175.672/0001-63 | **MANTENEDORA (assina PJ pela emissora)** |
| Universidade Federal de Mato Grosso do Sul | registradora | 694 | 15461510000133 | **REGISTRADORA** |

> ¹ **PROBLEMA:** FIC não tem CNPJ cadastrado na tabela `instituicoes`. O e-CNPJ usado é da SEVAL (mantenedora).

### 2.2 Assinantes cadastrados

| Ordem | Nome | CPF/CNPJ | Cargo | Instituição | Papel Real |
|-------|------|----------|-------|-------------|------------|
| 1 | Nilza Alves Canguçu | PF | responsavel_registro | SEVAL (mantenedora) | **EMISSORA PF** (inativa) |
| 1 | Aleciana V. Ortega | PF | responsavel_registro | FIC (emissora) | **EMISSORA PF** (inativa) |
| 2 | SEVAL Ltda | PJ (CNPJ) | secretario_decano | SEVAL (mantenedora) | **EMISSORA PJ** |
| 2 | Camila C. B. F. Itavo | PF | reitor_exercicio | UFMS (registradora) | **REGISTRADORA PF** |
| 3 | Nilton Santos Mattos | PF | chefe_registro | UFMS (registradora) | **REGISTRADORA PF** |
| 4 | Marcelo A. S. Turine | PF | reitor | UFMS (registradora) | **REGISTRADORA PF** |
| 5 | Fund. Univ. Fed. MS | PJ (CNPJ) | secretario_decano | UFMS (registradora) | **REGISTRADORA PJ** |

### 2.3 Padrão de Assinatura (157 diplomas — 100% consistente)

```
┌─────────────────────────────────────────────────────────────┐
│                    FASE 1: EMISSORA (FIC)                   │
├─────────────────────────────────────────────────────────────┤
│ Ordem 1  │ PF e-CPF A3  │ Responsável FIC/SEVAL           │
│          │              │ (56x Nilza/SEVAL, 101x Aleciana) │
│ Ordem 2  │ PJ e-CNPJ A3 │ SEVAL (mantenedora) — 157/157   │
├─────────────────────────────────────────────────────────────┤
│          │  ⏳ INTERVALO DE DIAS/SEMANAS (envio → registro) │
├─────────────────────────────────────────────────────────────┤
│                  FASE 2: REGISTRADORA (UFMS)                │
├─────────────────────────────────────────────────────────────┤
│ Ordem 3  │ PF e-CPF A3  │ Nilton (chefe_registro) — 157   │
│ Ordem 4  │ PF e-CPF A3  │ Reitor UFMS — 157               │
│          │              │ (97x Turine, 60x Camila)         │
│ Ordem 5  │ PJ e-CNPJ A3 │ UFMS (CNPJ) — 157/157          │
└─────────────────────────────────────────────────────────────┘
```

**Confirmação temporal:** As datas de assinatura mostram claramente duas fases:
- Ordens 1-2: mesma data/hora (emissora assina tudo de uma vez)
- Ordens 3-5: dias ou semanas depois (registradora processa em lote)

---

## 3. Problemas Identificados

### 3.1 🔴 Crítico: Sem coluna `papel` em `fluxo_assinaturas`

**Situação atual:** A tabela `fluxo_assinaturas` tem apenas: `id, diploma_id, assinante_id, ordem, status, data_assinatura, tipo_certificado, hash_assinatura`

**Problema:** Não há como saber se uma assinatura pertence à emissora ou registradora sem fazer JOIN com `assinantes → instituicoes` e inferir pelo tipo da instituição.

**Impacto:** A UI não consegue separar "Assinaturas da Emissora" de "Assinaturas da Registradora" de forma direta. Todo código que precisa dessa informação faz lógica ad-hoc.

### 3.2 🔴 Crítico: Classificação por CNPJ hardcoded

**Código atual** (`route.ts` linhas 493-513):
```typescript
const CNPJ_SEVAL = "02175672000163";  // Hardcoded!
const CNPJ_UFMS = "15461510000133";   // Hardcoded!
```

**Problema:** Apenas identifica os e-CNPJs (PJs). Todas as PFs caem em "signatários" genéricos, sem distinção emissora/registradora. Se a FIC trocar de mantenedora ou a registradora mudar, o código quebra.

**Confirmado por Buchecha:** "Viola princípio relacional. Se o MEC mudar código, quebra." Recomendação: usar `instituicao_id` ao invés de CNPJ.

### 3.3 🟡 Médio: Cargo "responsavel_registro" para pessoa da emissora

**Situação:** Aleciana Ortega (FIC) tem cargo `responsavel_registro`, mas ela é a pessoa que assina pela **emissora**, não pela registradora.

**Análise de Buchecha:** "O cargo é descritivo, não define papel. O papel vem da instituição que assina. Se Aleciana assina pela FIC, ela é emissora, independente do cargo."

**Conclusão:** O cargo veio do XML legado e não deve ser usado para determinar papel. O `papel` deve ser determinado pela `instituicao_id` do assinante.

### 3.4 🟡 Médio: FIC sem CNPJ na tabela `instituicoes`

A FIC (emissora) não tem CNPJ cadastrado — apenas a SEVAL (mantenedora) tem. Isso é correto do ponto de vista regulatório (quem assina com e-CNPJ é a mantenedora), mas pode causar confusão na exibição.

### 3.5 🟡 Médio: UI não distingue fases de assinatura

A página de detalhes do diploma (`/diploma/diplomas/[id]/page.tsx`) mostra as assinaturas como um pipeline genérico sem separar "Assinaturas da Emissora" de "Assinaturas da Registradora". A informação está lá (ordem + instituição), mas a apresentação não reflete o fluxo real.

### 3.6 🟢 Menor: Wizard de onboarding assume modelo simplificado

O wizard de assinantes (`/diploma/assinantes/page.tsx`) explica que são necessários "pelo menos 3 assinantes", sem distinguir entre assinantes da emissora e da registradora. Para novos diplomas, isso precisa ser mais claro.

---

## 4. Confirmações Técnicas (Normas Oficiais)

### 4.1 Fluxo Emissora → Registradora (Confirmado)

Fontes consultadas: LedgerTec, UFPB, RNP, XSD v1.05

| Etapa | Responsável | O que faz |
|-------|-------------|-----------|
| 1. Prepara dados | FIC (Emissora) | Monta DadosDiploma no DocumentacaoAcademica |
| 2. Assina (PFs) | FIC (Emissora) | e-CPF A3 dos responsáveis sobre DadosDiploma |
| 3. Assina (PJ) | SEVAL (Mantenedora) | e-CNPJ A3 sobre DadosDiploma |
| 4. Envia | FIC (Emissora) | Transmite XMLs assinados para UFMS |
| 5. Valida | UFMS (Registradora) | Verifica dados, cruza com sistema |
| 6. Gera DadosRegistro | UFMS (Registradora) | Livro, número, processo, código validação |
| 7. Assina (PFs) | UFMS (Registradora) | e-CPF A3 sobre DadosRegistro |
| 8. Assina (PJ AD-RA) | UFMS (Registradora) | e-CNPJ A3 AD-RA sobre `<Diploma>` completo |
| 9. Devolve | UFMS (Registradora) | Retorna XML final registrado |

### 4.2 Estrutura de Assinaturas no XML (v1.05)

```xml
<Diploma>
  <DadosDiploma>
    <!-- Assinado pela Emissora: PF(s) + PJ -->
    <ds:Signature>  <!-- PF e-CPF (FIC) -->
    <ds:Signature>  <!-- PJ e-CNPJ (SEVAL) -->
  </DadosDiploma>
  <DadosRegistro>
    <!-- Assinado pela Registradora: PF(s) + PJ -->
    <ds:Signature>  <!-- PF e-CPF (UFMS chefe_registro) -->
    <ds:Signature>  <!-- PF e-CPF (UFMS reitor) -->
  </DadosRegistro>
  <!-- AD-RA final sobre <Diploma> inteiro -->
  <ds:Signature>    <!-- PJ e-CNPJ AD-RA (UFMS) -->
</Diploma>
```

### 4.3 Código de Validação (Confirmado)

| Tipo | Formato | Quem gera |
|------|---------|-----------|
| Diploma | `{eMEC_emissora}.{eMEC_registradora}.{hex12}` | **REGISTRADORA** |
| Histórico | `{eMEC_emissora}.{hex12}` | **EMISSORA** |

**Problema atual:** `montador.ts` gera código no formato `FIC{ano}{13chars}` — ERRADO para diploma (deve ser gerado pela registradora) e formato incorreto para histórico (deveria ser `1606.{hex12}`).

---

## 5. Recomendações de Correção

### 5.1 🔴 P0 — Adicionar coluna `papel` em `fluxo_assinaturas`

```sql
ALTER TABLE fluxo_assinaturas
ADD COLUMN papel TEXT CHECK (papel IN ('emissora', 'registradora'));
```

**Migração dos 157 legados** (100% determinístico porque o padrão é consistente):
```sql
UPDATE fluxo_assinaturas SET papel = 'emissora' WHERE ordem IN (1, 2);
UPDATE fluxo_assinaturas SET papel = 'registradora' WHERE ordem IN (3, 4, 5);
```

### 5.2 🔴 P0 — Substituir CNPJs hardcoded por consulta relacional

**Antes:**
```typescript
const CNPJ_SEVAL = "02175672000163";
const CNPJ_UFMS = "15461510000133";
```

**Depois:**
```typescript
// Buscar instituições pelo tipo
const emissoras = instituicoes.filter(i =>
  i.tipo === 'emissora' || i.tipo === 'mantenedora_emissora'
);
const registradoras = instituicoes.filter(i => i.tipo === 'registradora');

// Classificar por instituicao_id do assinante
for (const ass of assinaturas) {
  const assinante = assinantesPorDoc.get(ass.cpfCnpj);
  if (!assinante) { naoIdentificados.push(ass); continue; }

  const inst = instituicoesPorId.get(assinante.instituicao_id);
  if (inst?.tipo === 'emissora' || inst?.tipo === 'mantenedora_emissora') {
    emissora.push({ ...ass, papel: 'emissora' });
  } else if (inst?.tipo === 'registradora') {
    registradora.push({ ...ass, papel: 'registradora' });
  }
}
```

### 5.3 🟡 P1 — Melhorar exibição na UI

**Página de detalhes do diploma** — separar assinaturas em duas seções:

```
┌──────────────────────────────────────┐
│ 📝 Assinaturas da Emissora (FIC)    │
│                                      │
│  1. Aleciana Ortega (e-CPF A3) ✅    │
│     Responsável · 20/06/2024        │
│  2. SEVAL Ltda (e-CNPJ A3) ✅       │
│     Mantenedora · 20/06/2024        │
│                                      │
│ 📋 Assinaturas da Registradora (UFMS)│
│                                      │
│  3. Nilton Mattos (e-CPF A3) ✅      │
│     Chefe do Registro · 26/06/2024  │
│  4. Marcelo Turine (e-CPF A3) ✅     │
│     Reitor · 08/07/2024             │
│  5. Fund. UFMS (e-CNPJ A3 AD-RA) ✅ │
│     PJ Registradora · 08/07/2024   │
└──────────────────────────────────────┘
```

### 5.4 🟡 P1 — Corrigir geração de código de validação

```typescript
// montador.ts — ANTES (errado):
function gerarCodigoValidacao() {
  return `FIC${ano}${random13}`;  // ❌
}

// DEPOIS:
function gerarCodigoValidacaoHistorico() {
  const hex12 = crypto.randomBytes(6).toString('hex'); // 12 chars hex
  return `1606.${hex12}`;  // ✅ formato correto para histórico
}
// Código do diploma: NÃO GERAR — vem da registradora
```

### 5.5 🟢 P2 — Adicionar CNPJ da FIC

```sql
UPDATE instituicoes
SET cnpj = '02175672000163'  -- Mesmo da SEVAL (mantenedora)
WHERE nome = 'FACULDADES INTEGRADAS DE CASSILÂNDIA' AND ativo = true;
```

> **Nota:** Verificar com Marcelo se FIC tem CNPJ próprio ou usa o da SEVAL.

### 5.6 🟢 P2 — Ferramenta de importação de XMLs registrados

Quando a UFMS devolver os XMLs registrados, o sistema precisa:
1. Receber o XML final (com DadosRegistro + assinaturas da registradora)
2. Extrair: LivroRegistro, NumeroRegistro, Processo, DataRegistro, CodigoValidacao
3. Extrair assinaturas da registradora (ordens 3-5)
4. Atualizar o diploma no banco com dados de registro
5. Gerar a RVDD (PDF visual)
6. Publicar no portal

---

## 6. Pergunta de Buchecha (Respondida)

> "Você tem acesso ao campo `instituicao_id` na tabela `assinantes` para todas as 5 assinaturas por diploma?"

**Sim.** Todas as 7 entradas na tabela `assinantes` têm `instituicao_id` preenchido e corretamente vinculado às instituições. A relação `assinantes → instituicoes` está 100% consistente:

| Assinante | instituicao_id → | Instituição |
|-----------|-----------------|-------------|
| Nilza | → SEVAL (mantenedora_emissora) |
| Aleciana | → FIC (emissora) |
| SEVAL PJ | → SEVAL (mantenedora_emissora) |
| Nilton | → UFMS (registradora) |
| Camila | → UFMS (registradora) |
| Turine | → UFMS (registradora) |
| UFMS PJ | → UFMS (registradora) |

**Conclusão:** A correção dos 157 legados é 100% determinística — não há ambiguidade.

---

## 7. Impacto na Migração v1.06 → v1.05

Esta análise **altera significativamente** o plano de migração aprovado em `ANALISE-MIGRACAO-v106-para-v105.md`:

| Item original | Mudança |
|---------------|---------|
| Gerar 3 XMLs | → Gerar **2 XMLs** (DocumentacaoAcademica + HistoricoEscolar) |
| `gerarDiplomaDigital()` | → **REMOVER** (diploma final é montado pela registradora) |
| `gerarCodigoValidacao()` | → **SÓ para Histórico** (diploma é da registradora) |
| IESRegistradora no gerador | → **REMOVER do gerador** (registradora preenche seus dados) |
| Validador com IESRegistradora | → **REMOVER validação** (não é responsabilidade da emissora) |
| Pipeline: Gerar → Assinar → Publicar | → Gerar → Assinar(emissora) → **Enviar** → Receber(registrado) → RVDD → Publicar |

---

## 8. Checklist de Execução

- [x] **P0:** `ALTER TABLE fluxo_assinaturas ADD COLUMN papel` ✅
- [x] **P0:** Migrar 157 legados (UPDATE por ordem) ✅
- [x] **P0:** Refatorar classificação em `route.ts` — usar `instituicao_id` ✅
- [x] **P1:** Separar assinaturas na UI (emissora vs registradora) ✅
- [x] **P1:** Corrigir `gerarCodigoValidacao()` em `montador.ts` ✅
- [x] **P1:** Remover `gerarDiplomaDigital()` de `gerador.ts` ✅
- [x] **P1:** Corrigir referências v1.06 → v1.05 e "3 XMLs" → "2 XMLs" em toda UI ✅
- [x] **P2:** Preencher CNPJ da FIC em `instituicoes` ✅
- [x] **P2:** Construir ferramenta de importação de XMLs registrados ✅ (`parser-registro.ts` + `importar-registro/route.ts`)
- [x] **P2:** Atualizar wizard de onboarding de assinantes (5 assinaturas: emissora + registradora) ✅
