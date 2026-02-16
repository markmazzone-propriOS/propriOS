/*
  # Add sales_inquiry to support ticket categories

  1. Changes
    - Update the category CHECK constraint to include 'sales_inquiry' option
    - This allows users to submit support tickets for sales inquiries
*/

-- Drop the existing constraint
ALTER TABLE support_tickets
DROP CONSTRAINT IF EXISTS support_tickets_category_check;

-- Add the updated constraint with sales_inquiry included
ALTER TABLE support_tickets
ADD CONSTRAINT support_tickets_category_check
CHECK (category IN ('technical', 'billing', 'sales_inquiry', 'feature_request', 'other'));
