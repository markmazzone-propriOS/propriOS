/*
  # Fix calculate_listing_quality_score Function for Text lot_size

  1. Changes
    - Update the calculate_listing_quality_score function to handle lot_size as text
    - Check if lot_size is not null and not empty instead of numeric comparison
    
  2. Security
    - Function maintains SECURITY DEFINER for proper RLS handling
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS calculate_listing_quality_score(uuid);

-- Recreate the function with fixed lot_size handling
CREATE OR REPLACE FUNCTION calculate_listing_quality_score(property_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  score integer := 0;
  max_score integer := 100;
  result jsonb;
  photo_count integer;
  description_length integer;
  amenity_count integer;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM property_photos WHERE property_id = property_uuid),
    COALESCE(length(description), 0)
  INTO photo_count, description_length
  FROM properties
  WHERE id = property_uuid;

  IF photo_count >= 15 THEN
    score := score + 30;
  ELSIF photo_count >= 10 THEN
    score := score + 20;
  ELSIF photo_count >= 5 THEN
    score := score + 10;
  END IF;

  IF description_length >= 500 THEN
    score := score + 20;
  ELSIF description_length >= 300 THEN
    score := score + 15;
  ELSIF description_length >= 150 THEN
    score := score + 10;
  END IF;

  SELECT
    (CASE WHEN bedrooms > 0 THEN 10 ELSE 0 END) +
    (CASE WHEN bathrooms > 0 THEN 10 ELSE 0 END) +
    (CASE WHEN square_footage > 0 THEN 10 ELSE 0 END) +
    (CASE WHEN lot_size IS NOT NULL AND lot_size != '' THEN 10 ELSE 0 END) +
    (CASE WHEN year_built > 0 THEN 10 ELSE 0 END)
  INTO amenity_count
  FROM properties
  WHERE id = property_uuid;

  score := score + COALESCE(amenity_count, 0);

  result := jsonb_build_object(
    'score', score,
    'max_score', max_score,
    'percentage', ROUND((score::numeric / max_score::numeric) * 100),
    'recommendations', CASE
      WHEN photo_count < 10 THEN jsonb_build_array('Add more photos (recommend 15+)')
      WHEN photo_count < 15 THEN jsonb_build_array('Add a few more photos for best results')
      ELSE jsonb_build_array()
    END ||
    CASE
      WHEN description_length < 300 THEN jsonb_build_array('Expand property description')
      ELSE jsonb_build_array()
    END
  );

  RETURN result;
END;
$$;
