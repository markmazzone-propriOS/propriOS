/*
  # Add Delete Policy for Document Signatures

  1. Security Changes
    - Add DELETE policy for document_signatures table
    - Allows senders (property owners/agents) to delete signature requests they created
*/

-- Allow senders to delete their signature requests
CREATE POLICY "Senders can delete their signature requests"
  ON document_signatures FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);
