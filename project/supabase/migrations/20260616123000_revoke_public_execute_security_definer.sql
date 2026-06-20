-- The earlier REVOKE from anon/authenticated had no effect because EXECUTE is granted
-- to those roles implicitly via PUBLIC. Revoke from PUBLIC instead.
-- All five are internal trigger / maintenance functions (verified: 4 are attached to
-- triggers on auth.users / public.profiles, and none are invoked via the app's REST RPC),
-- so trigger execution is unaffected — this only closes the public /rpc exposure.
REVOKE EXECUTE ON FUNCTION public.create_default_client_case() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_anonymous_client_to_chat() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_client_cases() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
