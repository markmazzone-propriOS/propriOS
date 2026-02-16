/*
  # Create Lead Response Attachments Storage

  1. Storage
    - Create `lead-response-attachments` bucket for storing files attached to lead email responses
    - Public bucket to allow lead recipients to download attachments

  2. Security
    - Service providers can upload files to their own lead folders
    - Public read access for attachment download links
*/

-- Create storage bucket for lead response attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-response-attachments', 'lead-response-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Service providers can upload attachments for their own leads
CREATE POLICY "Service providers can upload lead response attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'lead-response-attachments' AND
  EXISTS (
    SELECT 1 FROM service_provider_leads
    WHERE service_provider_leads.id::text = (storage.foldername(name))[1]
    AND service_provider_leads.service_provider_id = auth.uid()
  )
);

-- Policy: Public read access for attachments
CREATE POLICY "Public read access for lead response attachments"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'lead-response-attachments');

-- Policy: Service providers can delete their own lead response attachments
CREATE POLICY "Service providers can delete their lead response attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'lead-response-attachments' AND
  EXISTS (
    SELECT 1 FROM service_provider_leads
    WHERE service_provider_leads.id::text = (storage.foldername(name))[1]
    AND service_provider_leads.service_provider_id = auth.uid()
  )
);
