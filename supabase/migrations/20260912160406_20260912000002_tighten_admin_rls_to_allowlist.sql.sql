/*
# Tighten client-admin RLS to admin_users allowlist

## Purpose
Replace all broad authenticated-access RLS conditions (auth.uid() IS NOT NULL or true)
on client-admin tables with an admin_users allowlist check.

## Tables modified (admin write/select policies tightened):
account_settings, amenities, amenity_categories, blocked_dates, booking_internal_notes,
bookings, cleaning_tasks, contact_info, date_availability_overrides, date_price_overrides,
day_of_week_rates, email_automation_sends, email_automations, email_settings,
email_templates, faqs, highlights, house_rules, ical_sources, inquiries,
local_recommendations, maintenance_notes, neighborhood_highlights, notification_logs,
owner_blocks, payment_events, payment_settings, photo_section_features, photo_sections,
properties, property_amenities, property_fees, property_images, property_policies,
reviews, seasonal_pricing_presets, sleeping_arrangements, users

## Preserved (NOT changed):
- All public/anon SELECT policies (public website reads)
- All service_role policies (edge function access)
- users table UPDATE policy (ownership-based: auth.uid() = id)
- email_templates anon_no_access policy (explicit deny)
- email_templates is_system conditions (preserved alongside admin check)
- admin_users table policies
- Platform/SaaS tables (not client-admin)
*/

-- Helper function for admin check
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
$$;

-- account_settings
DROP POLICY IF EXISTS "delete_account_settings" ON account_settings;
CREATE POLICY "delete_account_settings" ON account_settings FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "insert_account_settings" ON account_settings;
CREATE POLICY "insert_account_settings" ON account_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "select_account_settings" ON account_settings;
CREATE POLICY "select_account_settings" ON account_settings FOR SELECT TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "update_account_settings" ON account_settings;
CREATE POLICY "update_account_settings" ON account_settings FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- amenities
DROP POLICY IF EXISTS "Authenticated users can delete amenities" ON amenities;
CREATE POLICY "Authenticated users can delete amenities" ON amenities FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert amenities" ON amenities;
CREATE POLICY "Authenticated users can insert amenities" ON amenities FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update amenities" ON amenities;
CREATE POLICY "Authenticated users can update amenities" ON amenities FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- amenity_categories
DROP POLICY IF EXISTS "Authenticated users can delete amenity categories" ON amenity_categories;
CREATE POLICY "Authenticated users can delete amenity categories" ON amenity_categories FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert amenity categories" ON amenity_categories;
CREATE POLICY "Authenticated users can insert amenity categories" ON amenity_categories FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update amenity categories" ON amenity_categories;
CREATE POLICY "Authenticated users can update amenity categories" ON amenity_categories FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- blocked_dates
DROP POLICY IF EXISTS "Authenticated users can delete blocked dates" ON blocked_dates;
CREATE POLICY "Authenticated users can delete blocked dates" ON blocked_dates FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert blocked dates" ON blocked_dates;
CREATE POLICY "Authenticated users can insert blocked dates" ON blocked_dates FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can read blocked dates" ON blocked_dates;
CREATE POLICY "Authenticated users can read blocked dates" ON blocked_dates FOR SELECT TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update blocked dates" ON blocked_dates;
CREATE POLICY "Authenticated users can update blocked dates" ON blocked_dates FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- booking_internal_notes
DROP POLICY IF EXISTS "Authenticated users can delete booking_internal_notes" ON booking_internal_notes;
CREATE POLICY "Authenticated users can delete booking_internal_notes" ON booking_internal_notes FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert booking_internal_notes" ON booking_internal_notes;
CREATE POLICY "Authenticated users can insert booking_internal_notes" ON booking_internal_notes FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can select booking_internal_notes" ON booking_internal_notes;
CREATE POLICY "Authenticated users can select booking_internal_notes" ON booking_internal_notes FOR SELECT TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update booking_internal_notes" ON booking_internal_notes;
CREATE POLICY "Authenticated users can update booking_internal_notes" ON booking_internal_notes FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- bookings
DROP POLICY IF EXISTS "Authenticated users can delete bookings" ON bookings;
CREATE POLICY "Authenticated users can delete bookings" ON bookings FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can read all bookings" ON bookings;
CREATE POLICY "Authenticated users can read all bookings" ON bookings FOR SELECT TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update bookings" ON bookings;
CREATE POLICY "Authenticated users can update bookings" ON bookings FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- cleaning_tasks
DROP POLICY IF EXISTS "Authenticated users can delete cleaning_tasks" ON cleaning_tasks;
CREATE POLICY "Authenticated users can delete cleaning_tasks" ON cleaning_tasks FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert cleaning_tasks" ON cleaning_tasks;
CREATE POLICY "Authenticated users can insert cleaning_tasks" ON cleaning_tasks FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can select cleaning_tasks" ON cleaning_tasks;
CREATE POLICY "Authenticated users can select cleaning_tasks" ON cleaning_tasks FOR SELECT TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update cleaning_tasks" ON cleaning_tasks;
CREATE POLICY "Authenticated users can update cleaning_tasks" ON cleaning_tasks FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- contact_info
DROP POLICY IF EXISTS "Authenticated users can delete contact info" ON contact_info;
CREATE POLICY "Authenticated users can delete contact info" ON contact_info FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert contact info" ON contact_info;
CREATE POLICY "Authenticated users can insert contact info" ON contact_info FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update contact info" ON contact_info;
CREATE POLICY "Authenticated users can update contact info" ON contact_info FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- date_availability_overrides
DROP POLICY IF EXISTS "Authenticated users can delete date availability overrides" ON date_availability_overrides;
CREATE POLICY "Authenticated users can delete date availability overrides" ON date_availability_overrides FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert date availability overrides" ON date_availability_overrides;
CREATE POLICY "Authenticated users can insert date availability overrides" ON date_availability_overrides FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update date availability overrides" ON date_availability_overrides;
CREATE POLICY "Authenticated users can update date availability overrides" ON date_availability_overrides FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- date_price_overrides
DROP POLICY IF EXISTS "Authenticated users can delete date price overrides" ON date_price_overrides;
CREATE POLICY "Authenticated users can delete date price overrides" ON date_price_overrides FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert date price overrides" ON date_price_overrides;
CREATE POLICY "Authenticated users can insert date price overrides" ON date_price_overrides FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update date price overrides" ON date_price_overrides;
CREATE POLICY "Authenticated users can update date price overrides" ON date_price_overrides FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- day_of_week_rates
DROP POLICY IF EXISTS "Authenticated users can delete day of week rates" ON day_of_week_rates;
CREATE POLICY "Authenticated users can delete day of week rates" ON day_of_week_rates FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert day of week rates" ON day_of_week_rates;
CREATE POLICY "Authenticated users can insert day of week rates" ON day_of_week_rates FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update day of week rates" ON day_of_week_rates;
CREATE POLICY "Authenticated users can update day of week rates" ON day_of_week_rates FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- email_automation_sends
DROP POLICY IF EXISTS "select_email_automation_sends" ON email_automation_sends;
CREATE POLICY "select_email_automation_sends" ON email_automation_sends FOR SELECT TO authenticated USING (public.is_admin_user());

-- email_automations
DROP POLICY IF EXISTS "delete_email_automations" ON email_automations;
CREATE POLICY "delete_email_automations" ON email_automations FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "insert_email_automations" ON email_automations;
CREATE POLICY "insert_email_automations" ON email_automations FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "select_email_automations" ON email_automations;
CREATE POLICY "select_email_automations" ON email_automations FOR SELECT TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "update_email_automations" ON email_automations;
CREATE POLICY "update_email_automations" ON email_automations FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- email_settings
DROP POLICY IF EXISTS "auth_delete_email_settings" ON email_settings;
CREATE POLICY "auth_delete_email_settings" ON email_settings FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "auth_insert_email_settings" ON email_settings;
CREATE POLICY "auth_insert_email_settings" ON email_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "auth_select_email_settings" ON email_settings;
CREATE POLICY "auth_select_email_settings" ON email_settings FOR SELECT TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "auth_update_email_settings" ON email_settings;
CREATE POLICY "auth_update_email_settings" ON email_settings FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- email_templates (preserve is_system conditions and anon_no_access)
DROP POLICY IF EXISTS "auth_select_email_templates" ON email_templates;
CREATE POLICY "auth_select_email_templates" ON email_templates FOR SELECT TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "auth_update_email_templates" ON email_templates;
CREATE POLICY "auth_update_email_templates" ON email_templates FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "auth_delete_custom_email_templates" ON email_templates;
CREATE POLICY "auth_delete_custom_email_templates" ON email_templates FOR DELETE TO authenticated USING (public.is_admin_user() AND is_system = false);
DROP POLICY IF EXISTS "auth_insert_custom_email_templates" ON email_templates;
CREATE POLICY "auth_insert_custom_email_templates" ON email_templates FOR INSERT TO authenticated WITH CHECK (public.is_admin_user() AND is_system = false);

-- faqs
DROP POLICY IF EXISTS "Admins can delete faqs" ON faqs;
CREATE POLICY "Admins can delete faqs" ON faqs FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Admins can insert faqs" ON faqs;
CREATE POLICY "Admins can insert faqs" ON faqs FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Admins can update faqs" ON faqs;
CREATE POLICY "Admins can update faqs" ON faqs FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- highlights
DROP POLICY IF EXISTS "Authenticated users can delete highlights" ON highlights;
CREATE POLICY "Authenticated users can delete highlights" ON highlights FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert highlights" ON highlights;
CREATE POLICY "Authenticated users can insert highlights" ON highlights FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update highlights" ON highlights;
CREATE POLICY "Authenticated users can update highlights" ON highlights FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- house_rules
DROP POLICY IF EXISTS "Admins can delete house_rules" ON house_rules;
CREATE POLICY "Admins can delete house_rules" ON house_rules FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Admins can insert house_rules" ON house_rules;
CREATE POLICY "Admins can insert house_rules" ON house_rules FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Admins can update house_rules" ON house_rules;
CREATE POLICY "Admins can update house_rules" ON house_rules FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- ical_sources
DROP POLICY IF EXISTS "Authenticated users can delete ical sources" ON ical_sources;
CREATE POLICY "Authenticated users can delete ical sources" ON ical_sources FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert ical sources" ON ical_sources;
CREATE POLICY "Authenticated users can insert ical sources" ON ical_sources FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can read ical sources" ON ical_sources;
CREATE POLICY "Authenticated users can read ical sources" ON ical_sources FOR SELECT TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update ical sources" ON ical_sources;
CREATE POLICY "Authenticated users can update ical sources" ON ical_sources FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- inquiries
DROP POLICY IF EXISTS "Authenticated admins can delete inquiries" ON inquiries;
CREATE POLICY "Authenticated admins can delete inquiries" ON inquiries FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated admins can read inquiries" ON inquiries;
CREATE POLICY "Authenticated admins can read inquiries" ON inquiries FOR SELECT TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated admins can update inquiry status" ON inquiries;
CREATE POLICY "Authenticated admins can update inquiry status" ON inquiries FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- local_recommendations
DROP POLICY IF EXISTS "Admins can delete local_recommendations" ON local_recommendations;
CREATE POLICY "Admins can delete local_recommendations" ON local_recommendations FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Admins can insert local_recommendations" ON local_recommendations;
CREATE POLICY "Admins can insert local_recommendations" ON local_recommendations FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Admins can update local_recommendations" ON local_recommendations;
CREATE POLICY "Admins can update local_recommendations" ON local_recommendations FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- maintenance_notes
DROP POLICY IF EXISTS "Authenticated users can delete maintenance_notes" ON maintenance_notes;
CREATE POLICY "Authenticated users can delete maintenance_notes" ON maintenance_notes FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert maintenance_notes" ON maintenance_notes;
CREATE POLICY "Authenticated users can insert maintenance_notes" ON maintenance_notes FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can select maintenance_notes" ON maintenance_notes;
CREATE POLICY "Authenticated users can select maintenance_notes" ON maintenance_notes FOR SELECT TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update maintenance_notes" ON maintenance_notes;
CREATE POLICY "Authenticated users can update maintenance_notes" ON maintenance_notes FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- neighborhood_highlights
DROP POLICY IF EXISTS "Authenticated users can delete neighborhood highlights" ON neighborhood_highlights;
CREATE POLICY "Authenticated users can delete neighborhood highlights" ON neighborhood_highlights FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert neighborhood highlights" ON neighborhood_highlights;
CREATE POLICY "Authenticated users can insert neighborhood highlights" ON neighborhood_highlights FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update neighborhood highlights" ON neighborhood_highlights;
CREATE POLICY "Authenticated users can update neighborhood highlights" ON neighborhood_highlights FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- notification_logs
DROP POLICY IF EXISTS "Authenticated users can read notification logs" ON notification_logs;
CREATE POLICY "Authenticated users can read notification logs" ON notification_logs FOR SELECT TO authenticated USING (public.is_admin_user());

-- owner_blocks
DROP POLICY IF EXISTS "Authenticated users can delete owner_blocks" ON owner_blocks;
CREATE POLICY "Authenticated users can delete owner_blocks" ON owner_blocks FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert owner_blocks" ON owner_blocks;
CREATE POLICY "Authenticated users can insert owner_blocks" ON owner_blocks FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can select owner_blocks" ON owner_blocks;
CREATE POLICY "Authenticated users can select owner_blocks" ON owner_blocks FOR SELECT TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update owner_blocks" ON owner_blocks;
CREATE POLICY "Authenticated users can update owner_blocks" ON owner_blocks FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- payment_events
DROP POLICY IF EXISTS "Authenticated admins can read payment events" ON payment_events;
CREATE POLICY "Authenticated admins can read payment events" ON payment_events FOR SELECT TO authenticated USING (public.is_admin_user());

-- payment_settings
DROP POLICY IF EXISTS "Authenticated users can insert payment settings" ON payment_settings;
CREATE POLICY "Authenticated users can insert payment settings" ON payment_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can read payment settings" ON payment_settings;
CREATE POLICY "Authenticated users can read payment settings" ON payment_settings FOR SELECT TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update payment settings" ON payment_settings;
CREATE POLICY "Authenticated users can update payment settings" ON payment_settings FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- photo_section_features
DROP POLICY IF EXISTS "Authenticated can delete photo section features" ON photo_section_features;
CREATE POLICY "Authenticated can delete photo section features" ON photo_section_features FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated can insert photo section features" ON photo_section_features;
CREATE POLICY "Authenticated can insert photo section features" ON photo_section_features FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated can update photo section features" ON photo_section_features;
CREATE POLICY "Authenticated can update photo section features" ON photo_section_features FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- photo_sections
DROP POLICY IF EXISTS "Authenticated can delete photo sections" ON photo_sections;
CREATE POLICY "Authenticated can delete photo sections" ON photo_sections FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated can insert photo sections" ON photo_sections;
CREATE POLICY "Authenticated can insert photo sections" ON photo_sections FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated can update photo sections" ON photo_sections;
CREATE POLICY "Authenticated can update photo sections" ON photo_sections FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- properties
DROP POLICY IF EXISTS "Authenticated users can delete properties" ON properties;
CREATE POLICY "Authenticated users can delete properties" ON properties FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert properties" ON properties;
CREATE POLICY "Authenticated users can insert properties" ON properties FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update properties" ON properties;
CREATE POLICY "Authenticated users can update properties" ON properties FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- property_amenities
DROP POLICY IF EXISTS "Authenticated users can delete property amenities" ON property_amenities;
CREATE POLICY "Authenticated users can delete property amenities" ON property_amenities FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert property amenities" ON property_amenities;
CREATE POLICY "Authenticated users can insert property amenities" ON property_amenities FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());

-- property_fees
DROP POLICY IF EXISTS "Authenticated users can delete property fees" ON property_fees;
CREATE POLICY "Authenticated users can delete property fees" ON property_fees FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert property fees" ON property_fees;
CREATE POLICY "Authenticated users can insert property fees" ON property_fees FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update property fees" ON property_fees;
CREATE POLICY "Authenticated users can update property fees" ON property_fees FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- property_images
DROP POLICY IF EXISTS "Authenticated users can delete property images" ON property_images;
CREATE POLICY "Authenticated users can delete property images" ON property_images FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can manage property images" ON property_images;
CREATE POLICY "Authenticated users can manage property images" ON property_images FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update property images" ON property_images;
CREATE POLICY "Authenticated users can update property images" ON property_images FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- property_policies
DROP POLICY IF EXISTS "Admins can delete property_policies" ON property_policies;
CREATE POLICY "Admins can delete property_policies" ON property_policies FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Admins can insert property_policies" ON property_policies;
CREATE POLICY "Admins can insert property_policies" ON property_policies FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Admins can update property_policies" ON property_policies;
CREATE POLICY "Admins can update property_policies" ON property_policies FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- reviews
DROP POLICY IF EXISTS "Authenticated users can delete reviews" ON reviews;
CREATE POLICY "Authenticated users can delete reviews" ON reviews FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON reviews;
CREATE POLICY "Authenticated users can insert reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update reviews" ON reviews;
CREATE POLICY "Authenticated users can update reviews" ON reviews FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- seasonal_pricing_presets
DROP POLICY IF EXISTS "Authenticated users can delete seasonal_pricing_presets" ON seasonal_pricing_presets;
CREATE POLICY "Authenticated users can delete seasonal_pricing_presets" ON seasonal_pricing_presets FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert seasonal_pricing_presets" ON seasonal_pricing_presets;
CREATE POLICY "Authenticated users can insert seasonal_pricing_presets" ON seasonal_pricing_presets FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can select seasonal_pricing_presets" ON seasonal_pricing_presets;
CREATE POLICY "Authenticated users can select seasonal_pricing_presets" ON seasonal_pricing_presets FOR SELECT TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update seasonal_pricing_presets" ON seasonal_pricing_presets;
CREATE POLICY "Authenticated users can update seasonal_pricing_presets" ON seasonal_pricing_presets FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- sleeping_arrangements
DROP POLICY IF EXISTS "Authenticated users can delete sleeping arrangements" ON sleeping_arrangements;
CREATE POLICY "Authenticated users can delete sleeping arrangements" ON sleeping_arrangements FOR DELETE TO authenticated USING (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can insert sleeping arrangements" ON sleeping_arrangements;
CREATE POLICY "Authenticated users can insert sleeping arrangements" ON sleeping_arrangements FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
DROP POLICY IF EXISTS "Authenticated users can update sleeping arrangements" ON sleeping_arrangements;
CREATE POLICY "Authenticated users can update sleeping arrangements" ON sleeping_arrangements FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- users (tighten SELECT only; preserve ownership-based UPDATE)
DROP POLICY IF EXISTS "Authenticated users can read users" ON users;
CREATE POLICY "Authenticated users can read users" ON users FOR SELECT TO authenticated USING (public.is_admin_user());
