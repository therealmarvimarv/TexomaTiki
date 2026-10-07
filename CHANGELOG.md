# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning:

- `MAJOR.MINOR.PATCH`
- Example: `1.0.0`, `1.0.1`, `1.1.0`

---

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