/*
  # Fix Property Owner Properties Count

  1. Changes
    - Add trigger to automatically update `properties_owned` count when properties are inserted/deleted
    - Recalculate all existing property owner counts to fix any discrepancies

  2. Notes
    - The trigger maintains accurate counts in real-time
    - One-time fix for all existing property owners
*/

-- Function to update properties_owned count
CREATE OR REPLACE FUNCTION update_property_owner_properties_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Check if seller is a property owner
    IF EXISTS (
      SELECT 1 FROM profiles
      WHERE id = NEW.seller_id
      AND user_type = 'property_owner'
    ) THEN
      UPDATE property_owner_profiles
      SET properties_owned = properties_owned + 1
      WHERE id = NEW.seller_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Check if seller is a property owner
    IF EXISTS (
      SELECT 1 FROM profiles
      WHERE id = OLD.seller_id
      AND user_type = 'property_owner'
    ) THEN
      UPDATE property_owner_profiles
      SET properties_owned = GREATEST(0, properties_owned - 1)
      WHERE id = OLD.seller_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_property_owner_count ON properties;

-- Create trigger for properties insert/delete
CREATE TRIGGER trigger_update_property_owner_count
AFTER INSERT OR DELETE ON properties
FOR EACH ROW
EXECUTE FUNCTION update_property_owner_properties_count();

-- Recalculate all property owner counts
UPDATE property_owner_profiles po
SET properties_owned = (
  SELECT COUNT(*)
  FROM properties p
  WHERE p.seller_id = po.id
);