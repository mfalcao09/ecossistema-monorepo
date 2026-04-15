/**
 * ParcelamentoCRI.tsx — Consulta e Registro de Matrículas CRI
 *
 * Sessão 145 — Bloco H Sprint 5 — US-133
 * Edge Function: cri-matricula v1
 *
 * Funcionalidades:
 *  - Consulta manual de matrícula (número + cartório)
 *  - Validação de formato + detecção de duplicatas
 *  - Registro de matrícula com dados proprietário
 *  - Listagem de matrículas por desenvolvimento
 *  - Exibição de averbações (divisão, desmembramento) e ônus (hipoteca, penhora)
 */

import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  FileText,
  User,
  Building2,
  MapPin,
  ClipboardList,
  Lock,
} from "lucide-react";
import type { MatriculaRecord, AverbacaoItem, OnusItem } from "@/lib/parcelamento/cri-matricula-types";

/**
 * Formata CPF/CNPJ
 */
function formatCpfCnpj(value: string | null | undefined): string {
  if (!value) return "—";
  const clean = value.replace(/\D/g, "");
  if (clean.length === 11) {
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
  }
  if (clean.length === 14) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`;
  }
  return value;
}

/**
 * Formata data ISO para DD/MM/YYYY
 */
function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
}

/**
 * Formata área em m²
 */
function formatArea(area: number | null | undefined): string {
  if (!area) return "—";
  return `${area.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m²`;
}

/**
 * Card de Matrícula
 */
function MatriculaCard({ matricula }: { matricula: MatriculaRecord }) {
  const statusColors: Record<string, string> = {
    ativo: "bg-green-100 text-green-800",
    cancelado: "bg-red-100 text-red-800",
    extinto: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-semibold text-gray-900">Matrícula: {matricula.numero_matricula}</p>
              <p className="text-sm text-gray-600">{matricula.cartorio_nome}</p>
            </div>
          </div>
        </div>
        <Badge className={statusColors[matricula.status] || "bg-gray-100 text-gray-800"}>
          {matricula.status.charAt(0).toUpperCase() + matricula.status.slice(1)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
          <div>
            <p className="text-gray-600">Comarca</p>
            <p className="font-medium text-gray-900">{matricula.comarca}, {matricula.uf}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <User className="w-4 h-4 text-gray-500 mt-0.5" />
          <div>
            <p className="text-gray-600">Proprietário</p>
            <p className="font-medium text-gray-900">{matricula.proprietario_nome}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Building2 className="w-4 h-4 text-gray-500 mt-0.5" />
          <div>
            <p className="text-gray-600">Área</p>
            <p className="font-medium text-gray-900">{formatArea(matricula.area_terreno_m2)}</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <ClipboardList className="w-4 h-4 text-gray-500 mt-0.5" />
          <div>
            <p className="text-gray-600">Registro</p>
            <p className="font-medium text-gray-900">{formatDateBR(matricula.data_registro)}</p>
          </div>
        </div>
      </div>

      {matricula.proprietario_cpf_cnpj && (
        <p className="text-sm text-gray-600">
          CPF/CNPJ: <span className="font-mono">{formatCpfCnpj(matricula.proprietario_cpf_cnpj)}</span>
        </p>
      )}

      {matricula.averbacoes && matricula.averbacoes.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-sm font-semibold text-gray-900 mb-2">Averbações ({matricula.averbacoes.length})</p>
          <div className="space-y-2">
            {matricula.averbacoes.map((av: AverbacaoItem) => (
              <div key={av.id} className="text-xs bg-amber-50 border border-amber-200 rounded p-2">
                <p className="font-medium text-amber-900">{av.tipo.toUpperCase()}: {av.numero_averbacao}</p>
                <p className="text-amber-800">{av.descricao}</p>
                <p className="text-amber-700">{formatDateBR(av.data)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {matricula.onus && matricula.onus.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-sm font-semibold text-gray-900 mb-2">Ônus Gravames ({matricula.onus.length})</p>
          <div className="space-y-2">
            {matricula.onus.map((on: OnusItem) => (
              <div key={on.id} className="text-xs bg-red-50 border border-red-200 rounded p-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-red-900">{on.tipo.toUpperCase()}: {on.numero_onus}</p>
                    <p className="text-red-800">{on.credor_nome}</p>
                    <p className="text-red-800">{on.descricao}</p>
                  </div>
                  {on.data_liberacao && (
                    <Badge variant="outline" className="text-green-700 border-green-300">
                      Liberado {formatDateBR(on.data_liberacao)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {matricula.observacoes && (
        <p className="text-sm text-gray-600 border-t pt-3">
          Observações: <span className="font-medium">{matricula.observacoes}</span>
        </p>
      )}
    </div>
  );
}

/**
 * Tab principal: ParcelamentoCRI
 */
export default function ParcelamentoCRI() {
  const { developmentId } = useParams<{ developmentId: string }>();

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [matriculas, setMatriculas] = useState<MatriculaRecord[]>([]);
  const [totalMatriculas, setTotalMatriculas] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    is_valid: boolean;
    format_ok: boolean;
    duplicated: boolean;
    message: string;
  } | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    numero_matricula: "",
    cartorio_nome: "",
    cartorio_codigo: "",
    comarca: "",
    uf: "SP",
    proprietario_nome: "",
    proprietario_cpf_cnpj: "",
    area_terreno_m2: "",
    data_registro: "",
    observacoes: "",
  });

  /**
   * Carrega matrículas do desenvolvimento
   */
  const loadMatriculas = useCallback(async () => {
    if (!developmentId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: invokeErr } = await supabase.functions.invoke("cri-matricula", {
        body: {
          action: "list_matriculas",
          params: {
            development_id: developmentId,
            only_active: false,
            limit: 50,
            offset: 0,
          },
        },
      });

      if (invokeErr) {
        setError(invokeErr.message || "Erro ao carregar matrículas");
        return;
      }

      if (result?.error) {
        setError(result.error?.message || "Erro ao carregar matrículas");
        return;
      }

      setMatriculas(result?.data?.matriculas || []);
      setTotalMatriculas(result?.data?.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [developmentId]);

  /**
   * Valida matrícula
   */
  const handleValidate = useCallback(async () => {
    if (!developmentId) return;
    if (!formData.numero_matricula || !formData.cartorio_codigo) {
      setError("Preencha número da matrícula e código do cartório");
      return;
    }

    setValidating(true);
    setError(null);
    setValidationResult(null);

    try {
      const { data: result, error: invokeErr } = await supabase.functions.invoke("cri-matricula", {
        body: {
          action: "validate_matricula",
          params: {
            numero_matricula: formData.numero_matricula,
            cartorio_codigo: formData.cartorio_codigo,
            development_id: developmentId,
          },
        },
      });

      if (invokeErr) {
        setError(invokeErr.message || "Erro na validação");
        return;
      }

      if (result?.error) {
        setError(result.error?.message || "Erro na validação");
        return;
      }

      setValidationResult(result?.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setValidating(false);
    }
  }, [developmentId, formData.numero_matricula, formData.cartorio_codigo]);

  /**
   * Registra matrícula
   */
  const handleRegister = useCallback(async () => {
    if (!developmentId) return;
    if (!formData.numero_matricula || !formData.cartorio_codigo) {
      setError("Preencha número da matrícula e código do cartório");
      return;
    }
    if (!formData.proprietario_nome || !formData.area_terreno_m2 || !formData.data_registro) {
      setError("Preencha todos os campos obrigatórios");
      return;
    }

    setRegistering(true);
    setError(null);

    try {
      const { data: result, error: invokeErr } = await supabase.functions.invoke("cri-matricula", {
        body: {
          action: "register_matricula",
          params: {
            development_id: developmentId,
            numero_matricula: formData.numero_matricula,
            cartorio_nome: formData.cartorio_nome,
            cartorio_codigo: formData.cartorio_codigo,
            comarca: formData.comarca,
            uf: formData.uf,
            proprietario_nome: formData.proprietario_nome,
            proprietario_cpf_cnpj: formData.proprietario_cpf_cnpj || undefined,
            area_terreno_m2: parseFloat(formData.area_terreno_m2),
            data_registro: formData.data_registro,
            observacoes: formData.observacoes || undefined,
          },
        },
      });

      if (invokeErr) {
        setError(invokeErr.message || "Erro ao registrar matrícula");
        return;
      }

      if (result?.error) {
        setError(result.error?.message || "Erro ao registrar matrícula");
        return;
      }

      setSuccess("Matrícula registrada com sucesso!");
      setFormData({
        numero_matricula: "",
        cartorio_nome: "",
        cartorio_codigo: "",
        comarca: "",
        uf: "SP",
        proprietario_nome: "",
        proprietario_cpf_cnpj: "",
        area_terreno_m2: "",
        data_registro: "",
        observacoes: "",
      });
      setShowForm(false);
      setValidationResult(null);

      // Reload matriculas
      await loadMatriculas();

      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setRegistering(false);
    }
  }, [developmentId, formData, loadMatriculas]);

  // Load on mount
  if (matriculas.length === 0 && !loading && totalMatriculas === 0) {
    loadMatriculas();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cartório de Registro de Imóveis (CRI)</h2>
          <p className="text-gray-600 mt-1">Consulta e registro de matrículas de propriedades</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
          variant={showForm ? "outline" : "default"}
        >
          <Plus className="w-4 h-4" />
          {showForm ? "Cancelar" : "Nova Matrícula"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {showForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Registrar Nova Matrícula</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número Matrícula *</label>
              <Input
                value={formData.numero_matricula}
                onChange={(e) => setFormData({ ...formData, numero_matricula: e.target.value })}
                placeholder="Ex: 12345 ou 123456"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código Cartório *</label>
              <Input
                value={formData.cartorio_codigo}
                onChange={(e) => setFormData({ ...formData, cartorio_codigo: e.target.value })}
                placeholder="Ex: 0001-2"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Cartório *</label>
              <Input
                value={formData.cartorio_nome}
                onChange={(e) => setFormData({ ...formData, cartorio_nome: e.target.value })}
                placeholder="Ex: 1º Cartório de Registro de Imóveis"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comarca *</label>
              <Input
                value={formData.comarca}
                onChange={(e) => setFormData({ ...formData, comarca: e.target.value })}
                placeholder="Ex: São Paulo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UF *</label>
              <select
                value={formData.uf}
                onChange={(e) => setFormData({ ...formData, uf: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {["SP", "MG", "RJ", "BA", "PR", "SC", "RS", "GO", "MT", "MS", "DF"].map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Proprietário *</label>
              <Input
                value={formData.proprietario_nome}
                onChange={(e) => setFormData({ ...formData, proprietario_nome: e.target.value })}
                placeholder="Nome completo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ</label>
              <Input
                value={formData.proprietario_cpf_cnpj}
                onChange={(e) => setFormData({ ...formData, proprietario_cpf_cnpj: e.target.value })}
                placeholder="CPF ou CNPJ"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Área Terreno (m²) *</label>
              <Input
                type="number"
                value={formData.area_terreno_m2}
                onChange={(e) => setFormData({ ...formData, area_terreno_m2: e.target.value })}
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Registro *</label>
              <Input
                type="date"
                value={formData.data_registro}
                onChange={(e) => setFormData({ ...formData, data_registro: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações adicionais"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleValidate}
              disabled={validating}
              variant="outline"
              className="gap-2"
            >
              {validating && <Loader2 className="w-4 h-4 animate-spin" />}
              Validar Formato
            </Button>
            <Button
              onClick={handleRegister}
              disabled={registering || (validationResult && !validationResult.is_valid)}
              className="gap-2"
            >
              {registering && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar Matrícula
            </Button>
          </div>

          {validationResult && (
            <Alert className={validationResult.is_valid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
              <Lock className={`w-4 h-4 ${validationResult.is_valid ? "text-green-600" : "text-red-600"}`} />
              <AlertDescription className={validationResult.is_valid ? "text-green-800" : "text-red-800"}>
                {validationResult.message}
                {validationResult.duplicated && " (Matrícula já registrada)"}
                {!validationResult.format_ok && " (Formato inválido)"}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {!loading && matriculas.length === 0 && (
        <Alert className="bg-blue-50 border-blue-200">
          <AlertTriangle className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Nenhuma matrícula registrada. Clique em "Nova Matrícula" para adicionar uma.
          </AlertDescription>
        </Alert>
      )}

      {!loading && matriculas.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Total de matrículas: <span className="font-semibold">{totalMatriculas}</span>
          </p>
          <div className="grid gap-4">
            {matriculas.map((matricula) => (
              <MatriculaCard key={matricula.id} matricula={matricula} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
