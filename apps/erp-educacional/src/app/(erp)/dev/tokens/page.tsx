/**
 * /dev/tokens — QA visual dos design tokens do Módulo Atendimento
 *
 * Referência: PLANO-REFORMULACAO-ATENDIMENTO-FIC.md · Parte 2.2
 * Tokens vêm do benchmark console.nexvy.tech (whitelabel DKW/helenaCRM).
 *
 * Uso: abrir em staging para validar paridade visual com Nexvy antes de S4 começar.
 * Em produção, desabilitar via middleware (rota /dev/*).
 */

export const metadata = {
  title: "Design Tokens — Atendimento FIC",
};

type SwatchProps = {
  name: string;
  hex: string;
  fg?: string;
  width?: string;
};

function Swatch({ name, hex, fg = "#fff", width = "w-full" }: SwatchProps) {
  return (
    <div className="flex flex-col rounded-atnd-md overflow-hidden border border-atnd-border">
      <div
        className={`${width} h-20 flex items-end p-2`}
        style={{ backgroundColor: hex, color: fg }}
      >
        <code className="text-atnd-xs font-mono font-semibold">{hex}</code>
      </div>
      <div className="px-3 py-2 bg-atnd-bg text-atnd-sm">
        <div className="font-semibold text-atnd-text">{name}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-2xl font-bold text-atnd-text mb-1">{title}</h2>
      <div className="h-1 w-12 bg-atnd-primary mb-6 rounded-full" />
      {children}
    </section>
  );
}

export default function TokensPage() {
  return (
    <div className="min-h-screen bg-atnd-bg-subtle p-8 font-atnd text-atnd-text">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <div className="bg-gradient-to-br from-atnd-primary to-[#1E40AF] text-white p-10 rounded-atnd-lg mb-10 shadow-atnd-md">
          <h1 className="text-3xl font-bold mb-2">Design Tokens — Atendimento FIC</h1>
          <p className="text-atnd-md opacity-95">
            Baseline extraído do benchmark Nexvy/DKW · Paridade visual garantida
          </p>
          <div className="mt-5 pt-5 border-t border-white/20 text-atnd-sm opacity-90">
            Referência: <code className="bg-white/20 px-2 py-0.5 rounded">docs/research/nexvy-whitelabel/</code> ·
            {" "}58 vídeos · 1.726 frames · 225 screenshots
          </div>
        </div>

        {/* Primary */}
        <Section title="Cores primárias">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Swatch name="atnd-primary" hex="#345EF3" />
            <Swatch name="atnd-primary-hover" hex="#2B4ECF" />
            <Swatch name="atnd-primary-bg" hex="#EEF1FE" fg="#345EF3" />
          </div>
        </Section>

        {/* Neutros */}
        <Section title="Neutros">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Swatch name="atnd-bg" hex="#FFFFFF" fg="#1D2939" />
            <Swatch name="atnd-bg-subtle" hex="#F5F7FA" fg="#1D2939" />
            <Swatch name="atnd-bg-muted" hex="#F0F2F5" fg="#1D2939" />
            <Swatch name="atnd-border" hex="#E4E7EC" fg="#1D2939" />
            <Swatch name="atnd-border-strong" hex="#D0D5DD" fg="#1D2939" />
            <Swatch name="atnd-text" hex="#1D2939" />
            <Swatch name="atnd-text-muted" hex="#667085" />
            <Swatch name="atnd-text-subtle" hex="#98A2B3" />
          </div>
        </Section>

        {/* Semânticos */}
        <Section title="Semânticos">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Swatch name="atnd-success" hex="#12B76A" />
            <Swatch name="atnd-warning" hex="#F79009" />
            <Swatch name="atnd-danger" hex="#F04438" />
            <Swatch name="atnd-info" hex="#0BA5EC" />
          </div>
        </Section>

        {/* Filas FIC */}
        <Section title="Filas canônicas FIC">
          <div className="grid grid-cols-3 gap-4">
            <Swatch name="queue-secretaria (Secretaria)" hex="#345EF3" />
            <Swatch name="queue-financeiro (Financeiro)" hex="#F79009" />
            <Swatch name="queue-matriculas (Matrículas)" hex="#12B76A" />
          </div>
          <p className="mt-4 text-atnd-sm text-atnd-text-muted">
            Estas cores alimentam os badges de fila (<code>QueueBadge.tsx</code>), bordas de card Kanban e
            indicadores de status no painel direito do chat.
          </p>
        </Section>

        {/* Status atendente */}
        <Section title="Status do atendente">
          <div className="flex gap-8 items-center flex-wrap">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-atnd-status-online shadow-atnd-sm" />
              <span className="text-atnd-sm font-medium">Online</span>
              <code className="text-atnd-xs text-atnd-text-muted">#12B76A</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-atnd-status-paused shadow-atnd-sm" />
              <span className="text-atnd-sm font-medium">Pausado</span>
              <code className="text-atnd-xs text-atnd-text-muted">#F79009</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-atnd-status-offline shadow-atnd-sm" />
              <span className="text-atnd-sm font-medium">Offline</span>
              <code className="text-atnd-xs text-atnd-text-muted">#98A2B3</code>
            </div>
          </div>
        </Section>

        {/* Chat bubbles (preview WhatsApp-like) */}
        <Section title="Chat bubbles (WhatsApp-like)">
          <div className="bg-atnd-bg-muted rounded-atnd-md p-6 max-w-lg">
            {/* Incoming */}
            <div className="flex mb-3">
              <div className="bg-atnd-bubble-in rounded-tr-atnd-md rounded-b-atnd-md shadow-atnd-sm max-w-[70%] p-3">
                <p className="text-atnd-sm text-atnd-text">Olá, gostaria de saber sobre matrícula.</p>
                <time className="text-atnd-xs text-atnd-text-subtle">14:23</time>
              </div>
            </div>
            {/* Outgoing */}
            <div className="flex justify-end">
              <div className="bg-atnd-bubble-out rounded-tl-atnd-md rounded-b-atnd-md shadow-atnd-sm max-w-[70%] p-3">
                <p className="text-atnd-sm text-atnd-text">Oi! Sou da FIC. Posso te ajudar! Qual curso?</p>
                <div className="flex items-center gap-1">
                  <time className="text-atnd-xs text-atnd-text-muted">14:24</time>
                  <span className="text-atnd-primary text-atnd-xs">✓✓</span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Tipografia */}
        <Section title="Tipografia — escala Nexvy (base 14px)">
          <div className="space-y-3 bg-atnd-bg border border-atnd-border rounded-atnd-md p-6">
            <p className="text-atnd-xs"><code className="text-atnd-text-muted">text-atnd-xs (12px)</code> — The quick brown fox jumps</p>
            <p className="text-atnd-sm"><code className="text-atnd-text-muted">text-atnd-sm (13px)</code> — The quick brown fox jumps</p>
            <p className="text-atnd"><code className="text-atnd-text-muted">text-atnd (14px) base</code> — The quick brown fox jumps</p>
            <p className="text-atnd-md"><code className="text-atnd-text-muted">text-atnd-md (15px)</code> — The quick brown fox jumps</p>
            <p className="text-atnd-lg"><code className="text-atnd-text-muted">text-atnd-lg (16px)</code> — The quick brown fox jumps</p>
          </div>
        </Section>

        {/* Raios */}
        <Section title="Border radius">
          <div className="flex gap-4 flex-wrap">
            <div className="w-32 h-24 bg-atnd-primary-bg border-2 border-atnd-primary rounded-atnd-sm flex items-center justify-center">
              <code className="text-atnd-xs">rounded-atnd-sm · 6px</code>
            </div>
            <div className="w-32 h-24 bg-atnd-primary-bg border-2 border-atnd-primary rounded-atnd-md flex items-center justify-center">
              <code className="text-atnd-xs">rounded-atnd-md · 8px</code>
            </div>
            <div className="w-32 h-24 bg-atnd-primary-bg border-2 border-atnd-primary rounded-atnd-lg flex items-center justify-center">
              <code className="text-atnd-xs">rounded-atnd-lg · 10px</code>
            </div>
          </div>
        </Section>

        {/* Sombras */}
        <Section title="Sombras">
          <div className="flex gap-6 flex-wrap">
            <div className="w-40 h-24 bg-atnd-bg rounded-atnd-md shadow-atnd-sm flex items-center justify-center text-atnd-xs">
              shadow-atnd-sm
            </div>
            <div className="w-40 h-24 bg-atnd-bg rounded-atnd-md shadow-atnd-md flex items-center justify-center text-atnd-xs">
              shadow-atnd-md
            </div>
            <div className="w-40 h-24 bg-atnd-bg rounded-atnd-md shadow-atnd-lg flex items-center justify-center text-atnd-xs">
              shadow-atnd-lg
            </div>
          </div>
        </Section>

        {/* Medidas canônicas de layout */}
        <Section title="Medidas de layout">
          <div className="bg-atnd-bg border border-atnd-border rounded-atnd-md overflow-hidden">
            <table className="w-full text-atnd-sm">
              <thead className="bg-atnd-primary-bg border-b-2 border-atnd-primary">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Token</th>
                  <th className="text-left px-4 py-3 font-semibold">Valor</th>
                  <th className="text-left px-4 py-3 font-semibold">Uso</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-atnd-border">
                  <td className="px-4 py-3"><code>w-atnd-sidebar</code></td>
                  <td className="px-4 py-3">245px</td>
                  <td className="px-4 py-3 text-atnd-text-muted">Menu lateral principal</td>
                </tr>
                <tr className="border-b border-atnd-border">
                  <td className="px-4 py-3"><code>w-atnd-list</code></td>
                  <td className="px-4 py-3">320px</td>
                  <td className="px-4 py-3 text-atnd-text-muted">Lista de conversas (painel esquerdo)</td>
                </tr>
                <tr className="border-b border-atnd-border">
                  <td className="px-4 py-3"><code>w-atnd-info</code></td>
                  <td className="px-4 py-3">360px</td>
                  <td className="px-4 py-3 text-atnd-text-muted">Painel direito de contato</td>
                </tr>
                <tr className="border-b border-atnd-border">
                  <td className="px-4 py-3"><code>w-atnd-kanban</code></td>
                  <td className="px-4 py-3">300px</td>
                  <td className="px-4 py-3 text-atnd-text-muted">Largura de coluna Kanban</td>
                </tr>
                <tr>
                  <td className="px-4 py-3"><code>h-atnd-topbar</code></td>
                  <td className="px-4 py-3">56px</td>
                  <td className="px-4 py-3 text-atnd-text-muted">Altura da TopBar</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-atnd-border text-atnd-sm text-atnd-text-muted text-center">
          QA visual · baseline Nexvy · PLANO-REFORMULACAO-ATENDIMENTO-FIC.md
        </footer>
      </div>
    </div>
  );
}
