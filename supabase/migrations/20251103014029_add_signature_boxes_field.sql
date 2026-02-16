/*
  # Add signature box positions to document_signatures

  1. Changes
    - Add `signature_boxes` JSONB column to store signature field positions and metadata
    - This allows the signed PDF generator to place signatures in the correct locations
    
  2. Details
    - The signature_boxes field will store an array of signature box objects with:
      - id: unique identifier for the box
      - page: page number where the box is located
      - x, y: position coordinates
      - width, height: box dimensions
      - fieldType: 'signature', 'initials', or 'date'
      - signed: whether this box has been filled
      - signatureData: the actual signature/initial/date data
      - signatureType: 'drawn' or 'typed'
*/

ALTER TABLE document_signatures
ADD COLUMN IF NOT EXISTS signature_boxes JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN document_signatures.signature_boxes IS 'Array of signature box positions and data for PDF rendering';
