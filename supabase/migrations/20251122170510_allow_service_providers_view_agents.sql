/*
  # Allow Service Providers to View Agent Profiles

  1. Changes
    - Add RLS policy allowing service providers to view all agent profiles
    - This enables service providers to select agents when creating invoices
  
  2. Security
    - Only allows viewing agent profiles (not sensitive data)
    - Service providers can only view, not modify agent profiles
*/

-- Allow service providers to view agent profiles for invoicing
CREATE POLICY "Service providers can view agent profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    user_type = 'agent' 
    AND EXISTS (
      SELECT 1 FROM profiles AS requester
      WHERE requester.id = auth.uid()
      AND requester.user_type = 'service_provider'
    )
  );
