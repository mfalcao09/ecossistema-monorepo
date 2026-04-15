-- Enable realtime on platform_pix_charges so frontend can listen for payment updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_pix_charges;