/*
# Add administrator SELECT policies for content tables

## Purpose
Allows authenticated administrators to retrieve hidden (is_active = false)
records from the four content tables. Without these policies, the admin
Content Editor cannot see hidden items after page reload, making the
Show button unreachable.

## Security
- Uses the existing public.is_admin_user() authorization function.
- Policies are additive: the existing "Public can read active [table]"
  SELECT policy (TO anon, authenticated, USING is_active = true) remains
  unchanged. PostgreSQL OR-combines permissive SELECT policies, so:
    - anon/non-admin authenticated users still see only active rows
    - authenticated admins see all rows (active + hidden)
- No changes to INSERT, UPDATE, or DELETE policies.
- No changes to tables, columns, or the is_admin_user() function.

## Tables affected
- public.faqs
- public.house_rules
- public.property_policies
- public.local_recommendations
*/

-- faqs
DROP POLICY IF EXISTS "Admins can read all faqs" ON public.faqs;
CREATE POLICY "Admins can read all faqs"
  ON public.faqs FOR SELECT TO authenticated
  USING (public.is_admin_user());

-- house_rules
DROP POLICY IF EXISTS "Admins can read all house_rules" ON public.house_rules;
CREATE POLICY "Admins can read all house_rules"
  ON public.house_rules FOR SELECT TO authenticated
  USING (public.is_admin_user());

-- property_policies
DROP POLICY IF EXISTS "Admins can read all property_policies" ON public.property_policies;
CREATE POLICY "Admins can read all property_policies"
  ON public.property_policies FOR SELECT TO authenticated
  USING (public.is_admin_user());

-- local_recommendations
DROP POLICY IF EXISTS "Admins can read all local_recommendations" ON public.local_recommendations;
CREATE POLICY "Admins can read all local_recommendations"
  ON public.local_recommendations FOR SELECT TO authenticated
  USING (public.is_admin_user());