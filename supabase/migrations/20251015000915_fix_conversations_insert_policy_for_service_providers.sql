/*
  # Fix Conversations Insert Policy for Service Providers

  1. Changes
    - Drop and recreate the INSERT policy on conversations table
    - Ensure all authenticated users (including service providers) can insert conversations
  
  2. Security
    - Policy allows any authenticated user to create a conversation
    - The with_check clause is set to true for maximum flexibility
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;

-- Recreate the INSERT policy with explicit true check
CREATE POLICY "Authenticated users can create conversations"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);