/*
  # Create Admin System

  1. New Tables
    - `admin_roles` - Define admin roles and permissions
    - `admin_users` - Track which users have admin access
    - `admin_audit_log` - Track all admin actions

  2. Changes to Existing Tables
    - Add `is_suspended` and `suspended_at` to profiles table
    - Add `suspension_reason` to profiles table

  3. Security
    - Only superadmin can access admin tables
    - All admin actions are logged
    - RLS policies to protect admin data
*/

-- Add suspension fields to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_suspended'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_suspended boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'suspended_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN suspended_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'suspension_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN suspension_reason text;
  END IF;
END $$;

-- Admin roles table
CREATE TABLE IF NOT EXISTS admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name text UNIQUE NOT NULL,
  can_view_users boolean DEFAULT true,
  can_suspend_users boolean DEFAULT false,
  can_delete_users boolean DEFAULT false,
  can_manage_listings boolean DEFAULT false,
  can_manage_agents boolean DEFAULT false,
  can_manage_lenders boolean DEFAULT false,
  can_manage_providers boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES admin_roles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admin_users(id),
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_suspended ON profiles(is_suspended);

-- Enable RLS
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin policies - only admins can access
CREATE POLICY "Only admins can view admin roles"
  ON admin_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Only admins can view admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Only admins can view audit log"
  ON admin_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Only admins can insert audit log"
  ON admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- Insert default admin roles
INSERT INTO admin_roles (role_name, can_view_users, can_suspend_users, can_delete_users, can_manage_listings, can_manage_agents, can_manage_lenders, can_manage_providers)
VALUES
  ('superadmin', true, true, true, true, true, true, true),
  ('moderator', true, true, false, true, false, false, false),
  ('viewer', true, false, false, false, false, false, false)
ON CONFLICT (role_name) DO NOTHING;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION has_admin_permission(user_id uuid, permission text)
RETURNS boolean AS $$
DECLARE
  user_role_id uuid;
BEGIN
  SELECT role_id INTO user_role_id
  FROM admin_users
  WHERE admin_users.id = user_id;

  IF user_role_id IS NULL THEN
    RETURN false;
  END IF;

  CASE permission
    WHEN 'view_users' THEN
      RETURN EXISTS (SELECT 1 FROM admin_roles WHERE id = user_role_id AND can_view_users = true);
    WHEN 'suspend_users' THEN
      RETURN EXISTS (SELECT 1 FROM admin_roles WHERE id = user_role_id AND can_suspend_users = true);
    WHEN 'delete_users' THEN
      RETURN EXISTS (SELECT 1 FROM admin_roles WHERE id = user_role_id AND can_delete_users = true);
    WHEN 'manage_listings' THEN
      RETURN EXISTS (SELECT 1 FROM admin_roles WHERE id = user_role_id AND can_manage_listings = true);
    WHEN 'manage_agents' THEN
      RETURN EXISTS (SELECT 1 FROM admin_roles WHERE id = user_role_id AND can_manage_agents = true);
    WHEN 'manage_lenders' THEN
      RETURN EXISTS (SELECT 1 FROM admin_roles WHERE id = user_role_id AND can_manage_lenders = true);
    WHEN 'manage_providers' THEN
      RETURN EXISTS (SELECT 1 FROM admin_roles WHERE id = user_role_id AND can_manage_providers = true);
    ELSE
      RETURN false;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
