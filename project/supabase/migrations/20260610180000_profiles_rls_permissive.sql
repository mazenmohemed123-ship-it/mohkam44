-- Migration to allow all authenticated users to read profile details.
-- This ensures that team members, lawyers, and clients can resolve names and avatars.

DROP POLICY IF EXISTS "select_profiles_auth_permissive" ON profiles;
CREATE POLICY "select_profiles_auth_permissive" ON profiles FOR SELECT TO authenticated USING (true);
