
-- Step 1: Drop identity first (while still integer)
ALTER TABLE public.tenant_invoices ALTER COLUMN invoice_number DROP IDENTITY IF EXISTS;

-- Step 2: Now convert to text
ALTER TABLE public.tenant_invoices 
  ALTER COLUMN invoice_number TYPE text USING lpad(invoice_number::text, 10, '0'),
  ALTER COLUMN invoice_number SET DEFAULT '';

-- Step 3: Add unique constraint
ALTER TABLE public.tenant_invoices 
  ADD CONSTRAINT tenant_invoices_invoice_number_unique UNIQUE (invoice_number);

-- Step 4: Create function to generate next invoice number AAAAMM0001
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix text;
  v_max_seq int;
  v_next_seq int;
BEGIN
  v_prefix := to_char(now(), 'YYYYMM');

  SELECT COALESCE(MAX(substring(invoice_number FROM 7 FOR 4)::int), 0)
  INTO v_max_seq
  FROM public.tenant_invoices
  WHERE invoice_number LIKE v_prefix || '%'
    AND length(invoice_number) = 10;

  v_next_seq := v_max_seq + 1;

  IF v_next_seq > 9999 THEN
    RAISE EXCEPTION 'Limite de 9999 faturas por mês atingido';
  END IF;

  NEW.invoice_number := v_prefix || lpad(v_next_seq::text, 4, '0');
  RETURN NEW;
END;
$$;

-- Step 5: Create trigger
CREATE TRIGGER trg_generate_invoice_number
  BEFORE INSERT ON public.tenant_invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION public.generate_invoice_number();
