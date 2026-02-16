/*
  # Add Sender Update Policy for Document Signatures

  1. Security Changes
    - Add UPDATE policy for document_signatures table
    - Allows senders (property owners/agents) to update signature requests they created
    - This enables senders to cancel pending signature requests
*/

-- Allow senders to update their signature requests (e.g., to cancel them)
CREATE POLICY "Senders can update their signature requests"
  ON document_signatures FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);
