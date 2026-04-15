ALTER TABLE rent_adjustments ADD COLUMN assigned_to UUID REFERENCES auth.users(id);
ALTER TABLE contract_renewals ADD COLUMN assigned_to UUID REFERENCES auth.users(id);
ALTER TABLE guarantee_releases ADD COLUMN assigned_to UUID REFERENCES auth.users(id);