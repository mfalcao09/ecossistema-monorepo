import { AgentConfig } from '../types.js';

/** L1 — Quem você é (Art. I: identidade + reporte). */
export function identityLayer(config: AgentConfig): string {
  const businessSuffix = config.business_id
    ? ` da ${config.business_id.toUpperCase()}`
    : '';
  const reports =
    config.reports_to ?? 'Marcelo Silva (CEO) via Claudinho (VP)';

  return `# Você é ${config.name}

${config.title}${businessSuffix}.
${config.description}

Reporta a: ${reports}.`;
}
