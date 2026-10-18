# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning:

- `MAJOR.MINOR.PATCH`
- Example: `1.0.0`, `1.0.1`, `1.1.0`

---

## [1.0.1] - 2026-10-17

## 2026-10-17 â€” Texoma Tiki LIVE Admin Dashboard Updates

### Changed

- Updated **Admin Overview** to read the property's saved time zone and date-format preferences from `account_settings` and use them for relevant dashboard displays.
- Updated display formatting so booking and availability **date-only values retain their recorded calendar day**, while actual event, inquiry, and calendar-sync timestamps are shown in the property's saved time zone.
- Aligned the Overview date heading and Calendar Preview's current-day/month handling with the property time zone where applicable.
- Changed the Revenue Estimate range label from **Year to Date** to **This Year**. The underlying January 1â€“December 31 range, confirmed-and-paid calculation, and internal range key remain unchanged.
- Changed the **Currency** control in Account > Preferences from an editable selector to a **read-only display**. Existing currency values, state, persistence, and preference-saving behavior remain intact; no currency conversion was introduced.

### Fixed

- Excluded archived bookings from the **Pending Requests** list using the same active-booking filter as the corresponding summary count.
- Improved manual **Sync Now** handling so HTTP failures, network errors, and returned synchronization errors are not incorrectly reported as successes.
- Cleared stale Calendar Sync loading errors after a successful source-status refresh.
- Updated the top **Calendar Sync** summary card after manual synchronization using the refreshed source-status data, without extra queries for that summary update or changes to the other stat cards.
- Corrected corrupted text encoding in **AccountPage.tsx**, including punctuation, image-dimension labels, select labels, and SEO placeholder text. Retained the intended displayed wording.

### Preserved â€” LIVE Client iCal Exception

- **Texoma Tiki LIVE retains its existing, tested legacy iCal scheduler and authentication implementation.** It was **not** replaced, refactored, or migrated to the MASTER implementation.
- No changes were made to the automatic scheduler, cron configuration, Edge Functions, import/export behavior, authentication requirements, or underlying Airbnb/Vrbo calendar synchronization logic.
- Existing verified production behavior, including scheduled runs, HTTP 200 responses, Airbnb and Vrbo synchronization, `last_error = null`, and manual Admin Sync All, is documented as the **pre-existing baseline**; these integrations were not retested as part of this source-code update.
- Future client deployments should continue using the current MASTER iCal architecture. Any migration of this LIVE client requires separate explicit approval and end-to-end verification.

### Scope and Verification

- Updated LIVE front-end source files only: `src/pages/admin/AdminOverview.tsx` and `src/pages/admin/AccountPage.tsx`.
- Retained LIVE property-specific settings, branding, page layout/responsiveness, bookings, payments, emails, account/security actions, and existing back-end behavior.
- Compared the latest supplied LIVE source files against the approved replacements: **AccountPage.tsx matched exactly**; **AdminOverview.tsx differed only by the final newline**.
- Both supplied TSX files passed syntax parsing/transpilation checks with **zero syntax errors**.
- **Not yet verified in this review:** a full LIVE project build, deployed-site behavior after publication, or end-to-end booking/payment/email/iCal tests. Source-file checks do not establish a successful production deployment.

### Release Note

This update carries the approved MASTER **admin-interface improvements** into Texoma Tiki LIVE **without migrating its protected legacy iCal scheduler/authentication implementation**.

---


### Changed

**Property > Neighborhood - Add Place**
- Added automatic scrolling to the newly created, unsaved Neighborhood item after clicking **Add Place**.
- Automatically focuses the new item's **Place Name** field so the administrator can start typing without manually scrolling.
- Uses the newly created item's input reference to locate the correct field.
- Preserved all existing Neighborhood Add, Save, Edit, and Delete behavior.

**Property > Sections & Content - Mobile Content Cards**
- Applied the approved **actions-at-bottom** mobile layout to **FAQs, House Rules, Policies, and Local Recs** below 640px.
- Gave card titles, status/category badges, and descriptions more horizontal space.
- Moved **Edit**, **Hide/Show**, and **Delete** into a separate footer beneath each card's content.
- Kept FAQ and House Rules ordering arrows available in the mobile footer.
- Added spacing, card outlines, and rounded corners to improve readability on narrow screens.
- Reorganized the mobile Content heading/description and made the four section tabs share a responsive four-column row.
- Preserved the original desktop layouts at 640px and wider.

**FAQs - Mobile Badge Alignment**
- Corrected the FAQ badge arrangement so **Active/Hidden** and the category badge (such as **Payments**) appear side by side beneath the question, rather than on separate lines.
- Limited this adjustment to FAQ cards on mobile; other Content sections were not altered by this follow-up correction.

### Maintenance
- Updated `ContentEditor.tsx` to use ASCII-safe source text and comments without changing intended displayed wording.

### Preserved
- Existing **Texoma Tiki** branding, sidebar, and other LIVE-specific design.
- LIVE's original property editing and host-photo behavior.
- LIVE-specific policy save/update logic, policy metadata handling, and database operations.
- All existing Content Editor Add, Edit, Save, Cancel, Hide/Show, Delete, and ordering handlers.
- No database migrations, Edge Function changes, or unrelated functional updates.

### Files Updated
- `PropertyEditor.tsx` - Neighborhood Add Place auto-scroll and focus only.
- `ContentEditor.tsx` - Mobile card/header/tab layout, FAQ badge alignment, and source-encoding-safe text only.

### Testing Note
- Source changes were compared against the preceding LIVE files. Verify Add Place scrolling and all four Content sections at mobile widths before publication.


## [1.0.1] - 2026-10-15

### Changed

**Admin Calendar - Mobile Responsive Layout**

- Redesigned the Calendar navigation for screens below 640px into a two-column, two-row layout, keeping Calendar, Availability, Pricing, and Calendar Sync accessible without horizontal overflow.
- Kept the existing desktop navigation layout at 640px and above.
- Reorganized the mobile calendar header: month navigation remains grouped, while Today and Refresh fit on a separate action row when needed.
- Reduced mobile calendar grid padding, day-number size, and minimum cell height so the seven-day calendar fits narrow screens more comfortably.
- Changed mobile event display from truncated names to compact color-coded bars; retained event names on larger screens.
- Displayed selected event details in a mobile bottom sheet while preserving the existing desktop popover.
- Tightened the mobile status legend spacing and adjusted the calendar card's mobile padding.
- Added accessible labels to the previous-month, next-month, and Refresh controls.

### Fixed

- Corrected mobile Calendar navigation overflow and cramped month controls on narrow devices, including 375px and 440px viewport widths.
- Cleaned non-ASCII source characters to avoid corrupted divider or punctuation characters when transferring code. Visible punctuation and behavior were preserved.

### Preserved

- **Texoma Tiki** branding, including the existing sidebar and collapsed `TT` icon; no branding changes were made.
- LIVE's existing desktop Calendar layout and all client-specific behavior.
- Booking, owner-block, iCal import, and cleaning event data queries and their existing status colors.
- Month-navigation, Today, Refresh, event selection, and booking-detail navigation behavior.
- Availability, Pricing (including Rates and Fees), and Calendar Sync functionality.
- No database migrations, Edge Function updates, or payment/booking business-logic changes.

### File Updated

- `AdminCalendar.tsx`

### Validation Note

- The updated LIVE file was checked for ASCII-safe source and TypeScript/JSX syntax. The mobile layout was positively reviewed at narrow viewport sizes; continue to verify production interactions after deployment.


## [1.0.1] - 2026-10-15

### Changed

**Property Editor - Neighborhood Highlights**
- Updated the Neighborhood Highlights layout for screens narrower than 670px.
- Moved Place Name to its own full-width row.
- Arranged Distance, Category, and Delete on the following row.
- Placed the heading and description above the Add Place and Save buttons on narrow screens.
- Kept the previously existing layout at 670px and wider.

**Property Editor - Navigation Tabs**
- Matched LIVE's top tab behavior to MASTER: tabs wrap onto additional rows instead of scrolling horizontally.
- Changed the tab container from `flex border-b overflow-x-auto` to `flex flex-wrap border-b`.
- Changed only the navigation tab button horizontal padding from `px-5` to `px-4`.

**Email Settings - Notification Logs**
- Updated notification logs to use two-row entries at all screen sizes.
- First row: Time, Status, and Template.
- Second row: Recipient and Subject.
- Kept existing log loading, filtering, status indicators, error details, and Refresh behavior.

### Fixed
- Cleaned character-encoding artifacts in the updated LIVE source files while preserving displayed text and template content.

### Unchanged
- Preserved LIVE's **Texoma Tiki** branding, including its expanded sidebar branding and collapsed `TT` icon.
- Made no changes to `AdminDashboard.tsx` or the sidebar.
- Preserved LIVE-specific property editing and host-photo behavior.
- Preserved existing email templates, settings, automations, database operations, and business logic.
- No database migrations or Edge Function changes.

### Files Updated
- `PropertyEditor.tsx`
- `EmailSettings.tsx`

### Deployment Note
- Verify the Property tabs and Neighborhood layout at narrow and wide viewport sizes, and the Email notification logs, in LIVE before publishing.


## [1.0.1] - 2026-10-14

### Changed

**Admin Overview Dashboard**

- Redesigned the Admin Overview dashboard for improved responsiveness, readability, spacing, and visual organization.
- Updated the four dashboard summary cards with improved typography, icon positioning, padding, and alignment.
- Maintained all four summary cards in a single horizontal row across approved laptop and tablet layouts.
- Improved the responsive arrangement of Upcoming Bookings, Pending Requests, Calendar Preview, Revenue Estimate, Recent Inquiries, and Calendar Sync Health.
- Maintained the Calendar Preview and Revenue Estimate panels side by side at supported screen widths.
- Preserved the existing Revenue Estimate calculations and filter functionality.
- Improved Revenue Estimate filter labels to display more clearly within compact layouts.
- Maintained the four bottom Property Operations cards in a single row at approved tablet widths.
- Implemented the approved 700px tablet layout:
  - Four summary cards in one row.
  - Upcoming Bookings and Pending Requests stacked at full width.
  - Calendar Preview and Revenue Estimate displayed side by side at approximately 60% / 40%.
  - Recent Inquiries and Calendar Sync Health displayed side by side at approximately 60% / 40%.
  - Four Property Operations cards retained in one row.
- Improved dashboard layouts at 834px and other approved laptop and tablet widths.
- Preserved existing dashboard navigation, data displays, actions, and business logic.

**Admin Bookings Page**

- Redesigned the Admin Bookings page for improved responsiveness and readability.
- Preserved the original 11-column desktop booking table at viewport widths of 1400px and above.
- Added responsive two-row booking cards for viewport widths below 1400px.
- Preserved all existing booking information, including Guest, Check-in, Check-out, Nights, Total, Paid, Method, Status, Payment, Created, and Actions.
- Added light-gray header strips to separate booking field labels from their corresponding values.
- Centered booking field labels and values within consistent column widths.
- Improved spacing, padding, and visual separation between booking records.
- Applied bold formatting to Check-in, Check-out, and Nights values in the top row, matching the existing Total formatting.
- Preserved booking status and payment status badges.
- Maintained View buttons within the responsive booking card layout.
- Renamed the Active / Archived filter's "All" option to "All Bookings".
- Renamed the booking status filter's "All" option to "All Statuses".
- Preserved the original independent behavior of both filters.

### Fixed

- Corrected booking card header and value alignment.
- Corrected inconsistent spacing between responsive booking columns.
- Fixed the responsive breakpoint that caused the full desktop booking table to appear prematurely at 1280px.
- Changed the desktop table visibility breakpoint to 1400px to improve booking detail and action visibility at narrower widths.
- Corrected corrupted dash characters in booking information using encoding-safe Unicode escapes.

### Notes

- Updated `AdminOverview.tsx` and `BookingsManager.tsx`.
- Changes were limited to approved UI design, responsive layouts, presentation, and filter-label improvements.
- Existing Supabase queries, booking calculations, revenue calculations, filtering behavior, CSV export, and booking-detail navigation were preserved.
- No booking workflow, payment processing, pricing logic, or calendar synchronization changes were required.
- No database schema changes, migrations, or Edge Function changes were required.
- Updated components passed source-level syntax and encoding checks.
- Approved responsive layouts were reviewed using browser screenshots.
- Full application runtime verification remains separate from source-code and visual verification.


## [1.0.1] - 2026-10-11

### Changed

- Replaced the previous horizontal admin navigation with the new responsive left sidebar.
- Added desktop sidebar collapse/expand behavior with the selected state preserved between sessions.
- Added a mobile admin header with slide-out navigation.
- Preserved the existing Texoma Tiki admin branding.
- Moved Pricing out of the Property section and into the Calendar section.
- Updated Calendar navigation to:
  - Calendar
  - Availability
  - Pricing
  - Calendar Sync
- Preserved the existing Rates and Fees subsections inside Calendar → Pricing.
- Removed the Pricing tab from Property.
- Property now contains:
  - Basic Info
  - Highlights
  - Amenities
  - Neighborhood
  - Contact
  - Photos
  - Things to Know
  - Sections & Content
- Redesigned the Pricing workspace for responsive use:
  - Wide screens display Pricing Calendar, rate settings, and Seasonal Pricing in three columns.
  - Intermediate screen widths display Pricing Calendar and rate settings in two columns with Seasonal Pricing below.
  - Mobile screens use a single-column layout.
- Rebalanced Pricing Calendar and rate-settings widths.
- Reduced Pricing Calendar cell height for a more compact layout.
- Improved Seasonal Pricing layout and preset form spacing.
- Updated the Seasonal Pricing header so the Add preset button remains properly aligned within narrower layouts.

### Added

- Added a reusable "What's New" admin update modal to notify administrators about important dashboard changes.
- Added a direct "Go to Pricing" button in the modal that opens Calendar → Pricing.
- Added a temporary `NEW` badge to the Pricing tab inside Calendar.
- Added configurable modal appearance limits using `maxAppearances`.
- Configured the V1.0.1 modal to appear a maximum of two times per administrator.
- Added separate modal tracking for each authenticated administrator so the developer and client administrator accounts maintain independent appearance counts.
- Added version-based modal tracking so future platform updates can use their own notification cycle.

### Fixed

- Fixed the update modal so it appears only once during an eligible login session.
- Fixed an issue where navigating between Calendar, Bookings, Property, and other admin sections could cause the modal to appear again during the same login.
- Fixed modal appearance counting so normal admin navigation does not consume additional appearances.
- Fixed `/admin/calendar?tab=pricing` handling so the Pricing tab opens correctly when accessed directly from the modal.
- Verified the modal appears once on the first eligible login, once on the second eligible login, and remains dismissed on subsequent logins for that administrator.

### Notes

- The V1.0.1 update modal is configured with `maxAppearances: 2`.
- Modal tracking is maintained separately for each authenticated administrator and browser/device.
- Developer and client administrator accounts do not consume each other's modal appearances.
- No database migration was required.
- No pricing logic, fee logic, booking logic, payment processing, email configuration, production data, or Edge Functions were modified.
- Existing pricing precedence, seasonal pricing, date-specific overrides, day-of-week rates, minimum-night rules, and fee behavior remain unchanged.
- The existing production iCal scheduler/authentication implementation was intentionally left unchanged.
- The verified legacy iCal scheduler exception documented in the 2026-10-08 changelog remains in effect and must not be overwritten with the master-template scheduler implementation.

## [1.0.1] - 2026-10-08

### Fixed

- Fixed automatic iCal synchronization so external calendar feeds are now imported automatically every 15 minutes without requiring Admin Sync All.
- Replaced the failed scheduled iCal authentication configuration that relied on unavailable database settings.
- Added `public.run_ical_import()` as the dedicated scheduled iCal import function.
- Added secure Vault-based scheduler authentication using the `edge_service_role_key` secret.
- Added `public.verify_ical_scheduler_token()` to securely validate scheduled iCal requests without exposing the stored secret.
- Preserved the existing authenticated Admin Sync All workflow using the signed-in administrator's session JWT.
- Preserved all existing iCal feed parsing, blocked-date synchronization, calendar source handling, and iCal export functionality.
- Verified the automatic `run_ical_import` cron job runs successfully every 15 minutes.
- Verified a real scheduled execution returned HTTP 200 and successfully synchronized both Airbnb and Vrbo calendar feeds with no sync errors.

> **⚠️ LEGACY ICAL SCHEDULER EXCEPTION — DO NOT OVERWRITE**
>
> **This production client intentionally uses a different verified-working iCal scheduler/authentication implementation than the current master template. Do not automatically replace, refactor, or “sync” this client’s iCal implementation to match the master. Future client deployments should use the proven master-template iCal implementation.**

### Improved

- Simplified the automatic iCal scheduler architecture to use a single Vault-managed scheduler secret.
- Removed the temporary `scheduler_config` table.
- Removed the temporary custom `ical_scheduler_token`.
- Removed the obsolete `public.run_scheduled_ical_import()` function.
- Removed the obsolete `public.store_scheduler_secret()` helper function.
- Removed the previous scheduler-token lookup logic from the `ical-import` server function.
- Confirmed no remaining references to the removed temporary scheduler infrastructure.
- Confirmed the automated email scheduler, bookings, payments, pricing, UI, calendar source URLs, and iCal export were not modified by the final iCal cleanup.

## [1.0.1] - 2026-10-06

### Improved

- Completed the one-time migration of all 64 existing property photos from JPEG/JPG to optimized WebP.
- Converted all legacy property photos using WebP quality `0.85` with proportional resizing capped at 3000px while preserving image orientation and aspect ratio.
- Updated all 64 `property_images` records to reference the new WebP files without changing image IDs, section assignments, sort order, source, or other metadata.
- Verified all 64 converted files as valid WebP images before updating their database references.
- Preserved all original JPEG files in the `property-photos` storage bucket for rollback protection.
- Preserved the `property_images_backup_webp_migration` rollback table containing all 64 original image records.
- Confirmed the migration left 64 total property images, 64 WebP references, and 0 remaining JPEG/JPG references in `property_images`.
- Removed all temporary migration Edge Functions, config entries, scripts, and migration tooling after completion.
- Verified the live property page, Photo Tour, and Lightbox after migration with no visual or functional issues.
- Automatic WebP conversion remains active for all new property photo uploads.

## [1.0.1] - 2026-10-2

### Improved

- Added automatic WebP conversion for all newly uploaded property photos.
- Optimized images using WebP encoding at 85% quality to improve loading performance and reduce file sizes.
- Preserved proportional image resizing with a maximum dimension of 3000px, the existing 25 MB upload limit, image orientation, and aspect ratio.
- Updated the upload process to save converted photos with the `.webp` extension and `image/webp` content type.
- Added conversion validation and error handling to prevent unoptimized originals from being uploaded when conversion fails.
- Preserved existing photo-management functionality, including sorting, deletion, gallery display, Photo Tour section assignments, and sequential uploads.
- Implemented and successfully tested automatic WebP conversion in both the Master Template and the existing client deployment.

### Notes

- No database schema, storage bucket, Edge Function or unrelated application changes were required.

## [1.0.1] - 2026-09-28

### Fixed

- Added automatic iCal import synchronization every 15 minutes.
- Added a secure scheduled service-role execution path to the `ical-import` Edge Function while preserving the existing authenticated admin Sync All flow.
- Added the `run_ical_import` pg_cron job using the same secure `client_config` + Vault scheduler pattern as automated emails.
- Updated the canonical `ultimate_client_database_bootstrap.sql` so future fresh client deployments automatically receive the 15-minute iCal import scheduler.
- Preserved existing manual Sync All, per-source sync, iCal parsing, blocked-date handling, and iCal export behavior.

### Improved

- Replaced the guest property page loading spinner with a full-page skeleton loading experience that mirrors the property layout while data loads.
- Replaced the Photo Tour loading message with a structured skeleton layout including the top bar, photo navigation placeholders, and image-grid placeholders.
- Prioritized the primary property hero image with eager loading and high fetch priority.
- Added smooth fade-in loading transitions to the property hero images.
- Added lazy loading to Photo Tour section images and navigation thumbnails to reduce unnecessary image loading.
- Improved Lightbox image loading with a subtle placeholder and fade-in transition.
- Added adjacent-image preloading in the Lightbox so previous and next photos load more smoothly while browsing.
- Improved mobile Lightbox sizing so photos use nearly the full available viewport width while preserving their aspect ratio.
- Moved Lightbox navigation arrows inside the image area on mobile for a larger and more natural photo-viewing experience.
- Preserved existing desktop Lightbox dimensions and behavior.

### Notes

- External calendar feeds are checked every 15 minutes.
- Actual reservation visibility may still depend on how quickly Airbnb, Vrbo, Booking.com, or another external platform publishes the reservation to its iCal feed.
- No database, storage, booking, pricing, calendar UI, or admin photo-management changes were required for the loading and image-performance improvements.
- Existing photo upload compression and optimization behavior remains unchanged.

## [1.0.0] - 2026-09-22

### Added

- Complete single-property vacation rental booking platform
- Public property website with responsive layout
- Hero photo gallery and shared lightbox
- Dedicated Photo Tour with section navigation
- Dynamic "Where You'll Sleep" integration with Photo Tour data
- Amenities, highlights, reviews, FAQs, neighborhood content, local recommendations, and Things to Know
- Guest inquiry/contact form
- Real-time availability checking
- Guest selector for adults, children, infants, and pets
- Layered pricing engine with:
  - base nightly pricing
  - day-of-week pricing
  - seasonal pricing
  - date-specific price overrides
- Layered minimum-night rules with:
  - property defaults
  - seasonal minimum nights
  - date-specific overrides
- Cleaning, pet, additional guest, custom fee, and tax support
- Manual booking request workflow
- Stripe Test and Stripe Live checkout workflows
- Manual Test and Manual Live payment modes
- Pending-payment expiration handling
- Stripe webhook processing for:
  - checkout.session.completed
  - checkout.session.expired
  - payment_intent.payment_failed
  - charge.refunded
- Full and partial Stripe refunds
- Cumulative refund tracking
- Booking cancellation, decline, archive, internal notes, and payment notes
- Admin booking management
- Admin calendar
- Owner blocks and date availability overrides
- iCal import and export
- Token-protected iCal export feed
- Manual per-source sync and Sync All
- Cleaning task management
- Automatic cleaning-task creation after booking confirmation
- Maintenance task management
- Property content-management system
- Pricing and fee editors
- Photo management with:
  - 25 MB source limit
  - 3000 px maximum dimension
  - JPEG/WebP compression
  - lossless PNG handling
  - sequential upload processing
- SMTP and Resend email providers
- Email template system
- Email automations
- Scheduled automated emails
- Provider Test
- Template Test
- Automation Test with in-memory sample booking fallback
- Email notification logging
- Account, branding, SEO, timezone, currency, and date-format settings
- Public Privacy Policy and Terms
- Protected administrator Privacy, Terms, and Documentation pages
- Admin authentication and allowlist-based authorization
- Row Level Security
- Vault-based Stripe and email secret storage
- Netlify frontend deployment
- Bolt Database backend architecture
- Canonical fresh-client deployment with 16 property Edge Functions

### Changed

- Replaced the original Express / Prisma / MySQL backend architecture with Bolt Database / PostgreSQL / Edge Functions
- Replaced the original server-hosted deployment model with Netlify + Bolt Database
- Replaced legacy photo-gallery behavior with PropertyHero + shared Lightbox
- Separated refund behavior from booking cancellation behavior
- Refund Stripe environment now follows the original payment transaction livemode
- Improved seasonal and date-specific minimum-night precedence
- Improved pricing consistency between guest quote and checkout
- Improved admin authorization with the `admin_users` allowlist
- Improved image-upload optimization and memory cleanup
- Improved email automation testing so tests work even without real bookings

### Removed / Deprecated

- Legacy Express / Prisma / MySQL backend from active production use
- Legacy PM2 / Nginx production architecture from active deployment
- Legacy `PhotoGallery.tsx` from active page usage
- `email-templates-update` and `email-templates-reset` from the canonical fresh-client Edge Function set
- Automatic scheduled iCal import from the current V1 workflow

### Notes

- V1.0.0 is the canonical production baseline for future client duplications.
- The detailed technical baseline is stored at:

  `docs/releases/v1.0.0/V1.0.0_Complete_System_Inventory_and_Architecture.md`