-- 1) Pin a stable search_path on flagged SECURITY DEFINER functions (fixes "function_search_path_mutable")
ALTER FUNCTION public.link_client_cases() SET search_path = public, pg_temp;
ALTER FUNCTION public.create_default_client_case() SET search_path = public, pg_temp;
ALTER FUNCTION public.link_anonymous_client_to_chat() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.rls_auto_enable() SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_commission_debt(amount numeric, lawyer_id uuid) SET search_path = public, pg_temp;

-- 2) Stop exposing internal/trigger SECURITY DEFINER functions through the public REST API.
--    (increment_commission_debt is intentionally kept callable by authenticated lawyers.)
REVOKE EXECUTE ON FUNCTION public.create_default_client_case() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_anonymous_client_to_chat() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_client_cases() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- 3) Allow office staff (whose master_lawyer_id points at the owner) to respond to
--    appointments, not only the owner. The previous policy had the relationship
--    inverted, which silently blocked staff updates.
DROP POLICY IF EXISTS appt_update ON public.appointment_requests;
CREATE POLICY appt_update ON public.appointment_requests
  FOR UPDATE TO authenticated
  USING (
    lawyer_id = auth.uid()
    OR lawyer_id = (SELECT p.master_lawyer_id FROM public.profiles p WHERE p.id = auth.uid())
  )
  WITH CHECK (
    lawyer_id = auth.uid()
    OR lawyer_id = (SELECT p.master_lawyer_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 4) Replace "always true" INSERT policies with ownership checks (fixes rls_policy_always_true)
DROP POLICY IF EXISTS appt_insert ON public.appointment_requests;
CREATE POLICY appt_insert ON public.appointment_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    OR lawyer_id = auth.uid()
    OR lawyer_id = (SELECT p.master_lawyer_id FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS insert_case_emergencies ON public.case_emergencies;
CREATE POLICY insert_case_emergencies ON public.case_emergencies
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS docs_insert ON public.documents;
CREATE POLICY docs_insert ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());
