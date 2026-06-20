-- ============================================================================
--  مُحكَم — Full database setup for a FRESH Supabase project
--  Run this ONCE in: Supabase Dashboard → SQL Editor → New query → Run.
--  It recreates every table, index, constraint, function, trigger, RLS policy,
--  realtime publication, and storage bucket the app needs.
--  (Designed for an empty project — safe to run top-to-bottom.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  full_name text DEFAULT 'مستخدم جديد'::text,
  phone_number text,
  role text DEFAULT 'lawyer'::text NOT NULL,
  tier text DEFAULT 'free'::text NOT NULL,
  office_address text,
  avatar_url text,
  bio text,
  is_emergency_enabled boolean DEFAULT true,
  linked_lawyer_id uuid,
  device_fingerprint text,
  fcm_token text,
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  cancelled_at timestamptz,
  master_lawyer_id uuid,
  can_view_billing boolean DEFAULT false,
  can_manage_appointments boolean DEFAULT true,
  can_edit_documents boolean DEFAULT false,
  can_reply_client_chats boolean DEFAULT true,
  vodafone_cash_number text,
  instapay_address text,
  bank_account_details jsonb DEFAULT '{}'::jsonb,
  staff_email text,
  staff_password_hash text,
  commission_debt numeric DEFAULT 0,
  commission_rate numeric DEFAULT 5,
  is_frozen boolean DEFAULT false,
  is_auto_renew_enabled boolean DEFAULT true,
  language text DEFAULT 'ar'::text,
  currency text DEFAULT 'EGP'::text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cases (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  case_number text NOT NULL,
  client_name text,
  client_phone text,
  case_type text,
  judgment text DEFAULT 'قيد الانتظار'::text,
  total_fees numeric DEFAULT 0,
  admin_fees numeric DEFAULT 0,
  lawyer_id uuid NOT NULL,
  client_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  follower_phones text[] DEFAULT '{}'::text[] NOT NULL
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  case_id uuid,
  sender_id uuid NOT NULL,
  sender_role text DEFAULT 'lawyer'::text,
  message_text text NOT NULL,
  is_deleted boolean DEFAULT false,
  room_type text DEFAULT 'client_chat'::text,
  team_id uuid,
  peer_target_id uuid,
  attachment_url text,
  attachment_type text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  client_msg_key text,
  delivered_at timestamptz,
  read_at timestamptz,
  deleted_at timestamptz,
  has_attachments boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  message_id uuid NOT NULL,
  file_url text NOT NULL,
  file_type text,
  mime_type text,
  file_size integer,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.case_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  case_id uuid NOT NULL,
  event_type text NOT NULL,
  event_description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_emergencies (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  case_id uuid NOT NULL,
  essential_needs text,
  emergency_costs numeric DEFAULT 0,
  needs_status text DEFAULT 'عاجل'::text,
  created_by uuid NOT NULL,
  resolved_at timestamptz,
  sos_flag boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointment_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  case_id uuid,
  client_id uuid NOT NULL,
  lawyer_id uuid NOT NULL,
  appointment_date text NOT NULL,
  appointment_time text,
  reason text,
  status text DEFAULT 'pending'::text,
  feedback text,
  alternative_time text,
  responded_by uuid,
  responded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  case_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer DEFAULT 0,
  storage_path text NOT NULL,
  download_token text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lawyer_availability (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lawyer_id uuid NOT NULL,
  available_days text[] DEFAULT ARRAY['saturday','sunday','monday','tuesday','wednesday','thursday'],
  time_slots text[] DEFAULT ARRAY['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'],
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  case_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  case_id uuid,
  client_id uuid,
  amount numeric NOT NULL,
  currency text DEFAULT 'EGP'::text,
  status text DEFAULT 'pending'::text,
  paymob_order_id text,
  paymob_transaction_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  discount_percent numeric DEFAULT 0,
  max_uses integer DEFAULT 1,
  used_count integer DEFAULT 0,
  expires_at timestamptz,
  tier_target text DEFAULT 'pro'::text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id uuid NOT NULL,
  usage_date date DEFAULT CURRENT_DATE NOT NULL,
  task text NOT NULL,
  count integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text,
  body text NOT NULL,
  audience text DEFAULT 'all'::text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ----------------------------------------------------------------------------
-- 2) PRIMARY KEYS / UNIQUE / CHECK
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.cases ADD CONSTRAINT cases_pkey PRIMARY KEY (id);
ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE public.message_attachments ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (id);
ALTER TABLE public.case_events ADD CONSTRAINT case_events_pkey PRIMARY KEY (id);
ALTER TABLE public.case_emergencies ADD CONSTRAINT case_emergencies_pkey PRIMARY KEY (id);
ALTER TABLE public.appointment_requests ADD CONSTRAINT appointment_requests_pkey PRIMARY KEY (id);
ALTER TABLE public.documents ADD CONSTRAINT documents_pkey PRIMARY KEY (id);
ALTER TABLE public.lawyer_availability ADD CONSTRAINT lawyer_availability_pkey PRIMARY KEY (id);
ALTER TABLE public.memberships ADD CONSTRAINT memberships_pkey PRIMARY KEY (id);
ALTER TABLE public.payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
ALTER TABLE public.coupons ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_usage_daily ADD CONSTRAINT ai_usage_daily_pkey PRIMARY KEY (user_id, usage_date, task);
ALTER TABLE public.announcements ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_device_fingerprint_key UNIQUE (device_fingerprint);
ALTER TABLE public.payments ADD CONSTRAINT payments_paymob_transaction_id_key UNIQUE (paymob_transaction_id);
ALTER TABLE public.payments ADD CONSTRAINT payments_paymob_order_id_key UNIQUE (paymob_order_id);
ALTER TABLE public.memberships ADD CONSTRAINT memberships_user_id_case_id_key UNIQUE (user_id, case_id);
ALTER TABLE public.coupons ADD CONSTRAINT coupons_code_key UNIQUE (code);
ALTER TABLE public.lawyer_availability ADD CONSTRAINT lawyer_availability_lawyer_id_key UNIQUE (lawyer_id);

ALTER TABLE public.profiles ADD CONSTRAINT profiles_tier_check CHECK ((tier = ANY (ARRAY['free','pro','team'])));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_language_check CHECK ((language = ANY (ARRAY['ar','en','fr','tr'])));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['owner','partner','lawyer','assistant','secretary','accountant','client','admin'])));
ALTER TABLE public.appointment_requests ADD CONSTRAINT appointment_requests_status_check CHECK ((status = ANY (ARRAY['pending','accepted','confirmed','rejected','rescheduled'])));
ALTER TABLE public.messages ADD CONSTRAINT messages_room_type_check CHECK ((room_type = ANY (ARRAY['client_chat','internal_team_chat','peer_chat'])));
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['pending','success','failed'])));
ALTER TABLE public.announcements ADD CONSTRAINT announcements_audience_check CHECK ((audience = ANY (ARRAY['all','lawyers','clients'])));

-- ----------------------------------------------------------------------------
-- 3) FOREIGN KEYS
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_linked_lawyer_id_fkey FOREIGN KEY (linked_lawyer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_master_lawyer_id_fkey FOREIGN KEY (master_lawyer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.cases ADD CONSTRAINT cases_lawyer_id_fkey FOREIGN KEY (lawyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.cases ADD CONSTRAINT cases_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD CONSTRAINT messages_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT messages_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD CONSTRAINT messages_peer_target_id_fkey FOREIGN KEY (peer_target_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.message_attachments ADD CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;
ALTER TABLE public.case_events ADD CONSTRAINT case_events_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;
ALTER TABLE public.case_emergencies ADD CONSTRAINT case_emergencies_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;
ALTER TABLE public.case_emergencies ADD CONSTRAINT case_emergencies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.appointment_requests ADD CONSTRAINT appointment_requests_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;
ALTER TABLE public.appointment_requests ADD CONSTRAINT appointment_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.appointment_requests ADD CONSTRAINT appointment_requests_lawyer_id_fkey FOREIGN KEY (lawyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.appointment_requests ADD CONSTRAINT appointment_requests_responded_by_fkey FOREIGN KEY (responded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD CONSTRAINT documents_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;
ALTER TABLE public.documents ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.lawyer_availability ADD CONSTRAINT lawyer_availability_lawyer_id_fkey FOREIGN KEY (lawyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD CONSTRAINT payments_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;
ALTER TABLE public.payments ADD CONSTRAINT payments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.ai_usage_daily ADD CONSTRAINT ai_usage_daily_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- 4) INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_master_lawyer ON public.profiles (master_lawyer_id);
CREATE INDEX IF NOT EXISTS idx_case_emergencies_case_id ON public.case_emergencies (case_id);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_lawyer_id ON public.appointment_requests (lawyer_id);
CREATE UNIQUE INDEX IF NOT EXISTS appointments_dedup_idx ON public.appointment_requests (lawyer_id, appointment_date, appointment_time) WHERE (status <> ALL (ARRAY['rejected','cancelled']));
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON public.documents (case_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_messages_case_id ON public.messages (case_id);
CREATE INDEX IF NOT EXISTS idx_messages_case_created ON public.messages (case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_room_type ON public.messages (room_type);
CREATE INDEX IF NOT EXISTS idx_messages_team_id ON public.messages (team_id);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer_id ON public.cases (lawyer_id);
CREATE INDEX IF NOT EXISTS idx_cases_client_phone ON public.cases (client_phone);
CREATE UNIQUE INDEX IF NOT EXISTS cases_dedup_idx ON public.cases (lawyer_id, case_number) WHERE (case_number <> 'GENERAL-CHAT'::text);
CREATE UNIQUE INDEX IF NOT EXISTS cases_general_chat_uniq ON public.cases (lawyer_id, client_id) WHERE (case_number = 'GENERAL-CHAT'::text);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON public.message_attachments (message_id);

-- ----------------------------------------------------------------------------
-- 5) FUNCTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone_number, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
    NEW.raw_user_meta_data->>'phone_number',
    COALESCE(NEW.raw_user_meta_data->>'role', 'lawyer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.create_default_client_case()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE case_exists BOOLEAN;
BEGIN
  IF NEW.role = 'client' AND NEW.phone_number IS NOT NULL AND NEW.linked_lawyer_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM cases WHERE lawyer_id = NEW.linked_lawyer_id AND client_phone = NEW.phone_number) INTO case_exists;
    IF NOT case_exists THEN
      INSERT INTO cases (case_number, client_name, client_phone, case_type, judgment, total_fees, admin_fees, lawyer_id, client_id)
      VALUES ('GENERAL-CHAT', NEW.full_name, NEW.phone_number, 'محادثة عامة', 'نشط', 0, 0, NEW.linked_lawyer_id, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.link_client_cases()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  IF NEW.role = 'client' AND NEW.phone_number IS NOT NULL THEN
    UPDATE cases SET client_id = NEW.id WHERE client_phone = NEW.phone_number;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.link_anonymous_client_to_chat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE existing_client_id UUID; existing_case_id UUID;
BEGIN
  IF NEW.role = 'client' AND NEW.phone_number IS NOT NULL AND NEW.linked_lawyer_id IS NOT NULL THEN
    SELECT id INTO existing_client_id FROM profiles
      WHERE phone_number = NEW.phone_number AND linked_lawyer_id = NEW.linked_lawyer_id AND role = 'client' AND id != NEW.id
      ORDER BY created_at ASC LIMIT 1;
    IF existing_client_id IS NOT NULL THEN
      SELECT id INTO existing_case_id FROM cases
        WHERE client_id = existing_client_id AND lawyer_id = NEW.linked_lawyer_id AND case_number = 'GENERAL-CHAT' LIMIT 1;
      IF existing_case_id IS NOT NULL THEN
        UPDATE cases SET client_id = NEW.id WHERE id = existing_case_id;
      END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM cases WHERE client_id = NEW.id AND lawyer_id = NEW.linked_lawyer_id AND case_number = 'GENERAL-CHAT') THEN
      INSERT INTO cases (case_number, client_name, client_phone, case_type, judgment, total_fees, admin_fees, lawyer_id, client_id)
      VALUES ('GENERAL-CHAT', NEW.full_name, NEW.phone_number, 'محادثة عامة', 'نشط', 0, 0, NEW.linked_lawyer_id, NEW.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.increment_commission_debt(amount numeric, lawyer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  UPDATE profiles SET commission_debt = COALESCE(commission_debt, 0) + amount WHERE id = lawyer_id;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_conversation_delivered(p_case_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  UPDATE public.messages SET delivered_at = now()
  WHERE case_id = p_case_id AND sender_id <> auth.uid() AND delivered_at IS NULL AND deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = p_case_id AND (
      c.client_id = auth.uid() OR c.lawyer_id = auth.uid()
      OR c.lawyer_id = (SELECT master_lawyer_id FROM public.profiles WHERE id = auth.uid())
      OR c.lawyer_id IN (SELECT id FROM public.profiles WHERE master_lawyer_id = auth.uid())));
END; $$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_case_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  UPDATE public.messages SET read_at = now(), delivered_at = COALESCE(delivered_at, now())
  WHERE case_id = p_case_id AND sender_id <> auth.uid() AND read_at IS NULL AND deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.cases c WHERE c.id = p_case_id AND (
      c.client_id = auth.uid() OR c.lawyer_id = auth.uid()
      OR c.lawyer_id = (SELECT master_lawyer_id FROM public.profiles WHERE id = auth.uid())
      OR c.lawyer_id IN (SELECT id FROM public.profiles WHERE master_lawyer_id = auth.uid())));
END; $$;

CREATE OR REPLACE FUNCTION public.check_office_access(p_lawyer_id uuid, p_phone text)
RETURNS TABLE(office_id uuid, client_name text, match_count integer)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
  WITH office AS (
    SELECT COALESCE((SELECT master_lawyer_id FROM public.profiles WHERE id = p_lawyer_id), p_lawyer_id) AS oid
  )
  SELECT o.oid,
    (SELECT c.client_name FROM public.cases c
       WHERE c.lawyer_id = o.oid AND (c.client_phone = p_phone OR p_phone = ANY(c.follower_phones))
       ORDER BY (c.client_phone = p_phone) DESC LIMIT 1),
    (SELECT count(*)::int FROM public.cases c
       WHERE c.lawyer_id = o.oid AND (c.client_phone = p_phone OR p_phone = ANY(c.follower_phones)))
  FROM office o;
$$;

CREATE OR REPLACE FUNCTION public.post_announcement(p_title text, p_body text, p_audience text)
RETURNS public.announcements LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_row public.announcements;
BEGIN
  -- ↓↓↓ ضع بريد الأدمن هنا ↓↓↓
  IF v_email NOT IN ('mazenmohemed123@gmail.com', 'mazen@mazen.engineer') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  INSERT INTO public.announcements (title, body, audience, created_by)
  VALUES (p_title, p_body, COALESCE(p_audience, 'all'), auth.uid())
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') AND object_type IN ('table','partitioned table')
  LOOP
    IF cmd.schema_name = 'public' THEN
      BEGIN EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
  END LOOP;
END; $$;

-- ----------------------------------------------------------------------------
-- 6) TRIGGERS
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trigger_link_client_cases ON public.profiles;
CREATE TRIGGER trigger_link_client_cases AFTER INSERT OR UPDATE OF phone_number, role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.link_client_cases();

DROP TRIGGER IF EXISTS trigger_create_default_client_case ON public.profiles;
CREATE TRIGGER trigger_create_default_client_case AFTER INSERT OR UPDATE OF phone_number, role, linked_lawyer_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_default_client_case();

DROP TRIGGER IF EXISTS trigger_link_anonymous_client ON public.profiles;
CREATE TRIGGER trigger_link_anonymous_client AFTER INSERT OR UPDATE OF phone_number, linked_lawyer_id, role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.link_anonymous_client_to_chat();

-- ----------------------------------------------------------------------------
-- 7) ENABLE RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_emergencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lawyer_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 8) RLS POLICIES
-- ----------------------------------------------------------------------------
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));
CREATE POLICY admin_update_all_profiles ON public.profiles FOR UPDATE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM profiles p1 WHERE ((p1.id = auth.uid()) AND (p1.role = 'admin')))));

CREATE POLICY cases_select ON public.cases FOR SELECT TO authenticated
  USING (((lawyer_id = auth.uid()) OR (client_id = auth.uid()) OR (lawyer_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.master_lawyer_id = auth.uid()))) OR (auth.uid() IN ( SELECT profiles.id FROM profiles WHERE (profiles.master_lawyer_id = ( SELECT profiles_1.master_lawyer_id FROM profiles profiles_1 WHERE (profiles_1.id = cases.lawyer_id)))))));
CREATE POLICY cases_insert ON public.cases FOR INSERT TO authenticated
  WITH CHECK (((lawyer_id = auth.uid()) OR (lawyer_id = ( SELECT p.master_lawyer_id FROM profiles p WHERE (p.id = auth.uid()))) OR ((client_id = auth.uid()) AND (case_number = 'GENERAL-CHAT'))));
CREATE POLICY cases_update ON public.cases FOR UPDATE TO authenticated
  USING (((lawyer_id = auth.uid()) OR (lawyer_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.master_lawyer_id = auth.uid())))));
CREATE POLICY cases_delete ON public.cases FOR DELETE TO authenticated USING ((lawyer_id = auth.uid()));

CREATE POLICY messages_select ON public.messages FOR SELECT TO authenticated
  USING ((((room_type = 'client_chat') AND (case_id IN ( SELECT cases.id FROM cases WHERE ((cases.lawyer_id = auth.uid()) OR (cases.client_id = auth.uid()) OR (cases.lawyer_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.master_lawyer_id = auth.uid()))))))) OR ((room_type = 'internal_team_chat') AND ((team_id = auth.uid()) OR (auth.uid() IN ( SELECT profiles.id FROM profiles WHERE (profiles.master_lawyer_id = messages.team_id))) OR (team_id IN ( SELECT profiles.master_lawyer_id FROM profiles WHERE (profiles.id = auth.uid()))))) OR ((room_type = 'peer_chat') AND ((sender_id = auth.uid()) OR (peer_target_id = auth.uid()))) OR (room_type IS NULL)));
CREATE POLICY messages_insert ON public.messages FOR INSERT TO authenticated
  WITH CHECK (((sender_id = auth.uid()) AND (((room_type = 'client_chat') AND (case_id IN ( SELECT cases.id FROM cases WHERE ((cases.lawyer_id = auth.uid()) OR (cases.client_id = auth.uid()) OR (cases.lawyer_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.master_lawyer_id = auth.uid()))))))) OR ((room_type = 'internal_team_chat') AND ((team_id = auth.uid()) OR (auth.uid() IN ( SELECT profiles.id FROM profiles WHERE (profiles.master_lawyer_id = messages.team_id))) OR (team_id IN ( SELECT profiles.master_lawyer_id FROM profiles WHERE (profiles.id = auth.uid()))))) OR ((room_type = 'peer_chat') AND ((peer_target_id = auth.uid()) OR (peer_target_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.master_lawyer_id = auth.uid()))) OR (peer_target_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.master_lawyer_id = ( SELECT profiles_1.master_lawyer_id FROM profiles profiles_1 WHERE (profiles_1.id = auth.uid()))))))) OR (room_type IS NULL))));
CREATE POLICY messages_update ON public.messages FOR UPDATE TO authenticated USING ((sender_id = auth.uid()));

CREATE POLICY attachments_select ON public.message_attachments FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1 FROM messages m WHERE (m.id = message_attachments.message_id))));
CREATE POLICY attachments_insert ON public.message_attachments FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM messages m WHERE ((m.id = message_attachments.message_id) AND (m.sender_id = auth.uid())))));

CREATE POLICY select_case_events ON public.case_events FOR SELECT TO authenticated
  USING ((case_id IN ( SELECT cases.id FROM cases WHERE ((cases.lawyer_id = auth.uid()) OR (cases.client_id = auth.uid())))));
CREATE POLICY insert_case_events ON public.case_events FOR INSERT TO authenticated
  WITH CHECK ((case_id IN ( SELECT cases.id FROM cases WHERE (cases.lawyer_id = auth.uid()))));

CREATE POLICY select_case_emergencies ON public.case_emergencies FOR SELECT TO authenticated
  USING ((case_id IN ( SELECT cases.id FROM cases WHERE ((cases.lawyer_id = auth.uid()) OR (cases.client_id = auth.uid()) OR (cases.lawyer_id IN ( SELECT profiles.master_lawyer_id FROM profiles WHERE (profiles.id = auth.uid())))))));
CREATE POLICY insert_case_emergencies ON public.case_emergencies FOR INSERT TO authenticated WITH CHECK ((created_by = auth.uid()));
CREATE POLICY update_case_emergencies ON public.case_emergencies FOR UPDATE TO authenticated
  USING ((case_id IN ( SELECT cases.id FROM cases WHERE ((cases.lawyer_id = auth.uid()) OR (cases.lawyer_id IN ( SELECT profiles.master_lawyer_id FROM profiles WHERE (profiles.id = auth.uid())))))));

CREATE POLICY appt_select ON public.appointment_requests FOR SELECT TO authenticated
  USING (((lawyer_id = auth.uid()) OR (client_id = auth.uid()) OR (lawyer_id IN ( SELECT profiles.id FROM profiles WHERE (profiles.master_lawyer_id = auth.uid())))));
CREATE POLICY appt_insert ON public.appointment_requests FOR INSERT TO authenticated
  WITH CHECK (((client_id = auth.uid()) OR (lawyer_id = auth.uid()) OR (lawyer_id = ( SELECT p.master_lawyer_id FROM profiles p WHERE (p.id = auth.uid())))));
CREATE POLICY appt_update ON public.appointment_requests FOR UPDATE TO authenticated
  USING (((lawyer_id = auth.uid()) OR (lawyer_id = ( SELECT p.master_lawyer_id FROM profiles p WHERE (p.id = auth.uid())))))
  WITH CHECK (((lawyer_id = auth.uid()) OR (lawyer_id = ( SELECT p.master_lawyer_id FROM profiles p WHERE (p.id = auth.uid())))));

CREATE POLICY docs_select ON public.documents FOR SELECT TO authenticated
  USING ((case_id IN ( SELECT cases.id FROM cases WHERE ((cases.lawyer_id = auth.uid()) OR (cases.client_id = auth.uid())))));
CREATE POLICY docs_insert ON public.documents FOR INSERT TO authenticated WITH CHECK ((uploaded_by = auth.uid()));
CREATE POLICY docs_delete ON public.documents FOR DELETE TO authenticated USING ((uploaded_by = auth.uid()));

CREATE POLICY select_lawyer_availability ON public.lawyer_availability FOR SELECT TO authenticated
  USING (((lawyer_id = auth.uid()) OR (lawyer_id IN ( SELECT profiles.master_lawyer_id FROM profiles WHERE (profiles.id = auth.uid())))));
CREATE POLICY insert_lawyer_availability ON public.lawyer_availability FOR INSERT TO authenticated WITH CHECK ((lawyer_id = auth.uid()));
CREATE POLICY update_lawyer_availability ON public.lawyer_availability FOR UPDATE TO authenticated USING ((lawyer_id = auth.uid()));

CREATE POLICY select_memberships ON public.memberships FOR SELECT TO authenticated
  USING (((user_id = auth.uid()) OR (case_id IN ( SELECT cases.id FROM cases WHERE (cases.lawyer_id = auth.uid())))));
CREATE POLICY insert_memberships ON public.memberships FOR INSERT TO authenticated
  WITH CHECK ((case_id IN ( SELECT cases.id FROM cases WHERE (cases.lawyer_id = auth.uid()))));
CREATE POLICY delete_memberships ON public.memberships FOR DELETE TO authenticated
  USING ((case_id IN ( SELECT cases.id FROM cases WHERE (cases.lawyer_id = auth.uid()))));

CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated
  USING (((client_id = auth.uid()) OR (case_id IN ( SELECT cases.id FROM cases WHERE (cases.lawyer_id = auth.uid())))));
CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK (((client_id = auth.uid()) OR (case_id IN ( SELECT cases.id FROM cases WHERE (cases.lawyer_id = auth.uid())))));

CREATE POLICY coupons_select ON public.coupons FOR SELECT TO authenticated USING (true);
CREATE POLICY coupons_insert_admin ON public.coupons FOR INSERT TO authenticated
  WITH CHECK ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin')))));
CREATE POLICY coupons_delete_admin ON public.coupons FOR DELETE TO authenticated
  USING ((EXISTS ( SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin')))));

CREATE POLICY ai_usage_select_own ON public.ai_usage_daily FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY announcements_select ON public.announcements FOR SELECT TO authenticated
  USING ((is_active AND ((audience = 'all') OR ((audience = 'lawyers') AND (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['owner','partner','lawyer','assistant','secretary','accountant'])))))) OR ((audience = 'clients') AND (EXISTS ( SELECT 1 FROM profiles p WHERE ((p.id = auth.uid()) AND (p.role = 'client'))))))));

-- ----------------------------------------------------------------------------
-- 9) FUNCTION EXECUTE GRANTS (keep internal triggers off the public API)
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_client_case() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_client_cases() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_anonymous_client_to_chat() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.increment_commission_debt(numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_delivered(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_announcement(text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.check_office_access(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_office_access(uuid, text) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10) REALTIME
-- ----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.cases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_attachments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.case_emergencies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.memberships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;

-- ----------------------------------------------------------------------------
-- 11) STORAGE BUCKETS + POLICIES (documents + chat attachments)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS mohkam_storage_read ON storage.objects;
CREATE POLICY mohkam_storage_read ON storage.objects FOR SELECT TO public
  USING (bucket_id IN ('documents','chat-attachments'));
DROP POLICY IF EXISTS mohkam_storage_insert ON storage.objects;
CREATE POLICY mohkam_storage_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('documents','chat-attachments'));
DROP POLICY IF EXISTS mohkam_storage_update ON storage.objects;
CREATE POLICY mohkam_storage_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('documents','chat-attachments'));
DROP POLICY IF EXISTS mohkam_storage_delete ON storage.objects;
CREATE POLICY mohkam_storage_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('documents','chat-attachments'));

-- ----------------------------------------------------------------------------
-- 12) AUTO-RLS EVENT TRIGGER (optional convenience)
-- ----------------------------------------------------------------------------
DROP EVENT TRIGGER IF EXISTS ensure_rls;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end EXECUTE FUNCTION public.rls_auto_enable();

-- ✅ Done. Next: enable Anonymous sign-ins in Auth settings, deploy edge functions,
--    set secrets, and make your account an admin (see NEW_SUPABASE_SETUP.md).
