
-- Item 10: Add revenue_type to contract_installments to classify own revenue vs transit
ALTER TABLE public.contract_installments
  ADD COLUMN revenue_type text NOT NULL DEFAULT 'transito'
    CHECK (revenue_type IN ('propria', 'transito'));

-- Item 7: Add intermediation_fee_generated flag to contracts
ALTER TABLE public.contracts
  ADD COLUMN intermediation_fee_generated boolean NOT NULL DEFAULT false;

-- Item 12: Add requires_nf_rpa flag and block payment without documentation
ALTER TABLE public.commission_splits
  ADD COLUMN doc_required boolean NOT NULL DEFAULT false,
  ADD COLUMN doc_type text CHECK (doc_type IN ('nf', 'rpa', null)),
  ADD COLUMN doc_verified_at timestamp with time zone,
  ADD COLUMN doc_verified_by uuid;

-- Item 16: Add auto_transfer_generated to installments to avoid duplicates
ALTER TABLE public.contract_installments
  ADD COLUMN transfer_generated boolean NOT NULL DEFAULT false;
