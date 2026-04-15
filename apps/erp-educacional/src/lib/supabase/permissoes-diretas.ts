// =============================================================================
// Data Layer — Permissões Diretas por Pessoa (usuario_permissoes_diretas)
// ERP Educacional FIC
//
// Permite conceder ou bloquear permissões específicas para um usuário,
// sobrepondo (override) as permissões que vêm do papel atribuído.
//
// Regra: DENY prevalece sobre ALLOW, que prevalece sobre o papel.
// =============================================================================

import { createClient } from './server'
import type {
  UsuarioPermissaoDireta,
  UsuarioPermissaoDiretaCreateInput,
} from '@/types/configuracoes'
import { getTenantId } from './rbac'

// ─── Listar permissões diretas de um usuário ─────────────────────────────────

export async function listarPermissoesDiretas(userId: string): Promise<UsuarioPermissaoDireta[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('usuario_permissoes_diretas')
    .select(`
      *,
      permissao:permissoes(
        *,
        modulo:modulos_sistema(*)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erro ao listar permissões diretas: ${error.message}`)

  return (data || []) as UsuarioPermissaoDireta[]
}

// ─── Criar override de permissão direta ──────────────────────────────────────

export async function criarPermissaoDireta(
  input: UsuarioPermissaoDiretaCreateInput,
  atribuidoPor: string
): Promise<UsuarioPermissaoDireta> {
  const supabase = await createClient()
  const tenantId = await getTenantId()

  // Verificar se já existe um override ativo para este user+permissao+tipo
  const { data: existente } = await supabase
    .from('usuario_permissoes_diretas')
    .select('id')
    .eq('user_id', input.user_id)
    .eq('permissao_id', input.permissao_id)
    .eq('tipo', input.tipo)
    .single()

  if (existente) {
    throw new Error(`Já existe um override "${input.tipo}" para esta permissão neste usuário.`)
  }

  const { data, error } = await supabase
    .from('usuario_permissoes_diretas')
    .insert({
      user_id: input.user_id,
      permissao_id: input.permissao_id,
      tenant_id: tenantId,
      tipo: input.tipo,
      motivo: input.motivo || null,
      atribuido_por: atribuidoPor,
      data_inicio: new Date().toISOString(),
      data_fim: input.data_fim || null,
      ativo: true,
    })
    .select(`
      *,
      permissao:permissoes(*, modulo:modulos_sistema(*))
    `)
    .single()

  if (error) throw new Error(`Erro ao criar permissão direta: ${error.message}`)

  return data as UsuarioPermissaoDireta
}

// ─── Revogar (desativar) override de permissão direta ─────────────────────────

export async function revogarPermissaoDireta(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('usuario_permissoes_diretas')
    .update({ ativo: false })
    .eq('id', id)

  if (error) throw new Error(`Erro ao revogar permissão direta: ${error.message}`)
}

// ─── Excluir override de permissão direta ────────────────────────────────────

export async function excluirPermissaoDireta(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('usuario_permissoes_diretas')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Erro ao excluir permissão direta: ${error.message}`)
}
