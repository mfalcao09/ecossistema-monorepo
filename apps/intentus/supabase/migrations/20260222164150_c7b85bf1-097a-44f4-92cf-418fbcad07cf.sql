ALTER TABLE deal_request_checklists
  ADD COLUMN checklist_group TEXT NOT NULL DEFAULT 'Checklist',
  ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN due_date DATE;