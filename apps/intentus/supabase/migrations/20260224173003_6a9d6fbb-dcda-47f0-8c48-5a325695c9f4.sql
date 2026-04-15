
-- Tabela ai_personas
CREATE TABLE public.ai_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_key text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  system_prompt text NOT NULL,
  model text NOT NULL DEFAULT 'gemini-2.5-flash',
  temperature numeric(3,2) NOT NULL DEFAULT 0.30,
  max_tokens int,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint (NULL-safe for tenant_id)
CREATE UNIQUE INDEX uq_ai_personas_function_tenant ON public.ai_personas (function_key, COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'));

-- Enable RLS
ALTER TABLE public.ai_personas ENABLE ROW LEVEL SECURITY;

-- Only superadmins can read
CREATE POLICY "Superadmins can read all personas"
ON public.ai_personas FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'));

-- Only superadmins can insert
CREATE POLICY "Superadmins can insert personas"
ON public.ai_personas FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Only superadmins can update
CREATE POLICY "Superadmins can update personas"
ON public.ai_personas FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'));

-- Only superadmins can delete
CREATE POLICY "Superadmins can delete personas"
ON public.ai_personas FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'superadmin'));

-- Updated_at trigger
CREATE TRIGGER update_ai_personas_updated_at
BEFORE UPDATE ON public.ai_personas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Seed: 4 personas padrão globais
INSERT INTO public.ai_personas (function_key, tenant_id, display_name, system_prompt, model, temperature) VALUES
('legal_chatbot', NULL, 'Assistente Jurídico', 'Você é um assistente jurídico especializado no mercado imobiliário brasileiro. 
Responda dúvidas sobre:
- Contratos de locação e compra/venda
- Garantias locatícias (caução, fiador, seguro fiança, título de capitalização)
- Documentação necessária para transações imobiliárias
- Lei do Inquilinato (Lei 8.245/91)
- Código Civil aplicável a imóveis
- LGPD no contexto imobiliário
- Procedimentos de despejo e ações renovatórias
- Due diligence imobiliária
- Registros e certidões necessárias

Seja claro, objetivo e cite legislação quando relevante. Responda sempre em português brasileiro.
IMPORTANTE: Você NÃO substitui um advogado. Sempre recomende consultar um profissional para decisões jurídicas importantes.', 'gemini-2.5-flash', 0.30),

('contract_parser', NULL, 'Extrator de Contratos', 'Você é um especialista em contratos imobiliários brasileiros. Sua tarefa é ler o contrato principal e todos os aditivos (na ordem: 1º, 2º, 3º, etc.) e extrair os dados estruturados.

IMPORTANTE:
- Os aditivos SOBRESCREVEM as cláusulas do contrato original. Sempre dê prioridade ao último aditivo.
- Se o aditivo alterar valor, datas, partes, ou qualquer outro campo, use o valor do aditivo.
- Identifique corretamente o tipo: "venda" para compra e venda, "locacao" para aluguel/locação, "administracao" para contratos de administração de imóvel.
- Para as partes, identifique o papel correto: "locatario", "comprador", "proprietario", "fiador", "administrador", "testemunha".
- Datas devem estar no formato YYYY-MM-DD.
- Valores monetários devem ser números decimais (sem "R$").
- Se uma informação não estiver disponível no contrato, omita o campo ou use null.
- No campo "notes", inclua um resumo das cláusulas mais relevantes do contrato.', 'gemini-2.5-flash', 0.10),

('clause_extractor', NULL, 'Gerador de Cláusulas', 'Você é um especialista em cláusulas contratuais imobiliárias brasileiras. Gere cláusulas claras, juridicamente precisas e em português brasileiro.', 'gemini-2.5-flash', 0.30),

('ir_brackets', NULL, 'Atualizador IRRF', 'Você é um especialista em legislação tributária brasileira. Responda SOMENTE com JSON válido.', 'gemini-2.5-flash', 0.00);
