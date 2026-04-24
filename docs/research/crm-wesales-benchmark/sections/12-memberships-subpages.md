# 12.x — Memberships sub-pages (drill)

## 12.1 — Courses Dashboard (`/memberships/courses/dashboard-v2`)

### Welcome header
"Welcome! / MARCELO S B FALCAO / Last 30 days"

### Sample data banner
"You are viewing sample data. Launch your first course to begin tracking actual data"
CTAs: `Create Course` / `Clear Sample Data` / `Go to Revenue` / `Go to Funnel`

### Insights
- Performance comparison widgets ("Start enrolling learners to atleast two of your courses to see this comparison")
- Funnel integration (CTA "Go to Funnel")
- Revenue tracking (CTA "Go to Revenue")

### Sub-tabs Courses
- Dashboard
- Products (cursos como produtos)
- Offers (bundles)
- Analytics

---

## 12.2 — Communities (`/memberships/communities/community-groups`)

**Headline:** "Community Groups"
**Empty state:** "You don't have a community yet / Connect with others by creating your own community space! Here, you can share insights, discuss ideas, and build connections with people who share your interests."
**CTA:** `Create a Community`

### Interpretação
Modelo **Skool/Circle-style** — comunidades privadas ou públicas com feed, threads, member directory, events. Cross-ref com Courses (community pode ser bundled com course).

---

## 12.3 — Credentials ⭐ (`/memberships/certificates/create-certificates`)

### Understanding Certificates & Badges
Dupla entidade:

#### Certificates
"Give people something to show for completing **big milestones**, like a course, challenge, event, or training. Great for **celebrating progress and building trust**."

#### Badges
"Quick, visual rewards for **smaller wins**, like finishing a lesson, submitting a form, or passing a quiz. Badges keep people engaged and motivated."

### Credentials header
"Create and issue credentials for your members" — CTA `Create`

### Sub-tabs
- **Templates** (design de certificates/badges)
- **Issued Certificates** (ledger de emitidos)

### Cross-ref com FIC
Cross-competição direta com **Diploma Digital FIC** (memory: `project_diploma_digital_fase0`). WeSales oferece certificates + badges nativos enquanto FIC está construindo BRy + Snapshot Imutável. Gap: FIC tem compliance legal (XAdES + BRy HUB Signer) que WeSales não garante. WeSales é **gamificado** (visual), FIC é **jurídico** (legal MEC).

---

## 12.4 — Gokollab Marketplace (`/memberships/gokollab/activation`)

### Headline
"Create Your First Course or Community / Get started by creating your first course or community to engage with your audience"

Toggle: **Courses** / **Community** → `Create`

### Value props "Why GoKollab Courses?"

1. **Create Courses Faster** — "Launch professional courses quickly with easy-to-use tools and templates."
2. **Customize Your Course Experience** — "Add **quizzes, certificates, and drip content**—tailored to your teaching style."
3. **Earn on Your Terms** — "Set your own pricing and control your revenue streams."
4. **Track Performance Easily** — "Get insights with sim[ple analytics]..."

### Interpretação
GoKollab é a **marca da plataforma de cursos** do GHL (branding separado — confirma estratégia multi-brand do vendor). Features destacadas:
- **Drip content** (liberação progressiva)
- **Quizzes** nativos
- **Certificates** emitidos
- **Custom pricing**
- **Analytics**

---

## 12.5 — Branded Mobile App (cross-ref)

Cross-ref com `/funnels-websites/client-portal/branded-app` e `/memberships/client-portal/branded-app`:
- App iOS + Android **whitelabel** para clientes/alunos
- Cliente acessa: courses, community, eventos, agenda, documentos, mensagens
- Relevante pra FIC (app do aluno) / Klésis (app do pais)

---

## Gap summary Memberships

| Feature | WeSales | FIC ERP atual |
|---------|:---:|:---:|
| LMS (Courses) | ✅ GoKollab | ⚠️ básico |
| Community Groups (Skool-style) | ✅ | ❌ |
| **Certificates + Badges** ⭐ | ✅ | ⚠️ (BRy em curso) |
| Drip content | ✅ | ❌ |
| Quizzes em cursos | ✅ | ❌ |
| Branded Mobile App | ✅ | ❌ |
| Marketplace (Gokollab) | ✅ | ❌ |
| Analytics engagement | ✅ | ⚠️ |
| Sample data onboarding | ✅ | ❌ |
