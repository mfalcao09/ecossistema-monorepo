/**
 * Regras de Negócio MEC para Diploma Digital
 * Validações que vão além da estrutura XML
 *
 * Baseado em:
 * - Portaria MEC 554/2019
 * - Portaria MEC 70/2025
 * - IN SESU/MEC 1/2020 e 2/2021
 */

import { DadosDiploma } from '../tipos';

export interface ResultadoRegrasNegocio {
  valido: boolean;
  erros: string[];
  avisos: string[];
}

/**
 * Valida DadosDiploma contra regras de negócio do MEC
 * Deve ser chamada ANTES de gerar o XML
 */
export function validarRegrasNegocio(dados: DadosDiploma): ResultadoRegrasNegocio {
  const erros: string[] = [];
  const avisos: string[] = [];

  // ── 1. Diplomado ──────────────────────────────────────
  const d = dados.diplomado;

  if (!d.ra) erros.push('RA do aluno é obrigatório (campo ID no XSD)');
  if (!d.nome) erros.push('Nome do diplomado é obrigatório');
  if (!d.cpf || d.cpf.replace(/\D/g, '').length !== 11) {
    erros.push('CPF do diplomado deve ter 11 dígitos');
  }
  if (!d.data_nascimento) erros.push('Data de nascimento é obrigatória');
  if (!d.nacionalidade) erros.push('Nacionalidade é obrigatória');

  // Naturalidade — brasileiro precisa de código IBGE
  if (!d.naturalidade_municipio_estrangeiro) {
    if (!d.codigo_municipio_ibge || d.codigo_municipio_ibge.replace(/\D/g, '').length !== 7) {
      erros.push('Código IBGE do município de naturalidade deve ter 7 dígitos');
    }
    if (!d.naturalidade_municipio) erros.push('Município de naturalidade é obrigatório');
    if (!d.naturalidade_uf) erros.push('UF de naturalidade é obrigatória');
  }

  // ── 2. Curso ──────────────────────────────────────────
  const c = dados.curso;

  if (!c.nome) erros.push('Nome do curso é obrigatório');
  if (!c.codigo_emec) erros.push('Código e-MEC do curso é obrigatório');
  if (!c.titulo_conferido) erros.push('Título conferido é obrigatório');
  if (!c.grau_conferido) erros.push('Grau conferido é obrigatório');
  if (!c.modalidade) erros.push('Modalidade é obrigatória (Presencial ou EAD)');

  // Atos regulatórios
  if (!c.autorizacao?.tipo || !c.autorizacao?.numero) {
    erros.push('Ato de Autorização do curso é obrigatório (tipo + número)');
  }
  if (!c.reconhecimento?.tipo || !c.reconhecimento?.numero) {
    erros.push('Ato de Reconhecimento do curso é obrigatório (tipo + número)');
  }

  // Endereço do curso
  if (!c.endereco?.logradouro) erros.push('Endereço do curso é obrigatório');
  if (!c.endereco?.cep) erros.push('CEP do endereço do curso é obrigatório');

  // ── 3. IES Emissora ───────────────────────────────────
  const ies = dados.ies;

  if (!ies.nome) erros.push('Nome da IES emissora é obrigatório');
  if (!ies.codigo_mec) erros.push('Código MEC da IES é obrigatório');
  if (!ies.cnpj || ies.cnpj.replace(/\D/g, '').length !== 14) {
    erros.push('CNPJ da IES deve ter 14 dígitos');
  }
  if (!ies.credenciamento?.tipo || !ies.credenciamento?.numero) {
    erros.push('Ato de Credenciamento da IES é obrigatório');
  }

  // ── 4. Diploma ────────────────────────────────────────
  if (!dados.diploma.id) erros.push('ID do diploma é obrigatório');
  if (!dados.diploma.data_conclusao) erros.push('Data de conclusão é obrigatória');
  if (!dados.diploma.data_colacao_grau) erros.push('Data de colação de grau é obrigatória');
  // Bug #E — fix 2026-04-07 (Onda 2 / Caminho C):
  // `data_expedicao` foi removido do tipo DadosDiploma. A DataExpedicaoDiploma
  // do histórico (TSituacaoFormado) é derivada automaticamente pelo
  // historico.builder.ts via gerarDataExpedicaoXML(). A do diploma só existe
  // dentro de TLivroRegistro e é exclusiva da registradora — a FIC não preenche.

  // ── 5. Histórico ──────────────────────────────────────
  const h = dados.historico;

  if (!h.codigo_curriculo) erros.push('Código do currículo é obrigatório');
  if (!h.data_emissao) erros.push('Data de emissão do histórico é obrigatória');
  if (!h.hora_emissao) erros.push('Hora de emissão do histórico é obrigatória');
  if (!h.data_ingresso) erros.push('Data de ingresso no curso é obrigatória');
  if (!h.forma_acesso) erros.push('Forma de acesso ao curso é obrigatória');

  if (!h.disciplinas || h.disciplinas.length === 0) {
    erros.push('Histórico deve conter ao menos 1 disciplina');
  }

  if (h.carga_horaria_curso <= 0) {
    erros.push('Carga horária do curso deve ser maior que zero');
  }
  if (h.carga_horaria_integralizada <= 0) {
    erros.push('Carga horária integralizada deve ser maior que zero');
  }

  // Validar disciplinas individualmente
  for (let i = 0; i < (h.disciplinas?.length || 0); i++) {
    const disc = h.disciplinas[i];
    if (!disc.codigo) avisos.push(`Disciplina ${i + 1}: código ausente`);
    if (!disc.nome) erros.push(`Disciplina ${i + 1}: nome é obrigatório`);
    if (!disc.carga_horaria || disc.carga_horaria.length === 0) {
      erros.push(`Disciplina ${i + 1} (${disc.nome || 'sem nome'}): carga horária é obrigatória`);
    }
  }

  // ENADE — ao menos 1 registro
  if (!h.enade || h.enade.length === 0) {
    avisos.push('Nenhum registro de ENADE encontrado');
  }

  // Código de validação do histórico
  if (!h.codigo_validacao_historico) {
    erros.push('Código de validação do histórico é obrigatório');
  }

  // ── 6. Filiação (para DocAcadêmica) ───────────────────
  if (!dados.diplomado.filiacao || dados.diplomado.filiacao.length === 0) {
    avisos.push('Filiação não informada — será usado placeholder');
  }

  // ── 7. Assinantes ─────────────────────────────────────
  if (!dados.assinantes || dados.assinantes.length < 2) {
    avisos.push('Mínimo de 2 assinantes recomendado (e-CPF + e-CNPJ)');
  }

  const temECNPJ = dados.assinantes?.some(a => a.tipo_certificado === 'eCNPJ');
  if (!temECNPJ) {
    avisos.push('Nenhum assinante com e-CNPJ encontrado — obrigatório para assinatura');
  }

  return { valido: erros.length === 0, erros, avisos };
}
