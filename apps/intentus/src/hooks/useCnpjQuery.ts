import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CnpjResult {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao: string;
  data_situacao: string;
  tipo: string;
  porte: string;
  natureza_juridica: string;
  cnae_principal: string;
  cnae_codigo: string;
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
  };
  telefone: string;
  email: string;
  capital_social: string;
  data_abertura: string;
}

export function useCnpjQuery() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = async (cnpj: string): Promise<CnpjResult | null> => {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return null;

    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("cnpj-query", {
        body: { cnpj: digits },
      });
      if (fnErr) throw fnErr;
      if (data?.error) {
        setError(data.error);
        return null;
      }
      return data as CnpjResult;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { query, isLoading, error };
}
