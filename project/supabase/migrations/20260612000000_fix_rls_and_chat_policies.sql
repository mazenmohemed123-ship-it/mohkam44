-- Migration to fix cases RLS policies for team members and restore peer_chat message policies

-- 1. Correct cases RLS policies to allow team members (based on master_lawyer_id)
DROP POLICY IF EXISTS "select_lawyer_cases" ON cases;
CREATE POLICY "select_lawyer_cases" ON cases FOR SELECT TO authenticated
  USING (
    lawyer_id = auth.uid()
    OR client_id = auth.uid()
    OR client_phone IN (SELECT phone_number FROM profiles WHERE id = auth.uid())
    -- Checks if the case belongs to a teammate of the user
    OR lawyer_id IN (SELECT id FROM profiles WHERE master_lawyer_id = auth.uid())
    -- Checks if the case belongs to the master lawyer of the team member user
    OR lawyer_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "insert_lawyer_cases" ON cases;
CREATE POLICY "insert_lawyer_cases" ON cases FOR INSERT TO authenticated
  WITH CHECK (
    lawyer_id = auth.uid()
    OR lawyer_id IN (SELECT id FROM profiles WHERE master_lawyer_id = auth.uid())
    OR lawyer_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "update_lawyer_cases" ON cases;
CREATE POLICY "update_lawyer_cases" ON cases FOR UPDATE TO authenticated
  USING (
    lawyer_id = auth.uid()
    OR lawyer_id IN (SELECT id FROM profiles WHERE master_lawyer_id = auth.uid())
    OR lawyer_id IN (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid() AND master_lawyer_id IS NOT NULL)
  );


-- 2. Restore messages policies with peer_chat room type support
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
  OR
  -- Peer chat: sender or target can read
  (room_type = 'peer_chat' AND (sender_id = auth.uid() OR peer_target_id = auth.uid()))
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
    OR
    -- Peer chat: target must be a teammate (same master_lawyer_id or is the master lawyer)
    (room_type = 'peer_chat' AND peer_target_id IN (
      SELECT p2.id FROM profiles p2 WHERE
        p2.id = (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid())
        OR p2.master_lawyer_id = (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid())
        OR p2.master_lawyer_id = auth.uid()
        OR (p2.id = auth.uid() AND (SELECT master_lawyer_id FROM profiles WHERE id = auth.uid()) IS NULL AND p2.id IN (SELECT id FROM profiles WHERE master_lawyer_id = auth.uid()))
    ))
    OR case_id IN (SELECT case_id FROM memberships WHERE user_id = auth.uid())
    OR room_type IS NULL
  )
);
