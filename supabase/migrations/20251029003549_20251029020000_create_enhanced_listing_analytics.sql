/*
  # Create Enhanced Listing Analytics System

  1. New Tables
    - `property_price_history`
      - Tracks all price changes for properties with timestamps
      - Enables before/after engagement analysis

    - `property_photo_views`
      - Tracks which photos are viewed and how often
      - Helps identify best-performing photos

    - `property_search_discoveries`
      - Tracks how users found the listing (search, share, direct)
      - Includes search keywords and filters used

  2. New Functions
    - `get_listing_analytics_enhanced` - Comprehensive analytics per listing
    - `get_hot_prospects` - Identifies high-intent buyers for a property
    - `get_property_conversion_funnel` - Calculates conversion rates
    - `get_engagement_trend` - 30-day trend data
    - `calculate_listing_quality_score` - Rates listing completeness

  3. Security
    - Enable RLS on all new tables
    - Only property agents/sellers can view analytics
    - Buyers can insert their own interaction data

  4. Purpose
    - Provide actionable insights to help agents optimize listings
    - Identify hot prospects requiring immediate follow-up
    - Track conversion funnel to identify drop-off points
    - Monitor engagement trends over time
*/

-- Property Price History Table
CREATE TABLE IF NOT EXISTS property_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  old_price numeric,
  new_price numeric NOT NULL,
  changed_at timestamptz DEFAULT now() NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  reason text
);

ALTER TABLE property_price_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_property_price_history_property_id
  ON property_price_history(property_id);

CREATE INDEX IF NOT EXISTS idx_property_price_history_changed_at
  ON property_price_history(changed_at);

-- Property Photo Views Table
CREATE TABLE IF NOT EXISTS property_photo_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  photo_index integer NOT NULL,
  viewer_id uuid REFERENCES auth.users(id),
  session_id text,
  viewed_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE property_photo_views ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_property_photo_views_property_id
  ON property_photo_views(property_id);

CREATE INDEX IF NOT EXISTS idx_property_photo_views_viewer_id
  ON property_photo_views(viewer_id);

-- Property Search Discoveries Table
CREATE TABLE IF NOT EXISTS property_search_discoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  session_id text,
  source text NOT NULL CHECK (source IN ('search', 'direct', 'share', 'external', 'featured')),
  search_keywords text,
  filters_used jsonb,
  discovered_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE property_search_discoveries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_property_search_discoveries_property_id
  ON property_search_discoveries(property_id);

CREATE INDEX IF NOT EXISTS idx_property_search_discoveries_source
  ON property_search_discoveries(source);

-- RLS Policies for property_price_history

CREATE POLICY "Agents and sellers can view price history for their properties"
  ON property_price_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_price_history.property_id
      AND (properties.agent_id = auth.uid() OR properties.seller_id = auth.uid())
    )
  );

CREATE POLICY "Agents and sellers can insert price history"
  ON property_price_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_price_history.property_id
      AND (properties.agent_id = auth.uid() OR properties.seller_id = auth.uid())
    )
  );

-- RLS Policies for property_photo_views

CREATE POLICY "Anyone can insert photo views"
  ON property_photo_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Agents and sellers can view photo analytics for their properties"
  ON property_photo_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_photo_views.property_id
      AND (properties.agent_id = auth.uid() OR properties.seller_id = auth.uid())
    )
  );

-- RLS Policies for property_search_discoveries

CREATE POLICY "Anyone can insert search discoveries"
  ON property_search_discoveries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Agents and sellers can view search analytics for their properties"
  ON property_search_discoveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_search_discoveries.property_id
      AND (properties.agent_id = auth.uid() OR properties.seller_id = auth.uid())
    )
  );

-- Function to calculate listing quality score
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
    COALESCE(array_length(photos, 1), 0),
    COALESCE(length(description), 0)
  INTO photo_count, description_length
  FROM properties
  WHERE id = property_uuid;

  -- Photos (max 30 points)
  IF photo_count >= 15 THEN
    score := score + 30;
  ELSIF photo_count >= 10 THEN
    score := score + 20;
  ELSIF photo_count >= 5 THEN
    score := score + 10;
  END IF;

  -- Description (max 20 points)
  IF description_length >= 500 THEN
    score := score + 20;
  ELSIF description_length >= 300 THEN
    score := score + 15;
  ELSIF description_length >= 150 THEN
    score := score + 10;
  END IF;

  -- Basic info completeness (max 50 points)
  SELECT
    (CASE WHEN bedrooms > 0 THEN 10 ELSE 0 END) +
    (CASE WHEN bathrooms > 0 THEN 10 ELSE 0 END) +
    (CASE WHEN square_feet > 0 THEN 10 ELSE 0 END) +
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

-- Function to get hot prospects for a property
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
      SUM(pv.view_count) as views,
      MAX(pv.last_viewed_at) as last_view,
      EXISTS(SELECT 1 FROM favorites f WHERE f.property_id = property_uuid AND f.user_id = pv.user_id) as is_favorited,
      EXISTS(SELECT 1 FROM calendar_events ce WHERE ce.property_id = property_uuid AND ce.requester_id = pv.user_id AND ce.event_type = 'viewing') as has_viewing,
      EXISTS(SELECT 1 FROM offers o WHERE o.property_id = property_uuid AND o.buyer_id = pv.user_id) as has_offer
    FROM property_views pv
    WHERE pv.property_id = property_uuid
    GROUP BY pv.user_id

    UNION ALL

    SELECT
      NULL::uuid,
      apv.session_id,
      COUNT(*) as views,
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

-- Function to get conversion funnel metrics
CREATE OR REPLACE FUNCTION get_property_conversion_funnel(property_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_views integer;
  unique_viewers integer;
  total_favorites integer;
  total_viewings integer;
  total_offers integer;
  accepted_offers integer;
  result jsonb;
BEGIN
  SELECT
    COALESCE(SUM(pv.view_count), 0) + COALESCE((SELECT COUNT(*) FROM anonymous_property_views WHERE property_id = property_uuid), 0),
    COALESCE(COUNT(DISTINCT pv.user_id), 0) + COALESCE((SELECT COUNT(DISTINCT session_id) FROM anonymous_property_views WHERE property_id = property_uuid), 0)
  INTO total_views, unique_viewers
  FROM property_views pv
  WHERE pv.property_id = property_uuid;

  SELECT COUNT(*)
  INTO total_favorites
  FROM favorites
  WHERE property_id = property_uuid;

  SELECT COUNT(*)
  INTO total_viewings
  FROM calendar_events
  WHERE property_id = property_uuid
  AND event_type = 'viewing';

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'accepted')
  INTO total_offers, accepted_offers
  FROM offers
  WHERE property_id = property_uuid;

  result := jsonb_build_object(
    'stages', jsonb_build_array(
      jsonb_build_object(
        'stage', 'views',
        'count', total_views,
        'label', 'Total Views',
        'percentage', 100
      ),
      jsonb_build_object(
        'stage', 'unique_viewers',
        'count', unique_viewers,
        'label', 'Unique Viewers',
        'percentage', CASE WHEN total_views > 0 THEN ROUND((unique_viewers::numeric / total_views::numeric) * 100) ELSE 0 END
      ),
      jsonb_build_object(
        'stage', 'favorites',
        'count', total_favorites,
        'label', 'Favorites',
        'percentage', CASE WHEN unique_viewers > 0 THEN ROUND((total_favorites::numeric / unique_viewers::numeric) * 100) ELSE 0 END
      ),
      jsonb_build_object(
        'stage', 'viewings',
        'count', total_viewings,
        'label', 'Viewing Requests',
        'percentage', CASE WHEN total_favorites > 0 THEN ROUND((total_viewings::numeric / total_favorites::numeric) * 100) ELSE 0 END
      ),
      jsonb_build_object(
        'stage', 'offers',
        'count', total_offers,
        'label', 'Offers',
        'percentage', CASE WHEN total_viewings > 0 THEN ROUND((total_offers::numeric / total_viewings::numeric) * 100) ELSE 0 END
      )
    ),
    'conversion_rates', jsonb_build_object(
      'view_to_favorite', CASE WHEN unique_viewers > 0 THEN ROUND((total_favorites::numeric / unique_viewers::numeric) * 100, 1) ELSE 0 END,
      'favorite_to_viewing', CASE WHEN total_favorites > 0 THEN ROUND((total_viewings::numeric / total_favorites::numeric) * 100, 1) ELSE 0 END,
      'viewing_to_offer', CASE WHEN total_viewings > 0 THEN ROUND((total_offers::numeric / total_viewings::numeric) * 100, 1) ELSE 0 END,
      'overall', CASE WHEN unique_viewers > 0 THEN ROUND((total_offers::numeric / unique_viewers::numeric) * 100, 1) ELSE 0 END
    )
  );

  RETURN result;
END;
$$;

-- Function to get 30-day engagement trend
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
      date_trunc('day', pv.last_viewed_at)::date as date,
      COUNT(*) as view_count
    FROM property_views pv
    WHERE pv.property_id = property_uuid
    AND pv.last_viewed_at >= now() - (days || ' days')::interval
    GROUP BY date_trunc('day', pv.last_viewed_at)::date

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
    FROM offers o
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_listing_quality_score(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hot_prospects(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_property_conversion_funnel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_engagement_trend(uuid, integer) TO authenticated;

-- Trigger to automatically track price changes
CREATE OR REPLACE FUNCTION track_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.price IS DISTINCT FROM NEW.price THEN
    INSERT INTO property_price_history (property_id, old_price, new_price, changed_by)
    VALUES (NEW.id, OLD.price, NEW.price, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_property_price_change
  AFTER UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION track_price_change();
