# Modal — Add Contact

**Trigger:** click em botão `+ Add Contact` (topo direito da lista de contatos)
**Tipo de componente:** **Slide-over panel** (drawer do lado direito, ~40% largura)
**Header:** "Add Contact" + botão fechar (×) + link `Customize form ↗` (externaliza pra edição do schema de campos)

## Campos visíveis (acima do fold)

| # | Label | Input | Required | Notas |
|---|-------|-------|----------|-------|
| 1 | **Contact image** | Avatar placeholder + botão edit (lápis) | ❌ | Upload de foto |
| 2 | **First name** | Text input — "Enter First name" | ✅ | Único obrigatório visível |
| 3 | **Last name** | Text input — "Enter Last name" | ❌ | |
| 4 | **Email** | Email input — "Please enter email address" + botão delete (lixeira) | ❌ | Radio indica "primary", `+ Add email` pra múltiplos |
| 5 | **Phone** | Compound: [Select dropdown primary/secondary] + [Country code picker 🇧🇷 BR] + [Phone input] + lixeira | ❌ | `+ Add phone` pra múltiplos |
| 6 | **Contact type** | Select "Select an option" | ❌ | Provável: Lead / Customer / Partner / Vendor |
| 7 | **Time zone** | Select "Select an option" | ❌ | Importante pra appointments |
| 8 | **DND all channels** | Checkbox | ❌ | Opt-out master |

## Botões (bottom bar)
- `Save and add another` — bulk creation flow
- `Cancel`
- **`Save`** (disabled até preencher required)

## Observações de UX

### Slide-over vs Modal
- WeSales usa **drawer lateral** em vez de modal centralizado → mantém contexto da lista visível atrás
- Padrão usado por Linear, Notion, Height. Diferente de Pipedrive (modal centrado)

### Campos compostos inteligentes
- Email e Phone permitem **múltiplos valores** com `+ Add email / + Add phone`
- Phone tem country code picker nativo (não apenas mascara) → suporte multi-país com flag visual
- BR (🇧🇷) detectado como default → localização da conta

### Customize form
Link externo permite editar o schema do form (ordem, campos custom, campos obrigatórios). Integra com Settings > Custom Fields. Nice pattern de **self-service customization**.

### Multi-select para tipo de contato
Indica arquitetura: Contact type é atributo (1 por contato), enquanto Tags são many-to-many (abaixo do fold, provável).

## Campos prováveis abaixo do fold (não capturados)
- Address
- Tags (multiselect)
- Custom fields do usuário
- Assigned to (owner)
- Lead source
- Notes
- Date of birth
- Website/social links

## Código gerador provável (React + Vue? HighLevel é Vue na maioria)
Looking at overall architecture (Vue/Vuex pattern clássico do LeadConnector), o form provavelmente é:
- Schema-driven (campos definidos em JSON em Settings > Custom Fields)
- Validação client-side antes de submit
- API call `POST /api/contacts` com payload JSON

## Comparação de UX (Add Contact)

| Aspecto | WeSales | Pipedrive | HubSpot | Intentus (atual) |
|---------|---------|-----------|---------|-------------------|
| Layout | Slide-over drawer | Modal centrado | Modal centrado | Modal |
| Campos multi-valor | Email + Phone | Phone only | Email + Phone | ❌ |
| Country picker | Nativo c/ flag | Mask | Nativo | ❌ |
| Save and add another | ✅ | ✅ | ⚠️ | ❌ |
| Customize form inline | ✅ (link) | ⚠️ (fora) | ✅ | ❌ |
| Upload avatar | ✅ | ✅ | ✅ | ❌ |
| DND (opt-out) no create | ✅ | ❌ | ⚠️ | ❌ |
