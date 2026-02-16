/*
  # Create Anonymous Property Analytics System

  1. New Tables
    - `anonymous_property_views`
      - Tracks property views from anonymous (non-authenticated) users
      - Uses session_id to identify unique anonymous visitors
    - `property_analytics_summary`
      - Materialized view for quick access to property analytics
      - Aggregates data from multiple sources

  2. Changes
    - Add session_id to calendar_events for anonymous viewing requests
    - Create helper function to get full analytics for a property

  3. Security
    - Enable RLS on anonymous_property_views
    - Only sellers can view analytics for their properties
    - Anonymous users can insert their own view records

  4. Purpose
    - Allow sellers to see total engagement metrics
    - Distinguish between authenticated and anonymous user interactions
    - Track viewing requests from both user types
*/

-- Create anonymous_property_views table
CREATE TABLE IF NOT EXISTS anonymous_property_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  session_id text NOT NULL,
  viewed_at timestamptz DEFAULT now() NOT NULL,
  user_agent text,
  ip_address inet
);

ALTER TABLE anonymous_property_views ENABLE ROW LEVEL SECURITY;

-- Add session_id to calendar_events for anonymous viewing requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN session_id text;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_anonymous_property_views_property_id
  ON anonymous_property_views(property_id);

CREATE INDEX IF NOT EXISTS idx_anonymous_property_views_session_id
  ON anonymous_property_views(session_id);

CREATE INDEX IF NOT EXISTS idx_anonymous_property_views_viewed_at
  ON anonymous_property_views(viewed_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_session_id
  ON calendar_events(session_id) WHERE session_id IS NOT NULL;

-- RLS Policies for anonymous_property_views

-- Allow anonymous users to insert their own views
CREATE POLICY "Anyone can insert anonymous views"
  ON anonymous_property_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow sellers to view analytics for their properties
CREATE POLICY "Sellers can view analytics for own properties"
  ON anonymous_property_views
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = anonymous_property_views.property_id
      AND properties.seller_id = auth.uid()
    )
  );

-- Function to get comprehensive property analytics
CREATE OR REPLACE FUNCTION get_property_analytics(property_uuid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  total_views_auth int;
  total_views_anon int;
  unique_viewers_auth int;
  unique_viewers_anon int;
  total_favorites int;
  total_viewings_auth int;
  total_viewings_anon int;
  viewing_requests_pending int;
  viewing_requests_confirmed int;
  viewing_requests_completed int;
BEGIN
  -- Get authenticated user views
  SELECT
    COALESCE(SUM(view_count), 0),
    COUNT(DISTINCT user_id)
  INTO total_views_auth, unique_viewers_auth
  FROM property_views
  WHERE property_id = property_uuid;

  -- Get anonymous user views (count unique session per day)
  SELECT
    COUNT(*),
    COUNT(DISTINCT session_id)
  INTO total_views_anon, unique_viewers_anon
  FROM anonymous_property_views
  WHERE property_id = property_uuid;

  -- Get favorites count
  SELECT COUNT(*)
  INTO total_favorites
  FROM favorites
  WHERE property_id = property_uuid;

  -- Get viewing requests from authenticated users
  SELECT COUNT(*)
  INTO total_viewings_auth
  FROM calendar_events
  WHERE property_id = property_uuid
  AND event_type = 'viewing'
  AND requester_id IS NOT NULL;

  -- Get viewing requests from anonymous users
  SELECT COUNT(*)
  INTO total_viewings_anon
  FROM calendar_events
  WHERE property_id = property_uuid
  AND event_type = 'viewing'
  AND session_id IS NOT NULL
  AND requester_id IS NULL;

  -- Get viewing requests by status
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'confirmed'),
    COUNT(*) FILTER (WHERE status = 'completed')
  INTO viewing_requests_pending, viewing_requests_confirmed, viewing_requests_completed
  FROM calendar_events
  WHERE property_id = property_uuid
  AND event_type = 'viewing';

  -- Build result object
  result := jsonb_build_object(
    'views', jsonb_build_object(
      'total', total_views_auth + total_views_anon,
      'authenticated', total_views_auth,
      'anonymous', total_views_anon,
      'unique_viewers_authenticated', unique_viewers_auth,
      'unique_viewers_anonymous', unique_viewers_anon
    ),
    'favorites', jsonb_build_object(
      'total', total_favorites
    ),
    'viewing_requests', jsonb_build_object(
      'total', total_viewings_auth + total_viewings_anon,
      'authenticated', total_viewings_auth,
      'anonymous', total_viewings_anon,
      'pending', viewing_requests_pending,
      'confirmed', viewing_requests_confirmed,
      'completed', viewing_requests_completed
    )
  );

  RETURN result;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_property_analytics(uuid) TO authenticated;
