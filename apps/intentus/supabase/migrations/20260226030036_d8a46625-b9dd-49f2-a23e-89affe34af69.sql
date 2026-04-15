
ALTER TABLE public.inspections
  DROP CONSTRAINT IF EXISTS inspections_contract_id_fkey;

ALTER TABLE public.inspections
  ADD CONSTRAINT inspections_contract_id_fkey
  FOREIGN KEY (contract_id)
  REFERENCES public.contracts(id)
  ON DELETE CASCADE;

ALTER TABLE public.inspection_items
  DROP CONSTRAINT IF EXISTS inspection_items_inspection_id_fkey;

ALTER TABLE public.inspection_items
  ADD CONSTRAINT inspection_items_inspection_id_fkey
  FOREIGN KEY (inspection_id)
  REFERENCES public.inspections(id)
  ON DELETE CASCADE;
