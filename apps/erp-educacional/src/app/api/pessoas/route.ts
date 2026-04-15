// =============================================================================
// GET  /api/pessoas   — Lista pessoas com filtros e paginação
// POST /api/pessoas   — Cria nova pessoa
// ERP Educacional FIC
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { verificarAuthComPermissao, erroBadRequest, erroInterno } from '@/lib/security/api-guard'
import { validarCSRF } from '@/lib/security/csrf'
import { listarPessoas, criarPessoa, buscarPessoaPorCPF, getTenantId } from '@/lib/supabase/pessoas'
import { createClient } from '@/lib/supabase/server'
import type { PessoaFiltros, PessoaCreateInput, StatusPessoa, TipoVinculo } from '@/types/pessoas'

// ─── GET /api/pessoas ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await verificarAuthComPermissao(request, 'pessoas', 'acessar')
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)

    const filtros: PessoaFiltros = {
      busca:        searchParams.get('busca')        || undefined,
      status:       (searchParams.get('status') as StatusPessoa)      || undefined,
      tipo_vinculo: (searchParams.get('tipo_vinculo') as TipoVinculo) || undefined,
      grupo_id:     searchParams.get('grupo_id')     || undefined,
      curso_id:     searchParams.get('curso_id')     || undefined,
      pagina:       Number(searchParams.get('pagina'))    || 1,
      por_pagina:   Number(searchParams.get('por_pagina')) || 20,
      ordenar_por:  (searchParams.get('ordenar_por') as PessoaFiltros['ordenar_por']) || 'nome',
      ordem:        (searchParams.get('ordem') as 'asc' | 'desc') || 'asc',
    }

    const resultado = await listarPessoas(filtros)
    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[GET /api/pessoas]', error)
    return erroInterno()
  }
}

// ─── POST /api/pessoas ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await verificarAuthComPermissao(request, 'pessoas', 'inserir')
  if (auth instanceof NextResponse) return auth

  const csrfError = validarCSRF(request)
  if (csrfError) return csrfError

  try {
    const body = await request.json()
    const { categorias, ...pessoaInput } = body as PessoaCreateInput & { categorias?: TipoVinculo[] }

    // Validação básica
    if (!pessoaInput.nome || !pessoaInput.cpf || !pessoaInput.data_nascimento) {
      return erroBadRequest('Nome, CPF e data de nascimento são obrigatórios.')
    }

    // Validar formato CPF
    const cpfLimpo = pessoaInput.cpf.replace(/\D/g, '')
    if (cpfLimpo.length !== 11) {
      return erroBadRequest('CPF deve ter 11 dígitos.')
    }

    // Verificar duplicidade
    const existente = await buscarPessoaPorCPF(pessoaInput.cpf)
    if (existente) {
      return NextResponse.json(
        { erro: 'Registro duplicado.' },
        { status: 409 }
      )
    }

    // Criar a pessoa
    const pessoa = await criarPessoa(pessoaInput)

    // Criar vínculos automáticos baseados nas categorias selecionadas
    if (categorias && categorias.length > 0) {
      const supabase = await createClient()
      const tenantId = await getTenantId()

      const vinculos = categorias.map((tipo: TipoVinculo) => ({
        pessoa_id: pessoa.id,
        tenant_id: tenantId,
        tipo,
        status: 'ativo',
        data_inicio: new Date().toISOString().split('T')[0],
      }))

      const { error: vinculoError } = await supabase
        .from('pessoa_vinculos')
        .insert(vinculos)

      if (vinculoError) {
        console.error('[POST /api/pessoas] Erro ao criar vínculos:', vinculoError)
        // Pessoa já foi criada — não falhar, apenas logar
      }
    }

    return NextResponse.json(pessoa, { status: 201 })
  } catch (error) {
    console.error('[POST /api/pessoas]', error)
    return erroInterno()
  }
}
