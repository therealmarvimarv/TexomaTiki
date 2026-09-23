# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning:

- `MAJOR.MINOR.PATCH`
- Example: `1.0.0`, `1.0.1`, `1.1.0`

---

## [1.0.1] - 2026-09-25

### Fixed
- Sample text
- Sample text

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