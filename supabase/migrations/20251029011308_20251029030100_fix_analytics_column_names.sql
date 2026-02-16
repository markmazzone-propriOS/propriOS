/*
  # Fix Analytics Functions Column Name References

  1. Changes
    - Update all functions to use correct column names:
      - `viewed_at` instead of `last_viewed_at` in property_views
      - `offer_status` instead of `status` in property_offers

  2. Purpose
    - Fix function errors caused by incorrect column name references
    - Ensure all analytics functions work correctly with actual schema
*/

-- Fix get_hot_prospects function with correct column names
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
      (ua.views * 2) +
      (CASE WHEN ua.is_favorited THEN 15 ELSE 0 END) +
      (CASE WHEN ua.has_viewing THEN 25 ELSE 0 END) +
      (CASE WHEN ua.has_offer THEN 50 ELSE 0 END) +
      (CASE WHEN ua.last_view > now() - interval '24 hours' THEN 10 ELSE 0 END) as calculated_score
    FROM user_activities ua
    WHERE ua.views >= 2 OR ua.is_favorited OR ua.has_viewing OR ua.has_offer
  )
  SELECT
    sp.user_id,
    sp.session_id,
    p.email,
    p.full_name,
    sp.calculated_score,
    sp.views,
    sp.is_favorited,
    sp.has_viewing,
    sp.has_offer,
    sp.last_view
  FROM scored_prospects sp
  LEFT JOIN profiles p ON p.id = sp.user_id
  WHERE sp.calculated_score >= 10
  ORDER BY sp.calculated_score DESC, sp.last_view DESC
  LIMIT 20;
END;
$$;

-- Fix get_engagement_trend function with correct column names
CREATE OR REPLACE FUNCTION get_engagement_trend(property_uuid uuid, days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH date_series AS (
    SELECT generate_series(
      date_trunc('day', now() - (days || ' days')::interval),
      date_trunc('day', now()),
      '1 day'::interval
    )::date as date
  ),
  daily_views AS (
    SELECT
      date_trunc('day', pv.viewed_at)::date as date,
      SUM(pv.view_count) as view_count
    FROM property_views pv
    WHERE pv.property_id = property_uuid
    AND pv.viewed_at >= now() - (days || ' days')::interval
    GROUP BY date_trunc('day', pv.viewed_at)::date

    UNION ALL

    SELECT
      date_trunc('day', apv.viewed_at)::date as date,
      COUNT(*) as view_count
    FROM anonymous_property_views apv
    WHERE apv.property_id = property_uuid
    AND apv.viewed_at >= now() - (days || ' days')::interval
    GROUP BY date_trunc('day', apv.viewed_at)::date
  ),
  daily_favorites AS (
    SELECT
      date_trunc('day', f.created_at)::date as date,
      COUNT(*) as favorite_count
    FROM favorites f
    WHERE f.property_id = property_uuid
    AND f.created_at >= now() - (days || ' days')::interval
    GROUP BY date_trunc('day', f.created_at)::date
  ),
  daily_viewings AS (
    SELECT
      date_trunc('day', ce.created_at)::date as date,
      COUNT(*) as viewing_count
    FROM calendar_events ce
    WHERE ce.property_id = property_uuid
    AND ce.event_type = 'viewing'
    AND ce.created_at >= now() - (days || ' days')::interval
    GROUP BY date_trunc('day', ce.created_at)::date
  ),
  daily_offers AS (
    SELECT
      date_trunc('day', o.created_at)::date as date,
      COUNT(*) as offer_count
    FROM property_offers o
    WHERE o.property_id = property_uuid
    AND o.created_at >= now() - (days || ' days')::interval
    GROUP BY date_trunc('day', o.created_at)::date
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', ds.date,
      'views', COALESCE(dv.total_views, 0),
      'favorites', COALESCE(df.favorite_count, 0),
      'viewings', COALESCE(dvw.viewing_count, 0),
      'offers', COALESCE(dof.offer_count, 0)
    ) ORDER BY ds.date
  )
  INTO result
  FROM date_series ds
  LEFT JOIN (
    SELECT date, SUM(view_count) as total_views
    FROM daily_views
    GROUP BY date
  ) dv ON ds.date = dv.date
  LEFT JOIN daily_favorites df ON ds.date = df.date
  LEFT JOIN daily_viewings dvw ON ds.date = dvw.date
  LEFT JOIN daily_offers dof ON ds.date = dof.date;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_hot_prospects(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_engagement_trend(uuid, integer) TO authenticated;
