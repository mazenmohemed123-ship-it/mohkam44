-- Migration to fix database issues: RLS policies, memberships, payments, and appointments

-- 1. Add language column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'fr', 'tr'));

-- 2. Add sos_flag to case_emergencies
ALTER TABLE case_emergencies ADD COLUMN IF NOT EXISTS sos_flag BOOLEAN DEFAULT TRUE;

-- 3. Create memberships table
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, case_id)
);

-- 4. Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  client_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'EGP',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  paymob_order_id TEXT UNIQUE,
  paymob_transaction_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Fix appointment_requests table constraints
-- Make case_id optional
ALTER TABLE appointment_requests ALTER COLUMN case_id DROP NOT NULL;

-- Update status check constraint to include rescheduled/confirmed
ALTER TABLE appointment_requests DROP CONSTRAINT IF EXISTS appointment_requests_status_check;
ALTER TABLE appointment_requests ADD CONSTRAINT appointment_requests_status_check CHECK (status IN ('pending', 'accepted', 'confirmed', 'rejected', 'rescheduled'));

-- 6. Trigger to automatically link client cases on user signup/profile update
CREATE OR REPLACE FUNCTION public.link_client_cases()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'client' AND NEW.phone_number IS NOT NULL THEN
    UPDATE cases
    SET client_id = NEW.id
    WHERE client_phone = NEW.phone_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_link_client_cases
AFTER INSERT OR UPDATE OF phone_number, role ON profiles
FOR EACH ROW EXECUTE FUNCTION public.link_client_cases();

-- 6b. Trigger to automatically create a default GENERAL-CHAT case for client-lawyer chat
CREATE OR REPLACE FUNCTION public.create_default_client_case()
RETURNS TRIGGER AS $$
DECLARE
  case_exists BOOLEAN;
BEGIN
  IF NEW.role = 'client' AND NEW.phone_number IS NOT NULL AND NEW.linked_lawyer_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM cases
      WHERE lawyer_id = NEW.linked_lawyer_id AND client_phone = NEW.phone_number
    ) INTO case_exists;

    IF NOT case_exists THEN
      INSERT INTO cases (
        case_number,
        client_name,
        client_phone,
        case_type,
        judgment,
        total_fees,
        admin_fees,
        lawyer_id,
        client_id
      ) VALUES (
        'GENERAL-CHAT',
        NEW.full_name,
        NEW.phone_number,
        'محادثة عامة',
        'نشط',
        0,
        0,
        NEW.linked_lawyer_id,
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trigger_create_default_client_case
AFTER INSERT OR UPDATE OF phone_number, role, linked_lawyer_id ON profiles
FOR EACH ROW EXECUTE FUNCTION public.create_default_client_case();

-- 7. Enable RLS
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
-- Memberships policies
DROP POLICY IF EXISTS "select_memberships" ON memberships;
CREATE POLICY "select_memberships" ON memberships FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR case_id IN (SELECT id FROM cases WHERE lawyer_id = auth.uid() OR lawyer_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "insert_memberships" ON memberships;
CREATE POLICY "insert_memberships" ON memberships FOR INSERT TO authenticated
  WITH CHECK (
    case_id IN (SELECT id FROM cases WHERE lawyer_id = auth.uid() OR lawyer_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "delete_memberships" ON memberships;
CREATE POLICY "delete_memberships" ON memberships FOR DELETE TO authenticated
  USING (
    case_id IN (SELECT id FROM cases WHERE lawyer_id = auth.uid() OR lawyer_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid()))
  );

-- Payments policies
DROP POLICY IF EXISTS "select_payments" ON payments;
CREATE POLICY "select_payments" ON payments FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR case_id IN (SELECT id FROM cases WHERE lawyer_id = auth.uid() OR lawyer_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "insert_payments" ON payments;
CREATE POLICY "insert_payments" ON payments FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    OR case_id IN (SELECT id FROM cases WHERE lawyer_id = auth.uid() OR lawyer_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid()))
  );

-- Cases policy updates to allow phone number lookups
DROP POLICY IF EXISTS "select_lawyer_cases" ON cases;
CREATE POLICY "select_lawyer_cases" ON cases FOR SELECT TO authenticated
  USING (
    lawyer_id = auth.uid()
    OR client_id = auth.uid()
    OR client_phone IN (SELECT phone_number FROM profiles WHERE id = auth.uid())
    OR lawyer_id IN (SELECT id FROM profiles WHERE master_lawyer_id = auth.uid())
  );

-- Messages policy updates to support memberships and client phone match
DROP POLICY IF EXISTS "select_case_messages" ON messages;
CREATE POLICY "select_case_messages" ON messages FOR SELECT TO authenticated USING (
  -- Internal team chat
  (room_type = 'internal_team_chat' AND (
    team_id = auth.uid()
    OR team_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
  ))
  OR
  -- Client chat
  (room_type = 'client_chat' AND case_id IN (
    SELECT id FROM cases WHERE
      lawyer_id = auth.uid()
      OR client_id = auth.uid()
      OR client_phone IN (SELECT phone_number FROM profiles WHERE id = auth.uid())
      OR lawyer_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
  ))
  -- Or user is explicit member of the case (for team members)
  OR case_id IN (SELECT case_id FROM memberships WHERE user_id = auth.uid())
  OR room_type IS NULL
);

DROP POLICY IF EXISTS "insert_case_messages" ON messages;
CREATE POLICY "insert_case_messages" ON messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid()
  AND (
    (room_type = 'internal_team_chat' AND (
      team_id = auth.uid()
      OR team_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
    ))
    OR
    (room_type = 'client_chat' AND case_id IN (
      SELECT id FROM cases WHERE
        lawyer_id = auth.uid()
        OR client_id = auth.uid()
        OR client_phone IN (SELECT phone_number FROM profiles WHERE id = auth.uid())
        OR lawyer_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
    ))
    OR case_id IN (SELECT case_id FROM memberships WHERE user_id = auth.uid())
    OR room_type IS NULL
  )
);

-- Case emergencies policies updates
DROP POLICY IF EXISTS "insert_case_emergencies" ON case_emergencies;
CREATE POLICY "insert_case_emergencies" ON case_emergencies FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND case_id IN (
      SELECT id FROM cases
      WHERE lawyer_id = auth.uid()
        OR client_id = auth.uid()
        OR client_phone IN (SELECT phone_number FROM profiles WHERE id = auth.uid())
        OR lawyer_id IN (SELECT id FROM profiles WHERE master_lawyer_id = auth.uid())
        OR id IN (SELECT case_id FROM memberships WHERE user_id = auth.uid())
    )
  );

-- 9. Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE memberships;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
