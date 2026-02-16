/*
  # Create Service Provider System

  ## Overview
  This migration creates a comprehensive system for service providers to manage their business,
  including profiles, services offered, ratings, service areas, and job management.

  ## New Tables
  
  ### `service_provider_profiles`
  - `id` (uuid, FK to profiles.id) - Links to user profile
  - `business_name` (text) - Business or company name
  - `license_number` (text, optional) - Professional license number
  - `insurance_verified` (boolean) - Whether insurance is verified
  - `years_experience` (integer) - Years in business
  - `bio` (text) - Business description
  - `service_radius_miles` (integer) - How far they travel for jobs
  - `average_rating` (decimal) - Calculated average rating
  - `total_reviews` (integer) - Total number of reviews
  - `total_jobs_completed` (integer) - Count of completed jobs
  - `profile_photo_url` (text, optional) - Profile photo
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `service_categories`
  - `id` (uuid, PK)
  - `name` (text) - Category name (e.g., "Plumbing", "Electrical")
  - `description` (text, optional)
  - `created_at` (timestamptz)

  ### `service_provider_services`
  - `id` (uuid, PK)
  - `provider_id` (uuid, FK to service_provider_profiles.id)
  - `category_id` (uuid, FK to service_categories.id)
  - `service_name` (text) - Specific service offered
  - `description` (text, optional)
  - `base_price` (decimal, optional) - Starting price
  - `created_at` (timestamptz)

  ### `service_areas`
  - `id` (uuid, PK)
  - `provider_id` (uuid, FK to service_provider_profiles.id)
  - `city` (text)
  - `state` (text)
  - `zip_code` (text, optional)
  - `created_at` (timestamptz)

  ### `service_jobs`
  - `id` (uuid, PK)
  - `provider_id` (uuid, FK to service_provider_profiles.id)
  - `client_id` (uuid, FK to profiles.id) - Client who booked the job
  - `property_id` (uuid, FK to properties.id, optional) - Related property
  - `service_category_id` (uuid, FK to service_categories.id)
  - `title` (text) - Job title
  - `description` (text) - Job description
  - `status` (text) - pending, scheduled, in_progress, completed, cancelled
  - `scheduled_date` (timestamptz, optional) - When job is scheduled
  - `started_at` (timestamptz, optional) - When work began
  - `completed_at` (timestamptz, optional) - When work finished
  - `estimated_hours` (decimal, optional)
  - `actual_hours` (decimal, optional)
  - `estimated_cost` (decimal, optional)
  - `final_cost` (decimal, optional)
  - `location_address` (text) - Job location
  - `notes` (text, optional) - Additional notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `service_provider_reviews`
  - `id` (uuid, PK)
  - `provider_id` (uuid, FK to service_provider_profiles.id)
  - `reviewer_id` (uuid, FK to profiles.id) - Who left the review
  - `job_id` (uuid, FK to service_jobs.id, optional) - Related job
  - `rating` (integer) - 1-5 stars
  - `title` (text, optional)
  - `comment` (text, optional)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Service providers can view and update their own profiles
  - Service providers can manage their own services and service areas
  - Service providers can view and update their jobs
  - Clients can view service provider profiles and reviews
  - Only job clients can create reviews for completed jobs
*/

-- Create service_provider_profiles table
CREATE TABLE IF NOT EXISTS service_provider_profiles (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  license_number text,
  insurance_verified boolean DEFAULT false,
  years_experience integer DEFAULT 0,
  bio text,
  service_radius_miles integer DEFAULT 25,
  average_rating decimal(3,2) DEFAULT 0.00,
  total_reviews integer DEFAULT 0,
  total_jobs_completed integer DEFAULT 0,
  profile_photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create service_categories table
CREATE TABLE IF NOT EXISTS service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create service_provider_services table
CREATE TABLE IF NOT EXISTS service_provider_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES service_provider_profiles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  description text,
  base_price decimal(10,2),
  created_at timestamptz DEFAULT now()
);

-- Create service_areas table
CREATE TABLE IF NOT EXISTS service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES service_provider_profiles(id) ON DELETE CASCADE,
  city text NOT NULL,
  state text NOT NULL,
  zip_code text,
  created_at timestamptz DEFAULT now()
);

-- Create service_jobs table
CREATE TABLE IF NOT EXISTS service_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES service_provider_profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  service_category_id uuid NOT NULL REFERENCES service_categories(id),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_date timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  estimated_hours decimal(10,2),
  actual_hours decimal(10,2),
  estimated_cost decimal(10,2),
  final_cost decimal(10,2),
  location_address text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create service_provider_reviews table
CREATE TABLE IF NOT EXISTS service_provider_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES service_provider_profiles(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id uuid REFERENCES service_jobs(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default service categories
INSERT INTO service_categories (name, description) VALUES
  ('Plumbing', 'Plumbing services including repairs, installations, and maintenance'),
  ('Electrical', 'Electrical work including wiring, fixtures, and repairs'),
  ('HVAC', 'Heating, ventilation, and air conditioning services'),
  ('Carpentry', 'Woodworking and carpentry services'),
  ('Painting', 'Interior and exterior painting services'),
  ('Roofing', 'Roof installation, repair, and maintenance'),
  ('Landscaping', 'Lawn care, gardening, and landscaping services'),
  ('Cleaning', 'Home and property cleaning services'),
  ('Home Inspection', 'Property inspection services'),
  ('Pest Control', 'Pest inspection and extermination services'),
  ('Flooring', 'Floor installation and refinishing'),
  ('General Contracting', 'General construction and renovation services')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE service_provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_provider_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_provider_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_provider_profiles
CREATE POLICY "Service providers can view own profile"
  ON service_provider_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Service providers can update own profile"
  ON service_provider_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service providers can insert own profile"
  ON service_provider_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Anyone can view service provider profiles"
  ON service_provider_profiles FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for service_categories
CREATE POLICY "Anyone can view service categories"
  ON service_categories FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for service_provider_services
CREATE POLICY "Service providers can manage own services"
  ON service_provider_services FOR ALL
  TO authenticated
  USING (provider_id = auth.uid())
  WITH CHECK (provider_id = auth.uid());

CREATE POLICY "Anyone can view service provider services"
  ON service_provider_services FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for service_areas
CREATE POLICY "Service providers can manage own service areas"
  ON service_areas FOR ALL
  TO authenticated
  USING (provider_id = auth.uid())
  WITH CHECK (provider_id = auth.uid());

CREATE POLICY "Anyone can view service areas"
  ON service_areas FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for service_jobs
CREATE POLICY "Service providers can view own jobs"
  ON service_jobs FOR SELECT
  TO authenticated
  USING (provider_id = auth.uid());

CREATE POLICY "Clients can view their jobs"
  ON service_jobs FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Clients can create jobs"
  ON service_jobs FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Service providers can update own jobs"
  ON service_jobs FOR UPDATE
  TO authenticated
  USING (provider_id = auth.uid())
  WITH CHECK (provider_id = auth.uid());

CREATE POLICY "Clients can update their jobs"
  ON service_jobs FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- RLS Policies for service_provider_reviews
CREATE POLICY "Anyone can view reviews"
  ON service_provider_reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Clients can create reviews for completed jobs"
  ON service_provider_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM service_jobs
      WHERE service_jobs.id = job_id
      AND service_jobs.client_id = auth.uid()
      AND service_jobs.status = 'completed'
    )
  );

CREATE POLICY "Reviewers can update own reviews"
  ON service_provider_reviews FOR UPDATE
  TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_service_provider_services_provider ON service_provider_services(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_areas_provider ON service_areas(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_jobs_provider ON service_jobs(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_jobs_client ON service_jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_service_jobs_status ON service_jobs(status);
CREATE INDEX IF NOT EXISTS idx_service_provider_reviews_provider ON service_provider_reviews(provider_id);

-- Create function to update average rating
CREATE OR REPLACE FUNCTION update_service_provider_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE service_provider_profiles
  SET 
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM service_provider_reviews
      WHERE provider_id = NEW.provider_id
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM service_provider_reviews
      WHERE provider_id = NEW.provider_id
    ),
    updated_at = now()
  WHERE id = NEW.provider_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for rating updates
DROP TRIGGER IF EXISTS update_provider_rating_trigger ON service_provider_reviews;
CREATE TRIGGER update_provider_rating_trigger
  AFTER INSERT OR UPDATE OR DELETE ON service_provider_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_service_provider_rating();

-- Create function to update job completion count
CREATE OR REPLACE FUNCTION update_jobs_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE service_provider_profiles
    SET 
      total_jobs_completed = total_jobs_completed + 1,
      updated_at = now()
    WHERE id = NEW.provider_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for job completion
DROP TRIGGER IF EXISTS update_jobs_completed_trigger ON service_jobs;
CREATE TRIGGER update_jobs_completed_trigger
  AFTER INSERT OR UPDATE ON service_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_jobs_completed();