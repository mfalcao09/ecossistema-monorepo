ALTER TYPE property_status ADD VALUE 'inativo';
ALTER TABLE properties ADD COLUMN inactivated_at timestamptz;
ALTER TABLE properties ADD COLUMN inactivation_reason text;