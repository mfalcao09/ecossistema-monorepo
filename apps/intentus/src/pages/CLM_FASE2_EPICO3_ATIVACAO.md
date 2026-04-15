# CLM Fase 2 — Épico 3: Partes Contratuais e Versionamento

## Resumo

O Épico 3 implementa dois módulos essenciais do CLM:

- **Partes Contratuais**: CRUD completo para gerenciar compradores, vendedores, fiadores, testemunhas e demais envolvidos em cada contrato
- **Versionamento**: Histórico automático de versões com timeline visual, tipo de mudança, campos alterados e links para HTML/PDF

---

## Arquivos Criados

### Hooks
| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useContractParties.ts` | CRUD de partes + busca de pessoas (autocomplete) |
| `src/hooks/useContractVersions.ts` | Listagem e criação de versões com auto-incremento |

### Componentes
| Arquivo | Descrição |
|---------|-----------|
| `src/components/contracts/ContractPartiesManager.tsx` | UI para gerenciar partes: busca de pessoas, seleção de papel, % de participação, rep. legal |
| `src/components/contracts/ContractVersionHistory.tsx` | Timeline visual de versões com ícones, badges, campos alterados e links |

---

## Integração no Detalhe do Contrato

Para usar os dois componentes dentro de uma página de detalhe de contrato:

```tsx
import ContractPartiesManager from "@/components/contracts/ContractPartiesManager";
import ContractVersionHistory from "@/components/contracts/ContractVersionHistory";

// Dentro do JSX:
<ContractPartiesManager contractId={contract.id} />
<ContractVersionHistory contractId={contract.id} />

// Para modo somente leitura:
<ContractPartiesManager contractId={contract.id} readOnly />
```

### Props do ContractPartiesManager
| Prop | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| `contractId` | `string` | Sim | UUID do contrato |
| `readOnly` | `boolean` | Não | Desabilita botões de adicionar/remover (default: false) |

### Props do ContractVersionHistory
| Prop | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| `contractId` | `string` | Sim | UUID do contrato |

---

## Não requer alteração no App.tsx

Os componentes deste épico são utilizados **dentro** de páginas já existentes (detalhe de contrato). Não há novas rotas a adicionar.

---

## Dados Seed Criados

### Pessoas (people)
| Nome | Tipo | CPF/CNPJ |
|------|------|----------|
| João Carlos da Silva | comprador | 123.456.789-00 |
| Maria Fernanda Oliveira | proprietario | 987.654.321-00 |
| Construtora ABC Ltda | cliente (jurídica) | 12.345.678/0001-90 |
| Pedro Henrique Santos | fiador | 456.789.123-00 |
| Ana Paula Rodrigues | comprador | 789.123.456-00 |

### Partes Contratuais (contract_parties)
**Venda Apt 401 – Torre Norte (c...0005)**:
- João Carlos da Silva → Comprador (50%)
- Ana Paula Rodrigues → Comprador (50%)
- Maria Fernanda Oliveira → Vendedor
- Pedro Henrique Santos → Fiador

**Venda Terreno Industrial Lote 15 (c...0006)**:
- Construtora ABC Ltda → Comprador (rep. legal: Roberto Almeida)
- Maria Fernanda Oliveira → Vendedor
- Pedro Henrique Santos → Testemunha
- João Carlos da Silva → Intermediador

### Versões de Contrato (contract_versions)
**Apt 401** (3 versões):
1. v1 — Criação (create): minuta inicial
2. v2 — Edição (edit): ajuste de cláusula de multa
3. v3 — Aprovação (approval): aprovação do jurídico

**Terreno Industrial** (2 versões):
1. v1 — Criação (create): minuta inicial
2. v2 — Edição (edit): inclusão de cláusula ambiental

---

## Funcionalidades dos Hooks

### useContractParties
- `useContractParties(contractId)` — Lista partes com JOIN na tabela `people`
- `useSearchPeople(query)` — Autocomplete por nome, CPF/CNPJ ou e-mail (min 2 chars)
- `useCreateContractParty()` — Cria vínculo (busca tenant_id automaticamente)
- `useUpdateContractParty()` — Atualiza role, % participação, rep. legal
- `useDeleteContractParty()` — Remove vínculo

### useContractVersions
- `useContractVersions(contractId)` — Lista todas as versões (desc por version_number)
- `useLatestContractVersion(contractId)` — Retorna apenas a versão mais recente
- `useCreateContractVersion()` — Cria nova versão com auto-incremento do version_number

---

## Commit Summary

```
feat(clm): add contract parties manager and version history (Épico 3)

- useContractParties: CRUD hook with people search autocomplete
- useContractVersions: version listing and auto-increment creation
- ContractPartiesManager: party management UI with role selection and search
- ContractVersionHistory: visual timeline with change types, badges and links
- Seed data: 5 people, 8 contract_parties, 5 contract_versions

Épico 3 — CLM Fase 2
```
