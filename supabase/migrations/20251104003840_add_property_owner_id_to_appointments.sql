/*
  # Add Property Owner ID to Service Provider Appointments
  
  1. Changes
    - Add `property_owner_id` column to `service_provider_appointments` table
    - Add foreign key constraint to profiles table
    - Create index for efficient queries
    - Add RLS policies for property owners to view their appointments
  
  2. Security
    - Property owners can view appointments scheduled with them
    - Property owners cannot create or modify appointments (only service providers can)
*/

-- Add property_owner_id column to service_provider_appointments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_provider_appointments' AND column_name = 'property_owner_id'
  ) THEN
    ALTER TABLE service_provider_appointments 
    ADD COLUMN property_owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_appointments_property_owner_id ON service_provider_appointments(property_owner_id);
  END IF;
END $$;

-- Add RLS policy for property owners to view their appointments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'service_provider_appointments' 
    AND policyname = 'Property owners can view their appointments'
  ) THEN
    CREATE POLICY "Property owners can view their appointments"
      ON service_provider_appointments FOR SELECT
      TO authenticated
      USING (
        property_owner_id = auth.uid() AND
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.user_type = 'property_owner'
        )
      );
  END IF;
END $$;
