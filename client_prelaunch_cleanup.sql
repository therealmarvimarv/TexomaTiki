-- =============================================================================
-- CLIENT PRE-LAUNCH CLEANUP SQL
-- Use: Run against a fresh client Supabase BEFORE handing off to the client.
--      Removes all smoke-test / demo bookings, inquiries, payment events,
--      notification logs, cleaning tasks, and booking-linked blocked dates.
--      Preserves all setup data (property, content, pricing, templates, etc.)
--
-- ⚠️  WARNING ⚠️
-- DO NOT RUN THIS ON AN ACTIVE LIVE CLIENT DATABASE UNLESS YOU FULLY
-- UNDERSTAND IT. THIS PERMANENTLY DELETES TRANSACTIONAL RECORDS.
-- There is no undo. Make a Supabase backup before running if in doubt.
--
-- Safe to run on a brand-new client DB after smoke testing, before go-live.
-- Auth users (admin logins) are NOT touched — manage those in the dashboard.
-- Platform/SaaS tables are NOT touched.
-- Master/template data is NOT touched.
-- =============================================================================

-- ─── STEP 1: email_automation_sends ─────────────────────────────────────────
-- Must come first — has FK to bookings (ON DELETE CASCADE, but be explicit)
DELETE FROM email_automation_sends;

-- ─── STEP 2: booking_internal_notes ─────────────────────────────────────────
-- ON DELETE CASCADE from bookings, but delete explicitly for safety
DELETE FROM booking_internal_notes;

-- ─── STEP 3: cleaning_tasks (booking-linked only) ───────────────────────────
-- Removes tasks auto-created from test bookings.
-- If you manually created non-booking cleaning tasks you want to keep,
-- change this to: DELETE FROM cleaning_tasks WHERE booking_id IS NOT NULL;
DELETE FROM cleaning_tasks;

-- ─── STEP 4: payment_events ─────────────────────────────────────────────────
DELETE FROM payment_events;

-- ─── STEP 5: blocked_dates (booking-created only) ───────────────────────────
-- Removes dates blocked by test bookings (booking_id IS NOT NULL).
-- Preserves owner blocks (source = 'owner') and iCal-imported blocks
-- (source = 'ical') — those are intentional non-booking blocks.
DELETE FROM blocked_dates WHERE booking_id IS NOT NULL;

-- ─── STEP 6: bookings ───────────────────────────────────────────────────────
DELETE FROM bookings;

-- ─── STEP 7: inquiries ──────────────────────────────────────────────────────
DELETE FROM inquiries;

-- ─── STEP 8: notification_logs ──────────────────────────────────────────────
DELETE FROM notification_logs;

-- ─── STEP 9: maintenance_notes ──────────────────────────────────────────────
-- Removes all test maintenance notes. If you have real notes to keep,
-- comment this out and delete selectively instead.
DELETE FROM maintenance_notes;

-- =============================================================================
-- VERIFICATION — expected: all counts = 0
-- Run these SELECTs and confirm every row shows 0.
-- =============================================================================

SELECT 'email_automation_sends' AS table_name, COUNT(*) AS row_count FROM email_automation_sends
UNION ALL
SELECT 'booking_internal_notes',               COUNT(*) FROM booking_internal_notes
UNION ALL
SELECT 'cleaning_tasks',                       COUNT(*) FROM cleaning_tasks
UNION ALL
SELECT 'payment_events',                       COUNT(*) FROM payment_events
UNION ALL
SELECT 'blocked_dates (booking-linked)',        COUNT(*) FROM blocked_dates WHERE booking_id IS NOT NULL
UNION ALL
SELECT 'bookings',                             COUNT(*) FROM bookings
UNION ALL
SELECT 'inquiries',                            COUNT(*) FROM inquiries
UNION ALL
SELECT 'notification_logs',                    COUNT(*) FROM notification_logs
UNION ALL
SELECT 'maintenance_notes',                    COUNT(*) FROM maintenance_notes
ORDER BY table_name;

-- Spot-check: preserved setup tables (these should all be > 0)
SELECT 'properties'           AS table_name, COUNT(*) AS row_count FROM properties
UNION ALL
SELECT 'amenities',                           COUNT(*) FROM amenities
UNION ALL
SELECT 'property_images',                     COUNT(*) FROM property_images
UNION ALL
SELECT 'reviews',                             COUNT(*) FROM reviews
UNION ALL
SELECT 'faqs',                                COUNT(*) FROM faqs
UNION ALL
SELECT 'house_rules',                         COUNT(*) FROM house_rules
UNION ALL
SELECT 'property_policies',                   COUNT(*) FROM property_policies
UNION ALL
SELECT 'local_recommendations',               COUNT(*) FROM local_recommendations
UNION ALL
SELECT 'email_templates',                     COUNT(*) FROM email_templates
UNION ALL
SELECT 'email_automations',                   COUNT(*) FROM email_automations
UNION ALL
SELECT 'email_settings',                      COUNT(*) FROM email_settings
UNION ALL
SELECT 'payment_settings',                    COUNT(*) FROM payment_settings
UNION ALL
SELECT 'account_settings',                    COUNT(*) FROM account_settings
UNION ALL
SELECT 'property_fees',                       COUNT(*) FROM property_fees
UNION ALL
SELECT 'blocked_dates (non-booking)',          COUNT(*) FROM blocked_dates WHERE booking_id IS NULL
ORDER BY table_name;
