
-- Add addendum fields to rent_adjustments
ALTER TABLE public.rent_adjustments
  ADD COLUMN requires_addendum boolean NOT NULL DEFAULT false,
  ADD COLUMN deal_request_id uuid REFERENCES public.deal_requests(id) ON DELETE SET NULL;

-- Create index for the FK
CREATE INDEX idx_rent_adjustments_deal_request ON public.rent_adjustments(deal_request_id);
