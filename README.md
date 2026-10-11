# Tiki Cottage â€” Vacation Rental Management Platform

**Release:** V1.0.1  
**Status:** Active production deployment  
**Application type:** Single-property direct-booking and property-management platform

Tiki Cottage is a self-managed vacation-rental platform with a public guest website and a protected administrator dashboard. It supports direct booking, Stripe payments, automatic calendar synchronization, pricing, property content, automated email communication, cleaning, maintenance, branding, and day-to-day booking operations.

This README describes the **current V1.0.1 production implementation**.

Older documentation that references Express, Prisma, MySQL, PM2, Nginx, local file uploads, or `/api/...` REST endpoints is legacy and does not describe the active application.

---

## Current Technology Stack

- **Frontend:** React 18, TypeScript, Vite 5
- **Styling:** Tailwind CSS 3
- **Routing:** React Router 6
- **Backend:** Bolt Database / PostgreSQL 15 / PostgREST
- **Authentication:** Bolt Database Auth
- **Server-side logic:** Bolt Database Edge Functions running on Deno
- **Storage:** Bolt Database Storage
- **Hosting:** Netlify
- **Payments:** Stripe Checkout, webhooks, refunds
- **Email:** SMTP or Resend
- **Calendar:** Automatic and manual iCal import/export
- **Secrets:** Bolt Database Vault
- **Scheduled backend work:** pg_cron + pg_net

---

## Application Architecture

```text
Guest / Admin Browser
        |
        v
React + Vite SPA
        |
        +--> Bolt Database queries
        +--> Bolt Database Edge Functions
        +--> Bolt Database Auth
        +--> Bolt Database Storage
        |
        +--> Stripe
        +--> SMTP / Resend
        +--> External iCal feeds
```

The active property application does **not** require a traditional Express/Node API server.

---

## Public Guest Experience

V1.0.1 includes:

- Property listing homepage
- Responsive hero photo grid
- Shared photo lightbox
- Dedicated Photo Tour
- Amenities
- Host information
- Property highlights
- Sleeping arrangements / "Where You'll Sleep"
- Neighborhood information
- Local recommendations
- Reviews
- FAQs
- Things to Know
- Contact/inquiry form
- Date availability
- Guest selector for adults, children, infants, and pets
- Dynamic pricing quotes
- Minimum-night validation
- Booking-request workflow
- Stripe Checkout workflow
- Booking success/cancel/request-success pages
- Public privacy and terms pages
- Dynamic branding, logo, favicon, SEO title, and meta description
- Skeleton loading experience while property data loads
- Prioritized hero-image loading
- Lazy-loaded Photo Tour images
- Lightbox image preloading and loading transitions
- Improved mobile Lightbox sizing and navigation

---

## Administrator Dashboard

The protected admin application uses a responsive left-sidebar navigation system.

### Desktop Navigation

- Expandable/collapsible left sidebar
- Sidebar state preserved between sessions
- Compact collapsed navigation
- Increased usable dashboard workspace

### Mobile Navigation

- Responsive admin header
- Slide-out navigation
- Mobile-friendly administrator controls

### Main Admin Sections

- **Overview**

- **Calendar**
  - Calendar
  - Availability
  - Pricing
  - Calendar Sync

- **Bookings**
  - review / approve / decline
  - confirmation
  - cancellation
  - manual payment recording
  - partial and full Stripe refunds
  - internal notes
  - payment notes
  - archive controls

- **Cleaning**

- **Maintenance**

- **Property**
  - Basic Info
  - Highlights
  - Amenities
  - Neighborhood
  - Contact
  - Photos
  - Things to Know
  - Sections & Content

- **Email**
  - provider settings
  - templates
  - automations
  - provider test
  - template test
  - automation test
  - notification logs

- **Payments**

- **Account**
  - profile
  - owner/business information
  - listing information
  - branding
  - SEO
  - timezone
  - currency
  - date format
  - system status
  - security
  - support information
  - platform privacy, terms, and documentation

---

## Calendar Workspace

Calendar now contains four primary sections:

1. **Calendar**
2. **Availability**
3. **Pricing**
4. **Calendar Sync**

### Calendar

Displays:

- booking events
- owner blocks
- imported iCal activity
- cleaning activity

### Availability

Provides availability and owner-block controls.

### Pricing

Pricing was moved from the Property section into Calendar so pricing, availability, and calendar management are grouped together.

Calendar â†’ Pricing includes:

- Rates
- Fees
- Pricing Calendar
- Base nightly rate
- Day-of-week pricing
- Date-specific price overrides
- Date-specific minimum-night overrides
- Seasonal Pricing

The Pricing workspace is responsive:

- Wide screens display Pricing Calendar, rate settings, and Seasonal Pricing in three columns.
- Intermediate screen widths display Pricing Calendar and rate settings in two columns with Seasonal Pricing below.
- Mobile screens use a single-column layout.

The Pricing Calendar uses more compact calendar cells and rebalanced workspace widths to keep the calendar prominent while preserving room for pricing controls.

### Calendar Sync

Provides:

- external calendar source management
- per-source sync
- Sync All
- source enable/disable controls
- synchronization status

---

## Administrator Update Notifications

V1.0.1 includes a reusable **What's New** notification system for communicating important administrator-facing changes.

The current V1.0.1 notification:

- appears after an eligible administrator login
- appears a maximum of two times per administrator
- appears only once during the same login session
- does not reappear when navigating between administrator sections
- tracks each authenticated administrator separately
- tracks each browser/device separately
- supports version-specific future update notices

The current notification explains that Pricing moved from Property to Calendar.

It includes a direct **Go to Pricing** action that opens:

```text
/admin/calendar?tab=pricing
```

A temporary `NEW` badge also appears on Calendar â†’ Pricing to help administrators locate the updated section.

The V1.0.1 modal is configured with:

```text
maxAppearances: 2
```

---

## Booking & Payment Modes

The system supports four payment modes:

- `test_manual`
- `test_stripe`
- `live_manual`
- `live_stripe`

### Manual Flow

Guest request â†’ `pending_review` â†’ administrator review â†’ approve or decline.

### Stripe Flow

Guest selects valid dates â†’ Stripe Checkout â†’ `pending_payment` â†’ Stripe webhook â†’ `confirmed`.

The system also supports:

- checkout expiration
- payment failure handling
- payment-conflict handling
- date-conflict rechecks
- full refunds
- partial refunds
- cumulative refund tracking
- separate test/live Stripe credentials

Refunds and cancellations are separate operations.

A refund does not automatically cancel the booking or release its dates.

---

## Pricing Engine

Nightly pricing precedence:

1. Date-specific price override
2. Active seasonal pricing preset with highest priority
3. Day-of-week rate
4. Base nightly rate

Minimum-night precedence:

1. Date-specific minimum-night override
2. Seasonal minimum nights
3. Property default minimum nights

The quote engine also supports:

- cleaning fees
- pet fees
- additional guest fees
- custom fees
- per-stay fees
- per-night fees
- per-guest fees
- tax calculation
- guest-facing fee visibility

Client-side quotes are recalculated server-side before booking/payment actions.

The V1.0.1 administrator interface changes did **not** alter pricing precedence, fee calculations, minimum-night logic, or booking calculations.

---

## Email System

Supported providers:

- SMTP
- Resend

V1.0.1 supports:

- system templates
- custom templates
- event-based automations
- scheduled/date-based automations
- admin and guest recipients
- property/account template variables
- notification logs

### Test Tools

- **Provider Test** â€” verifies provider delivery
- **Template Test** â€” renders a selected template with sample variables
- **Automation Test** â€” tests the selected automation and its assigned template

Automation Test sends only to the configured admin email.

It uses a real confirmed booking when available and falls back to temporary in-memory sample booking data when no eligible booking exists.

The sample test does not:

- create a booking
- block dates
- invoke Stripe
- create normal automation send-history records

---

## Calendar & iCal

V1.0.1 includes:

- token-protected iCal export
- confirmed booking export
- owner-block export
- external iCal import
- automatic external iCal synchronization every 15 minutes
- Airbnb / Vrbo / Booking.com / Other source support
- per-source manual sync
- Sync All
- enable/disable import sources
- owner blocks
- availability overrides

The export feed is generated dynamically and does not require an export cron job.

### Automatic iCal Synchronization

External calendar feeds are automatically checked every **15 minutes**.

The current production scheduler uses:

- `public.run_ical_import()`
- pg_cron
- pg_net
- Bolt Database Vault
- the Vault-managed `edge_service_role_key`
- `public.verify_ical_scheduler_token()`

The scheduled execution path operates separately from the administrator's authenticated Sync All workflow.

Admin Sync All continues to use the signed-in administrator's session authentication.

The production scheduler has been verified through real scheduled executions returning HTTP 200 and successfully synchronizing configured Airbnb and Vrbo feeds.

Actual reservation visibility can still depend on how quickly Airbnb, Vrbo, Booking.com, or another external platform publishes the reservation to its iCal feed.

> **âš ï¸ LEGACY ICAL SCHEDULER EXCEPTION â€” DO NOT OVERWRITE**
>
> **This production client intentionally uses a different verified-working iCal scheduler/authentication implementation than the current Master Template. Do not automatically replace, refactor, or "sync" this client's iCal implementation to match the Master Template. Future fresh client deployments should use the current proven Master Template implementation.**

The following temporary scheduler infrastructure was removed after the final production implementation was verified:

- temporary `scheduler_config` table
- temporary custom `ical_scheduler_token`
- `public.run_scheduled_ical_import()`
- `public.store_scheduler_secret()`
- obsolete scheduler-token lookup logic inside `ical-import`

Existing iCal parsing, blocked-date handling, source management, manual synchronization, and export behavior remain unchanged.

---

## Photos & Media

Property photo uploads support:

- JPEG
- PNG
- WebP
- maximum source size of 25 MB
- maximum 3000 px longest dimension
- no upscaling
- image-orientation handling
- aspect-ratio preservation
- sequential processing/uploads
- cleanup of temporary browser resources

### Automatic WebP Conversion

All newly uploaded property photos are automatically converted to WebP before upload.

Converted photos use:

- `.webp` file extension
- `image/webp` content type
- WebP quality of approximately 85%
- maximum 3000 px longest dimension
- proportional resizing
- no upscaling
- preserved orientation
- preserved aspect ratio

Conversion validation prevents an unoptimized original from being uploaded if WebP conversion fails.

Existing photo-management functionality remains available, including:

- sorting
- deletion
- gallery display
- Photo Tour section assignments
- sequential upload processing

Existing production property images that were migrated to WebP continue to use their optimized WebP versions.

---

## Security Model

- Email/password authentication
- No public admin self-registration
- `admin_users` allowlist
- Row Level Security
- Admin-protected write operations
- Stripe webhook signature verification
- Stripe livemode consistency checks
- Payment amount verification
- Payment-event idempotency
- iCal import SSRF protections
- Token-protected iCal export
- Secure scheduled iCal authentication
- Sensitive Stripe/email credentials stored in Vault
- Scheduler credentials stored in Vault
- Public availability exposed through a controlled view rather than direct booking-table access

---

## Property Edge Functions

The production property deployment uses the following primary Edge Functions:

1. `create-booking-request`
2. `booking-lookup`
3. `payment-config-public`
4. `send-notifications`
5. `send-automated-emails`
6. `create-checkout-session`
7. `stripe-webhook`
8. `ical-export`
9. `admin-booking-action`
10. `email-settings-status`
11. `email-settings-update`
12. `payment-settings-status`
13. `payment-settings-update`
14. `create-checkout-session-for-booking`
15. `ical-export-token`
16. `ical-import`

Two additional email-template functions may exist in some development or Master Template environments:

- `email-templates-update`
- `email-templates-reset`

They are **not part of the canonical fresh-client Edge Function set** and are not used by the current frontend.

Platform-only `platform-*` functions are separate from property-client deployments.

---

## Storage Buckets

- `branding` â€” logo, favicon, host/branding assets
- `property-photos` â€” listing and Photo Tour images

---

## Current Deployment Model

### Frontend

Hosted on Netlify.

### Backend

Bolt Database provides:

- PostgreSQL
- Auth
- Storage
- Edge Functions
- Vault
- database functions / RPCs
- scheduled backend jobs

This production client is isolated with its own application/database configuration.

---

## Current Known Limits

The current production application intentionally does not provide:

- multi-property management inside one property application
- public admin self-registration
- guest accounts/guest portal
- guest self-service booking modification/cancellation
- dynamic pricing optimization
- built-in SMS delivery
- multi-language/i18n
- PWA/offline mode
- built-in analytics platform
- automatic refunds without administrator action

Automatic recurring iCal import is supported in this production deployment and is therefore **not** a current limitation.

---

## Documentation

The detailed original technical baseline is:

`V1.0.0_Complete_System_Inventory_and_Architecture.md`

V1.0.1 changes are documented through the current release documentation and `CHANGELOG.md`.

Administrator-facing platform documentation is also available inside the protected Account area.

---

## Versioning

This repository uses semantic versioning for release tracking.

- `1.0.0` â€” original V1 production baseline
- `1.0.1` â€” current production patch release
- Patch releases (`1.0.x`) â€” bug fixes, interface improvements, performance improvements, and small backward-compatible corrections
- Minor releases (`1.x.0`) â€” backward-compatible feature additions
- Major releases (`x.0.0`) â€” substantial or breaking platform changes

Maintain release changes in `CHANGELOG.md`.

---

## V1.0.1 Production Updates

V1.0.1 includes:

- Automatic WebP conversion for new property-photo uploads
- Existing production image migration to WebP
- Automatic external iCal synchronization every 15 minutes
- Verified production-specific scheduled iCal authentication
- Improved guest-page loading and image performance
- Responsive left-sidebar administrator navigation
- Desktop sidebar collapse/expand behavior
- Mobile slide-out administrator navigation
- Pricing moved from Property to Calendar
- Calendar navigation organized into Calendar, Availability, Pricing, and Calendar Sync
- Responsive Pricing workspace
- More compact Pricing Calendar
- Improved Seasonal Pricing layout
- Reusable What's New administrator notification modal
- Temporary `NEW` badge on Calendar â†’ Pricing
- Maximum two-login update-notification behavior
- Separate update tracking per authenticated administrator and browser/device
- Direct Calendar â†’ Pricing deep linking

These updates preserve existing booking, payment, pricing, fee, email, and property-management behavior unless specifically documented otherwise.

---

## License

Proprietary. All rights reserved.
