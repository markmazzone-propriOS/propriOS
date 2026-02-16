/*
  # Fix All Analytics Schema Issues

  1. Changes
    - Fix `calculate_listing_quality_score` to query property_photos table
    - Fix `get_hot_prospects` to join auth.users for email
    - Remove references to non-existent columns

  2. Purpose
    - Ensure all analytics functions work with actual database schema
*/

-- Fix calculate_listing_quality_score to use property_photos table
CREATE OR REPLACE FUNCTION calculate_listing_quality_score(property_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    (CASE WHEN lot_size > 0 THEN 10 ELSE 0 END) +
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

-- Fix get_hot_prospects to use auth.users for email
CREATE OR REPLACE FUNCTION get_hot_prospects(property_uuid uuid)
RETURNS TABLE(
  user_id uuid,
  session_id text,
  email text,
  full_name text,
  score integer,
  view_count integer,
  favorited boolean,
  viewing_requested boolean,
  offer_made boolean,
  last_activity timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH user_activities AS (
    SELECT
      pv.user_id,
      NULL::text as session_id,
      COALESCE(SUM(pv.view_count), 0)::bigint as views,
      MAX(pv.viewed_at) as last_view,
      EXISTS(SELECT 1 FROM favorites f WHERE f.property_id = property_uuid AND f.user_id = pv.user_id) as is_favorited,
      EXISTS(SELECT 1 FROM calendar_events ce WHERE ce.property_id = property_uuid AND ce.requester_id = pv.user_id AND ce.event_type = 'viewing') as has_viewing,
      EXISTS(SELECT 1 FROM property_offers o WHERE o.property_id = property_uuid AND o.buyer_id = pv.user_id) as has_offer
    FROM property_views pv
    WHERE pv.property_id = property_uuid
    GROUP BY pv.user_id

    UNION ALL

    SELECT
      NULL::uuid,
      apv.session_id,
      COUNT(*)::bigint as views,
      MAX(apv.viewed_at) as last_view,
      false as is_favorited,
      EXISTS(SELECT 1 FROM calendar_events ce WHERE ce.property_id = property_uuid AND ce.session_id = apv.session_id AND ce.event_type = 'viewing') as has_viewing,
      false as has_offer
    FROM anonymous_property_views apv
    WHERE apv.property_id = property_uuid
    GROUP BY apv.session_id
  ),
  scored_prospects AS (
    SELECT
      ua.user_id,
      ua.session_id,
      ua.views::integer,
      ua.is_favorited,
      ua.has_viewing,
      ua.has_offer,
      ua.last_view,
      ((ua.views * 2) +
      (CASE WHEN ua.is_favorited THEN 15 ELSE 0 END) +
      (CASE WHEN ua.has_viewing THEN 25 ELSE 0 END) +
      (CASE WHEN ua.has_offer THEN 50 ELSE 0 END) +
      (CASE WHEN ua.last_view > now() - interval '24 hours' THEN 10 ELSE 0 END))::integer as calculated_score
    FROM user_activities ua
    WHERE ua.views >= 2 OR ua.is_favorited OR ua.has_viewing OR ua.has_offer
  )
  SELECT
    sp.user_id,
    sp.session_id,
    au.email::text,
    p.full_name,
    sp.calculated_score::integer,
    sp.views::integer,
    sp.is_favorited,
    sp.has_viewing,
    sp.has_offer,
    sp.last_view
  FROM scored_prospects sp
  LEFT JOIN profiles p ON p.id = sp.user_id
  LEFT JOIN auth.users au ON au.id = sp.user_id
  WHERE sp.calculated_score >= 10
  ORDER BY sp.calculated_score DESC, sp.last_view DESC
  LIMIT 20;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_listing_quality_score(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hot_prospects(uuid) TO authenticated;
