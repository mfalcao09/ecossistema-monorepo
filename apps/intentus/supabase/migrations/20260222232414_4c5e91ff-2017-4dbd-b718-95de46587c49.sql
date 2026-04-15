
-- Step 1: Convert column to text temporarily
ALTER TABLE public.ir_withholdings
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE text USING status::text;

-- Step 2: Update data
UPDATE public.ir_withholdings SET status = 'registrado' WHERE status IN ('pendente', 'recolhido');

-- Step 3: Drop old enum, create new one
DROP TYPE public.ir_withholding_status;
CREATE TYPE public.ir_withholding_status AS ENUM ('registrado', 'cancelado');

-- Step 4: Convert back to enum
ALTER TABLE public.ir_withholdings
  ALTER COLUMN status TYPE public.ir_withholding_status USING status::public.ir_withholding_status,
  ALTER COLUMN status SET DEFAULT 'registrado';
