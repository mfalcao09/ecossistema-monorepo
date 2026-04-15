---
name: Sprint 6 — Acervo Digital: COMPLETO (sessão 094)
description: Sprint 6 — Acervo Digital: COMPLETO (sessão 094)
type: project
project: erp
tags: ["sprint6", "acervo-digital", "diploma-digital", "pdf-a", "comprobatorios", "pipeline", "s094"]
success_score: 0.95
supabase_id: 454d9f19-661c-4f61-89c7-59dac758a6c7
created_at: 2026-04-15 01:27:27.031373+00
updated_at: 2026-04-15 01:27:27.031373+00
---

Sprint 6 concluído em 15/04/2026. Commit d76b639, deploy Vercel READY (dpl_89vEbauDXmayo2s9GnegqbzZ287Q).

Itens entregues:
6.1 — Migration RPC v3: converter_sessao_em_processo agora tem step 12.5 que insere automaticamente em diploma_documentos_comprobatorios todos os processo_arquivos com destino_acervo=true. DROP da versão 3-args legada (fix 42725). CASE WHEN mapeando tipo_xsd TEXT → enum (9 tipos + fallback Outros). diploma_id=NULL (FK é para documentos_digitais). ON CONFLICT idempotente. Aplicado no Supabase ERP ifdnjieklngcfodmtied.

6.2 — POST /api/diplomas/[id]/acervo/converter: endpoint que dispara conversão PDF/A para todos os comprobatórios pendentes. Usa createAdminClient() (service_role — bucket documentos-pdfa exige). Loop sequencial com obterPdfABase64(). Acumula erros por documento sem interromper. Retorna {total, convertidos, ja_convertidos, erros, mensagem}.

6.3 — Fix verificarEAvancarPacote (carimbo-pipeline.ts): antes avançava para aguardando_envio_registradora pulando Etapa 2. Agora avança para aguardando_documentos. A confirmação do acervo é que avança para aguardando_envio_registradora.

6.4 — GET+PATCH /api/diplomas/[id]/comprobatorios: GET lista DDC com status_pdfa implícito (pendente/convertido/convertido_com_aviso). PATCH {acao: confirmar_comprobatorios} avança status. AbaComprobatoriosMec: componente React com lista de documentos, status icons, botão Converter (fetchSeguro POST), botão Confirmar Acervo (condicional). Inserida antes da AbaAcervoDigital existente.

Problemas resolvidos: 42725 função ambígua (DROP legado), git index.lock bindfs (clone /tmp), npm build timeout (tsc --noEmit), remote URL errada (ERP-Educacional vs diploma-digital).

Próximo: Sprint 7 — Pacote Registradora (G4-G7): ZIP pacote + upload UFMS + retorno XML + status registrado.
