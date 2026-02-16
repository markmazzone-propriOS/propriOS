/*
  # Add login category to support tickets

  1. Changes
    - Update the category CHECK constraint to include 'login' as a separate option
    - This allows users to distinguish between general technical issues and login problems
*/

-- Drop the existing constraint
ALTER TABLE support_tickets
DROP CONSTRAINT IF EXISTS support_tickets_category_check;

-- Add the updated constraint with login included
ALTER TABLE support_tickets
ADD CONSTRAINT support_tickets_category_check
CHECK (category IN ('technical', 'login', 'billing', 'sales_inquiry', 'feature_request', 'other'));
