/*
  # Tighten public_availability view grants to SELECT-only

  ## Summary
  The view inherited broad default grants (INSERT, UPDATE, DELETE, TRUNCATE,
  REFERENCES, TRIGGER) for anon and authenticated roles. These are inert because
  the view has no INSTEAD OF triggers and the underlying tables have RLS, but
  the excess grants are noise that should be removed.

  This migration revokes everything from anon and authenticated on the view
  and re-grants only SELECT, matching the intended security model:
  "anon and authenticated may read availability; nothing else."
*/

REVOKE ALL ON public_availability FROM anon, authenticated;
GRANT SELECT ON public_availability TO anon, authenticated;
