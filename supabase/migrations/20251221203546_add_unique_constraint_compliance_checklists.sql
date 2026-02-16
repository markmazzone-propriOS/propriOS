/*
  # Add unique constraint to compliance_checklists

  1. Changes
    - Add unique constraint to prevent duplicate checklist names per application
    - Ensures each application_id + checklist_name combination is unique
  
  2. Security
    - No changes to RLS policies
*/

-- Add unique constraint to prevent duplicate checklists
ALTER TABLE compliance_checklists
ADD CONSTRAINT compliance_checklists_application_checklist_unique 
UNIQUE (application_id, checklist_name);
