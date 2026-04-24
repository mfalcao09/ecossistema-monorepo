# 17.2 — Settings > Custom Fields

**URL:** `/settings/fields`

## Estrutura da tela

### Tabs
- **Fields** (default, lista)
- **Folders** (organização hierárquica)
- **Deleted Fields** (papeleira — recuperável)

### Ações header
- `Add Folder` (outline button)
- `+ Add Field` (primary button, gradiente roxo→rosa)
- `⋮` menu (bulk ações? export?)

### Tabela (colunas)
| Coluna | Descrição |
|--------|-----------|
| Checkbox | seleção bulk |
| **Field Name** | display name |
| **Object** | entidade alvo (Contact / Company / Opportunity / Custom Object) |
| **Folder** | organização visual |
| **Unique Key** | chave de interpolação `{{ contact.x }}` com botão copy |
| **Created On** | data + hora (21/04/2026 at 3:55 PM — seeding inicial) |

### Filtros e visualização
- Search box
- Group By: All / Object / Folder (dropdown)
- Page Size: 10 (configurável)
- Pagination: 25 items total no seeding Contact

## Fields default observados (primeira página)

| # | Name | Object | Folder | Unique Key |
|---|------|--------|--------|------------|
| 1 | First Name | Contact | Contact | `{{ contact.first_name }}` |
| 2 | Last Name | Contact | Contact | `{{ contact.last_name }}` |
| 3 | Email | Contact | Contact | `{{ contact.email }}` |
| 4 | Phone | Contact | Contact | `{{ contact.phone }}` |
| 5 | Date Of Birth | Contact | Contact | `{{ contact.date_of_birth }}` |
| 6 | Contact Source | Contact | Contact | `{{ contact.source }}` |
| 7 | Contact Type | Contact | Contact | `{{ contact.type }}` |
| 8 | Business Name | Contact | General Info | `{{ contact.company_name }}` |
| 9 | Street Address | Contact | General Info | `{{ contact.address1 }}` |
| 10 | City | Contact | General Info | `{{ contact.city }}` |
| ... | *(mais 15 até 25 total)* | | | |

## ⭐ Tipos de campo suportados (13 no total)

Captured via modal "+ Add Field":

### Text Input
1. **Single Line** — input `<input type="text">`
2. **Multi Line** — `<textarea>`
3. **Text Box List** — lista de strings (tags/enum free-form?)

### Values
4. **Number** — numérico
5. **Phone** — com country code + validação
6. **Monetary** — currency-aware (BRL, USD, etc)

### Choosing Options
7. **Dropdown (Single)** — select único
8. **Dropdown (Multiple)** — multiselect
9. **Radio Select** — radio group
10. **Checkbox** — boolean
11. **Date Picker** — calendar widget

### Others
12. **File Upload** — attachment
13. **Signature** — canvas de assinatura eletrônica

### Live preview
O modal renderiza o **preview em tempo real** (`<input type="text">` quando Single Line selecionado) → confirma pattern de form-builder visual.

### Workflow de criação
1. Escolher tipo de campo (step atual)
2. `Next` — configurar (nome, unique key, object, folder, validação, default value)
3. Salvar

## Interpolação template-driven

Todos os fields geram automaticamente um **unique key** em sintaxe mustache/Handlebars (`{{ object.field_name }}`). Isso é a **chave da automação template-driven** — qualquer email/SMS/WhatsApp/automation action pode referenciar via essa sintaxe.

Exemplo inferido:
```
Olá {{ contact.first_name }}, sua proposta {{ contact.custom_field_proposal_name }} está aprovada!
```

## Gaps vs Intentus

| Feature | WeSales | Intentus hoje |
|---------|---------|---------------|
| 13 tipos de field | ✅ | ⚠️ (~4 tipos) |
| Template interpolation | ✅ nativa | ❌ |
| Folders pra organizar fields | ✅ | ❌ |
| Deleted Fields (recuperável) | ✅ | ❌ |
| Bulk actions em fields | ✅ | ❌ |
| Live preview no add | ✅ | ❌ |
| Signature field | ✅ | ⚠️ (via BRy separado) |
| Monetary field currency-aware | ✅ | ❌ |

## Implicação pro Intentus

Pattern de **Custom Fields + Template Interpolation** é aposta alta de UX:
- Usuário final (não-dev) pode criar campo novo e já tem acesso em templates
- WeSales monetiza isso (quanto mais workflow de marketing/vendas customizado, mais stickiness)

Sugestão pro Intentus: implementar como addon no atnd-s5 Templates. Usa a mesma API de `Contact` mas expande com `custom_fields JSONB` + resolução via motor de templates (já tem skeleton em atnd-s5).
