-- Migration to add admin update profiles RLS policy

DROP POLICY IF EXISTS "admin_update_all_profiles" ON profiles;

CREATE POLICY "admin_update_all_profiles" 
ON profiles FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);
