/*
# Tighten anon access on account_settings to public branding/SEO columns only

1. Purpose
   - The public homepage (anon key) needs to read only the branding and SEO fields
     from account_settings: logo_url, favicon_url, seo_title, seo_meta_description,
     show_tagline_badges, header_taglines, header_tagline_color, header_badges,
     and property_id (for the filter).
   - Previously anon had a broad SELECT policy + table-level SELECT grant on ALL columns,
     exposing sensitive fields like owner_name, owner_email, owner_phone, manager_email,
     manager_phone, suggested_door_code, support_email, support_phone, etc.
   - This migration removes the broad anon SELECT policy, revokes the table-level
     SELECT grant from anon, then grants SELECT on ONLY the public branding/SEO columns.
   - A new anon SELECT RLS policy (USING true) is kept so the permitted columns remain
     publicly readable. RLS still applies; the column-level grant restricts WHICH columns
     anon can touch.

2. Changes
   - DROP POLICY "select_account_settings_anon" (the old broad anon SELECT).
   - REVOKE SELECT on account_settings FROM anon (removes table-level grant).
   - GRANT SELECT (property_id, logo_url, favicon_url, seo_title, seo_meta_description,
     show_tagline_badges, header_taglines, header_tagline_color, header_badges)
     ON account_settings TO anon.
   - Re-create the anon SELECT policy "select_account_settings_anon" with USING (true).
     Combined with the column-level grant, anon can now SELECT only the listed columns.

3. Security
   - All authenticated policies (select/insert/update/delete) remain unchanged.
   - authenticated retains full table-level CRUD grants.
   - anon loses INSERT, UPDATE, DELETE table-level grants as well (they were present
     but unused by the public frontend; the public site only reads branding fields).
   - anon can no longer read sensitive fields such as owner_email, owner_phone,
     manager_email, manager_phone, suggested_door_code, support_email, etc.

4. Data safety
   - No columns, tables, or data are modified or removed.
   - No frontend code changes required; the existing queries only select the
     permitted public columns.
*/

-- 1. Remove the old broad anon SELECT policy
DROP POLICY IF EXISTS "select_account_settings_anon" ON account_settings;

-- 2. Revoke all table-level privileges from anon (SELECT, INSERT, UPDATE, DELETE)
REVOKE SELECT, INSERT, UPDATE, DELETE ON account_settings FROM anon;

-- 3. Grant SELECT on only the public branding/SEO columns to anon
GRANT SELECT (
  property_id,
  logo_url,
  favicon_url,
  seo_title,
  seo_meta_description,
  show_tagline_badges,
  header_taglines,
  header_tagline_color,
  header_badges
) ON account_settings TO anon;

-- 4. Re-create the anon SELECT RLS policy (USING true) so the permitted columns are readable
CREATE POLICY "select_account_settings_anon"
  ON account_settings FOR SELECT
  TO anon
  USING (true);
