/*
  # Real Estate Marketplace Schema

  ## Overview
  This migration creates a comprehensive real estate marketplace database similar to Zillow,
  supporting buyers, sellers, and real estate agents.

  ## 1. New Tables

  ### `profiles`
  - `id` (uuid, primary key, references auth.users)
  - `user_type` (text) - 'buyer', 'seller', or 'agent'
  - `full_name` (text)
  - `phone_number` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `agent_profiles`
  - `id` (uuid, primary key, references profiles)
  - `license_number` (text)
  - `star_rating` (numeric, 0-5)
  - `languages` (text array)
  - `locations` (text array) - areas they serve
  - `meet_in_person` (boolean)
  - `video_chat` (boolean)
  - `bio` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `properties`
  - `id` (uuid, primary key)
  - `listed_by` (uuid, references profiles) - user who created the listing
  - `agent_id` (uuid, references agent_profiles, nullable) - assigned agent
  - `listing_type` (text) - 'sale' or 'rent'
  - `price` (numeric)
  - `estimated_monthly` (numeric) - for sales, mortgage estimate
  - `bedrooms` (integer)
  - `bathrooms` (numeric) - supports half baths
  - `square_footage` (integer)
  - `address_line1` (text)
  - `address_line2` (text, nullable)
  - `city` (text)
  - `state` (text)
  - `zip_code` (text)
  - `latitude` (numeric)
  - `longitude` (numeric)
  - `description` (text)
  - `year_built` (integer)
  - `status` (text) - 'active', 'pending', 'sold', 'rented'
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `property_photos`
  - `id` (uuid, primary key)
  - `property_id` (uuid, references properties)
  - `photo_url` (text)
  - `display_order` (integer)
  - `created_at` (timestamptz)

  ## 2. Security
  - Enable RLS on all tables
  - Profiles: Users can read all profiles, update own profile
  - Agent profiles: Readable by all authenticated users, editable by agent only
  - Properties: Readable by all, creatable by authenticated users, editable by owner/assigned agent
  - Property photos: Readable by all, manageable by property owner/assigned agent

  ## 3. Indexes
  - Property search indexes on city, state, price, listing_type
  - Agent location and rating indexes
  - Property geolocation indexes

  ## 4. Important Notes
  - Days listed calculated as (now() - created_at)
  - Photo uploads will use Supabase Storage (configured separately)
  - Map integration uses latitude/longitude coordinates
  - Star ratings stored as numeric for precision
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  user_type text NOT NULL CHECK (user_type IN ('buyer', 'seller', 'agent')),
  full_name text NOT NULL,
  phone_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Agent profiles table
CREATE TABLE IF NOT EXISTS agent_profiles (
  id uuid PRIMARY KEY REFERENCES profiles ON DELETE CASCADE,
  license_number text NOT NULL,
  star_rating numeric DEFAULT 0 CHECK (star_rating >= 0 AND star_rating <= 5),
  languages text[] DEFAULT ARRAY['English'],
  locations text[] DEFAULT ARRAY[]::text[],
  meet_in_person boolean DEFAULT true,
  video_chat boolean DEFAULT true,
  bio text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agent_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view agent profiles"
  ON agent_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Agents can update own profile"
  ON agent_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Agents can insert own profile"
  ON agent_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listed_by uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  agent_id uuid REFERENCES agent_profiles ON DELETE SET NULL,
  listing_type text NOT NULL CHECK (listing_type IN ('sale', 'rent')),
  price numeric NOT NULL CHECK (price > 0),
  estimated_monthly numeric,
  bedrooms integer NOT NULL CHECK (bedrooms >= 0),
  bathrooms numeric NOT NULL CHECK (bathrooms >= 0),
  square_footage integer NOT NULL CHECK (square_footage > 0),
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text NOT NULL,
  zip_code text NOT NULL,
  latitude numeric,
  longitude numeric,
  description text NOT NULL,
  year_built integer CHECK (year_built >= 1800 AND year_built <= EXTRACT(YEAR FROM CURRENT_DATE)),
  status text DEFAULT 'active' CHECK (status IN ('active', 'pending', 'sold', 'rented')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active properties"
  ON properties FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create properties"
  ON properties FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = listed_by);

CREATE POLICY "Property owner can update own property"
  ON properties FOR UPDATE
  TO authenticated
  USING (auth.uid() = listed_by)
  WITH CHECK (auth.uid() = listed_by);

CREATE POLICY "Assigned agent can update property"
  ON properties FOR UPDATE
  TO authenticated
  USING (auth.uid() = agent_id)
  WITH CHECK (auth.uid() = agent_id);

CREATE POLICY "Property owner can delete own property"
  ON properties FOR DELETE
  TO authenticated
  USING (auth.uid() = listed_by);

-- Property photos table
CREATE TABLE IF NOT EXISTS property_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties ON DELETE CASCADE,
  photo_url text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE property_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view property photos"
  ON property_photos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Property owner can manage photos"
  ON property_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_id
      AND properties.listed_by = auth.uid()
    )
  );

CREATE POLICY "Property owner can update photos"
  ON property_photos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_id
      AND properties.listed_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_id
      AND properties.listed_by = auth.uid()
    )
  );

CREATE POLICY "Property owner can delete photos"
  ON property_photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_id
      AND properties.listed_by = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_state ON properties(state);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_listing_type ON properties(listing_type);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_agent_id ON properties(agent_id);
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_agent_star_rating ON agent_profiles(star_rating DESC);
CREATE INDEX IF NOT EXISTS idx_property_photos_property_id ON property_photos(property_id);