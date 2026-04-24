# 05.x — Contacts sub-pages

## 05.1 — Bulk Actions (`/contacts/bulk/actions`)

**Descrição:** "View detailed statistics and progress information for your bulk action request"

Note: **NÃO é a mesma coisa** que as bulk actions na smart list — isto é o **histórico/log** de execuções de bulk.

### Filtros
- All Status
- All Actions

### Colunas
Action Label, Operation, Status, User, Created (PDT), Completed (PDT), **Statistics**, Actions

### Interpretação
Auditoria de bulk operations executadas: quem disparou, quando, quantos items processados, status final (success/failed/partial).

---

## 05.2 — Tasks (`/tasks`)

### Contador
`0 Tasks`

### Tabs por due date
- All (default)
- **Due Today**
- **Overdue**
- **Upcoming**

### Filtros (barra superior)
- Assignee: Any
- Status: All
- Due Date: Any
- Advanced Filters

### Bulk actions
- Mark as done
- Mark as pending
- Delete

### Colunas
Status, Title, Description, **Associated Contacts**, Assignee, **Due Date (PDT)**, Actions

### Page sizes
10 / 20 / 50 / 100

### CTAs
`+ Add Task`, `Manage Fields`, `Sort (1)`

### Interpretação
Gestão de tasks nativa com filtros temporais pré-configurados. Associação com múltiplos contatos (many-to-many). Padrão enterprise CRM.

---

## 05.3 — Companies (`/businesses`)

### Contador
`0 Companies`

### CTAs
- `Import` (CSV)
- `+ Add Company`
- `Advanced Filters`
- `Export`
- `Delete` (bulk)
- `Manage Fields`

### Colunas
**Company Name, Phone, Email, Website, Address, State, City, Description, Postal Code, Country, Created At, Updated At, Created By**

### Interpretação
Entidade B2B separada de Contact. Cada Company pode ter N Contacts associados. Suporta endereço completo + Website. Tracking: Created By (usuário), Created At + Updated At.

Gap Intentus: entidade Company existe apenas em pilots (Intentus Real Estate tem Imóvel + Corretor mas não Company explícita).
