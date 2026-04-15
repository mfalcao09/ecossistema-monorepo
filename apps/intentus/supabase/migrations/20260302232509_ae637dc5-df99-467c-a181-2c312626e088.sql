-- RLS DELETE policies for superadmin on properties, people, contracts

-- Properties: superadmin can delete
CREATE POLICY "Superadmin can delete properties"
  ON public.properties
  FOR DELETE
  USING (public.has_role(auth.uid(), 'superadmin'));

-- People: superadmin can delete
CREATE POLICY "Superadmin can delete people"
  ON public.people
  FOR DELETE
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Contracts: superadmin can delete
CREATE POLICY "Superadmin can delete contracts"
  ON public.contracts
  FOR DELETE
  USING (public.has_role(auth.uid(), 'superadmin'));
