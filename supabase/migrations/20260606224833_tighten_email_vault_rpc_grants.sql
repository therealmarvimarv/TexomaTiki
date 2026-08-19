-- Restrict secret_exists and secret_preview to service_role only.
-- The admin email UI never calls these RPCs directly — only edge functions
-- (service_role) call them. Removes the authenticated probe surface.

REVOKE EXECUTE ON FUNCTION email_settings_secret_exists(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION email_settings_secret_preview(text) FROM authenticated;

-- service_role grant is retained (was already granted)
