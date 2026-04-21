/**
 * Snapshot Imutável — Fase 2
 *
 * Aplica os valores do snapshot (campos extraídos e consolidados na Fase 1)
 * sobre o objeto DadosDiploma montado pelo montador XML.
 *
 * Princípio: o snapshot é a FONTE ÚNICA DE VERDADE dos dados que vieram da
 * extração (diplomado, curso básico, disciplinas, atividades, estágios,
 * histórico, assinantes). Dados institucionais (atos regulatórios,
 * endereços da IES, códigos e-MEC, etc.) continuam vindo das tabelas
 * normalizadas — essas informações não vêm da extração do diploma.
 *
 * Regra de negócio (Marcelo, 2026-04-22):
 *   "o snapshot consolida os dados da extração"
 *
 * Comportamento:
 *   - Se o diploma TEM snapshot → valores dos campos extraídos são
 *     sobrescritos pelos valores do snapshot (fonte canônica).
 *   - Se o diploma NÃO TEM snapshot (legado) → função é no-op e
 *     retorna o DadosDiploma original das tabelas normalizadas.
 *
 * Campos que vêm do snapshot (quando presente):
 *   • diplomado.{nome, nome_social, cpf, rg_*, data_nascimento, sexo,
 *                nacionalidade, naturalidade_*, ra}
 *   • curso.{nome, grau_conferido, titulo_conferido, modalidade}
 *   • curso.reconhecimento (se snapshot.curso.numero_reconhecimento)
 *   • curso.renovacao_reconhecimento (se snapshot.curso.numero_renovacao)
 *   • diploma.{data_colacao_grau, data_conclusao, segunda_via?}
 *   • historico.{disciplinas, atividades_complementares, estagios,
 *                data_ingresso, forma_acesso, carga_horaria_integralizada,
 *                situacao_discente}
 *   • assinantes (nome, cargo, cpf, ordem)
 *
 * Campos que NUNCA vêm do snapshot (sempre das tabelas):
 *   • ies.* (IES emissora — dados institucionais)
 *   • ies_registradora.* (dados do diploma.registradora_*)
 *   • curso.autorizacao (ato regulatório — tabela atos_curso)
 *   • curso.codigo_emec, codigo_curso, endereco, habilitacoes, enfase
 *   • historico.codigo_validacao_historico (gerado via SHA256 Anexo III)
 *   • historico.codigo_curriculo
 *   • historico.enade (tabela diploma_enade)
 *   • diplomado.filiacao (tabela filiacoes)
 *   • diplomado.codigo_municipio_ibge (tabela diplomados)
 *   • historico.carga_horaria_curso (tabela cursos)
 */

import type {
  DadosDiploma,
  Disciplina,
  AtividadeComplementar,
  Estagio,
  Assinante,
  AtoRegulatorio,
  CargaHorariaComEtiqueta,
  CargaHorariaRelogioComEtiqueta,
  DocenteInfo,
  TFormaAcesso,
} from '../xml/tipos'
import type { DadosSnapshot, SnapshotDisciplina } from './snapshot'

/**
 * Aplica os valores do snapshot sobre o DadosDiploma montado das tabelas.
 * Retorna um novo objeto (não muta o original).
 *
 * Se snapshot é null/undefined, retorna dados inalterado.
 */
export function aplicarSnapshotSobreDadosDiploma(
  dados: DadosDiploma,
  snapshot: DadosSnapshot | null | undefined,
): DadosDiploma {
  if (!snapshot) return dados

  // Deep clone defensivo — garante que não mutamos o objeto original
  // nem o snapshot.
  const out: DadosDiploma = JSON.parse(JSON.stringify(dados))

  // ── Diplomado — campos extraídos do documento ────────────────
  const s_dip = snapshot.diplomado
  if (s_dip) {
    out.diplomado.nome = s_dip.nome || out.diplomado.nome
    if (s_dip.nome_social !== undefined) {
      out.diplomado.nome_social = s_dip.nome_social ?? undefined
    }
    if (s_dip.cpf) out.diplomado.cpf = s_dip.cpf
    if (s_dip.data_nascimento) out.diplomado.data_nascimento = s_dip.data_nascimento
    if (s_dip.sexo) {
      const sx = s_dip.sexo.trim().toUpperCase()
      if (sx === 'M' || sx === 'F') {
        out.diplomado.sexo = sx
      }
    }
    if (s_dip.nacionalidade) out.diplomado.nacionalidade = s_dip.nacionalidade
    if (s_dip.naturalidade_municipio) {
      out.diplomado.naturalidade_municipio = s_dip.naturalidade_municipio
    }
    if (s_dip.naturalidade_uf) out.diplomado.naturalidade_uf = s_dip.naturalidade_uf
    if (s_dip.rg_numero !== undefined) {
      out.diplomado.rg_numero = s_dip.rg_numero ?? undefined
    }
    if (s_dip.rg_orgao !== undefined) {
      out.diplomado.rg_orgao_expedidor = s_dip.rg_orgao ?? undefined
    }
    if (s_dip.rg_uf !== undefined) {
      out.diplomado.rg_uf = s_dip.rg_uf ?? undefined
    }
    if (s_dip.matricula) out.diplomado.ra = s_dip.matricula
  }

  // ── Curso — campos básicos (o resto continua das tabelas) ────
  const s_cur = snapshot.curso
  if (s_cur) {
    if (s_cur.nome) out.curso.nome = s_cur.nome
    if (s_cur.grau) out.curso.grau_conferido = s_cur.grau
    if (s_cur.titulo_conferido) out.curso.titulo_conferido = s_cur.titulo_conferido
    if (s_cur.modalidade) {
      const m = s_cur.modalidade.toLowerCase()
      out.curso.modalidade = m.includes('ead') ? 'EAD' : 'Presencial'
    }

    // Reconhecimento — se o snapshot tem número, substitui
    if (s_cur.numero_reconhecimento) {
      const ato: AtoRegulatorio = {
        tipo: s_cur.tipo_reconhecimento || 'Portaria',
        numero: s_cur.numero_reconhecimento,
        data: s_cur.data_reconhecimento || out.curso.reconhecimento?.data || '',
        data_publicacao: s_cur.dou_reconhecimento || out.curso.reconhecimento?.data_publicacao,
      }
      // Preserva campos não-snapshotados (veículo, seção, página) do ato original
      if (out.curso.reconhecimento) {
        ato.veiculo_publicacao = out.curso.reconhecimento.veiculo_publicacao
        ato.secao_publicacao = out.curso.reconhecimento.secao_publicacao
        ato.pagina_publicacao = out.curso.reconhecimento.pagina_publicacao
        ato.numero_dou = out.curso.reconhecimento.numero_dou
      }
      out.curso.reconhecimento = ato
    }

    // Renovação — idem
    if (s_cur.numero_renovacao) {
      const ato: AtoRegulatorio = {
        tipo: s_cur.tipo_renovacao || 'Portaria',
        numero: s_cur.numero_renovacao,
        data: s_cur.data_renovacao || out.curso.renovacao_reconhecimento?.data || '',
      }
      if (out.curso.renovacao_reconhecimento) {
        ato.veiculo_publicacao = out.curso.renovacao_reconhecimento.veiculo_publicacao
        ato.data_publicacao = out.curso.renovacao_reconhecimento.data_publicacao
        ato.secao_publicacao = out.curso.renovacao_reconhecimento.secao_publicacao
        ato.pagina_publicacao = out.curso.renovacao_reconhecimento.pagina_publicacao
        ato.numero_dou = out.curso.renovacao_reconhecimento.numero_dou
      }
      out.curso.renovacao_reconhecimento = ato
    }
  }

  // ── Dados do diploma (datas, segunda via) ────────────────────
  const s_da = snapshot.dados_academicos
  if (s_da) {
    if (s_da.data_colacao_grau) out.diploma.data_colacao_grau = s_da.data_colacao_grau
    if (s_da.data_conclusao) out.diploma.data_conclusao = s_da.data_conclusao
  }

  // ── Histórico — disciplinas, atividades, estágios, ingresso ──
  if (s_da) {
    if (s_da.data_ingresso) out.historico.data_ingresso = s_da.data_ingresso
    if (s_da.forma_acesso) {
      out.historico.forma_acesso = mapearFormaAcesso(s_da.forma_acesso)
    }
    if (s_da.carga_horaria_integralizada != null) {
      out.historico.carga_horaria_integralizada = s_da.carga_horaria_integralizada
    }
    // situacao_discente — data_conclusao/colacao já vêm do snapshot
    out.historico.situacao_discente = {
      tipo: 'Formado',
      data_conclusao: s_da.data_conclusao || out.historico.situacao_discente.data_conclusao,
      data_colacao_grau:
        s_da.data_colacao_grau || out.historico.situacao_discente.data_colacao_grau,
    }
  }

  // Disciplinas — sobrescreve inteiro se snapshot tem lista
  if (Array.isArray(snapshot.disciplinas) && snapshot.disciplinas.length > 0) {
    out.historico.disciplinas = snapshot.disciplinas.map(snapshotDisciplinaParaDadosDiploma)
  }

  // Atividades complementares — sobrescreve inteiro
  if (Array.isArray(snapshot.atividades_complementares)) {
    const ativs: AtividadeComplementar[] = snapshot.atividades_complementares.map(
      (a, idx): AtividadeComplementar => ({
        codigo: `AC-${String(idx + 1).padStart(3, '0')}`,
        data_inicio: a.data_inicio || '',
        data_fim: a.data_fim || '',
        tipo: a.tipo || 'Outras',
        descricao: a.descricao || undefined,
        carga_horaria_relogio: [
          { valor: a.carga_horaria_relogio ?? 0 } as CargaHorariaRelogioComEtiqueta,
        ],
        docentes_validacao: [],
      }),
    )
    out.historico.atividades_complementares = ativs.length > 0 ? ativs : undefined
  }

  // Estágios — sobrescreve inteiro
  if (Array.isArray(snapshot.estagios)) {
    const esgs: Estagio[] = snapshot.estagios.map((e, idx): Estagio => ({
      codigo_unidade_curricular: `ES-${String(idx + 1).padStart(3, '0')}`,
      data_inicio: e.data_inicio || '',
      data_fim: e.data_fim || '',
      carga_horaria_relogio: [
        { valor: e.carga_horaria ?? 0 } as CargaHorariaRelogioComEtiqueta,
      ],
      docentes_orientadores: [],
    }))
    out.historico.estagios = esgs.length > 0 ? esgs : undefined
  }

  // ── Assinantes — sobrescreve só se snapshot tem lista não-vazia ──
  // Atenção: `Assinante` no tipo XML tem campos (`tipo_certificado`,
  // `ordem_assinatura`) que NÃO estão no snapshot. Preservamos os dados
  // da lista original (tabela `assinantes`) para esses campos e só
  // sobrescrevemos nome/cpf/cargo com os valores do snapshot por ordem.
  if (Array.isArray(snapshot.assinantes) && snapshot.assinantes.length > 0) {
    const originais = [...out.assinantes].sort(
      (a, b) => (a.ordem_assinatura ?? 0) - (b.ordem_assinatura ?? 0),
    )
    const doSnap = [...snapshot.assinantes].sort(
      (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0),
    )

    out.assinantes = doSnap.map((snap, idx): Assinante => {
      const original = originais[idx]
      return {
        nome: snap.nome || original?.nome || '',
        cpf: snap.cpf || original?.cpf || '',
        cargo: snap.cargo || original?.cargo || '',
        tipo_certificado:
          original?.tipo_certificado ??
          (snap.cpf ? 'eCPF' : 'eCNPJ'),
        ordem_assinatura: snap.ordem ?? original?.ordem_assinatura ?? idx + 1,
      }
    })
  }

  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Converte SnapshotDisciplina → Disciplina (formato XSD) */
function snapshotDisciplinaParaDadosDiploma(d: SnapshotDisciplina): Disciplina {
  // Carga horária: se tem aula, adiciona; se tem relógio, adiciona; se nenhum, default 0 relógio
  const cargaHoraria: CargaHorariaComEtiqueta[] = []
  if (d.carga_horaria_aula != null) {
    cargaHoraria.push({ tipo: 'HoraAula', valor: d.carga_horaria_aula })
  }
  if (d.carga_horaria_relogio != null) {
    cargaHoraria.push({ tipo: 'HoraRelogio', valor: d.carga_horaria_relogio })
  }
  if (cargaHoraria.length === 0) {
    cargaHoraria.push({ tipo: 'HoraRelogio', valor: 0 })
  }

  // Docentes — normaliza titulação para o enum TTitulacao do XSD
  const docentes: DocenteInfo[] = d.docente_nome
    ? [{
        nome: d.docente_nome,
        titulacao: normalizarTitulacao(d.docente_titulacao),
      }]
    : []

  // Situação — normaliza para os 3 valores do XSD
  let situacao: 'Aprovado' | 'Pendente' | 'Reprovado' = 'Aprovado'
  const s = (d.situacao || '').toLowerCase()
  if (s.includes('reprov')) situacao = 'Reprovado'
  else if (s.includes('curs') || s.includes('pendente') || s.includes('tranc')) situacao = 'Pendente'

  // Forma integralização — só aceita valores do XSD
  const formaIntegralizacaoMap: Record<string, 'Cursado' | 'Aproveitamento' | 'Dispensa'> = {
    cursado: 'Cursado',
    aproveitamento: 'Aproveitamento',
    aproveitado: 'Aproveitamento',
    dispensado: 'Dispensa',
    dispensa: 'Dispensa',
  }
  const fiKey = (d.forma_integralizacao || '').toLowerCase()
  const formaIntegralizacao =
    situacao === 'Aprovado'
      ? formaIntegralizacaoMap[fiKey] || 'Cursado'
      : undefined

  // Nota no snapshot é string ("8.50"); Disciplina.nota no XSD é number.
  // parseFloat com fallback (NaN → undefined) garante tipo correto.
  let notaNum: number | undefined
  if (d.nota) {
    const n = parseFloat(String(d.nota).replace(',', '.'))
    notaNum = Number.isFinite(n) ? n : undefined
  }

  return {
    codigo: d.codigo || '',
    nome: d.nome,
    periodo_letivo: d.periodo || '',
    carga_horaria: cargaHoraria,
    nota: notaNum,
    conceito: d.conceito || undefined,
    situacao,
    forma_integralizacao: formaIntegralizacao,
    docentes,
  }
}

/** Normaliza titulação de docente para o enum TTitulacao do XSD v1.05 */
function normalizarTitulacao(
  raw: string | null | undefined,
): 'Graduação' | 'Tecnólogo' | 'Especialização' | 'Mestrado' | 'Doutorado' {
  if (!raw) return 'Graduação'
  const s = raw.toLowerCase().trim()
  if (s.includes('douto')) return 'Doutorado'
  if (s.includes('pos-doc') || s.includes('pós-doc') || s.includes('pós doc')) return 'Doutorado'
  if (s.includes('mestr')) return 'Mestrado'
  if (s.includes('especiali') || s.includes('especialização') || s.includes('pós') || s.includes('pos-grad') || s.includes('pós-grad') || s.includes('mba')) return 'Especialização'
  if (s.includes('tecnó') || s.includes('tecno')) return 'Tecnólogo'
  if (s.includes('gradu') || s.includes('bachar') || s.includes('licen')) return 'Graduação'
  return 'Graduação'
}

/** Normaliza string de forma de acesso para o enum do XSD */
function mapearFormaAcesso(raw: string | null | undefined): TFormaAcesso {
  if (!raw) return 'Vestibular'
  const s = raw.toLowerCase().trim()
  if (s.includes('enem')) return 'Enem'
  if (s.includes('vestibular')) return 'Vestibular'
  if (s.includes('seriada') || s.includes('paes')) return 'Avaliação Seriada'
  if (s.includes('simplificada')) return 'Seleção Simplificada'
  if (s.includes('bi') || s.includes('li') || s.includes('egresso')) return 'Egresso BI/LI'
  if (s.includes('pec-g') || s.includes('pec g') || s.includes('pecg')) return 'PEC-G'
  if (s.includes('ex officio') || s.includes('transferência')) return 'Transferência Ex Officio'
  if (s.includes('judicial')) return 'Decisão judicial'
  if (s.includes('remanescente')) return 'Seleção para Vagas Remanescentes'
  if (s.includes('programa especial')) return 'Seleção para Vagas de Programas Especiais'
  return 'Vestibular'
}
