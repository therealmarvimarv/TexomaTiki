# Tiki Cottage — Vacation Rental Management Platform

**Release:** V1.0.1  
**Status:** Active production client deployment  
**Application type:** Single-property direct-booking and property-management platform

Tiki Cottage is a self-managed vacation-rental platform with a public guest website and a protected administrator dashboard. It supports direct booking, Stripe payments, automatic calendar synchronization, layered pricing, property content, automated email communication, cleaning, maintenance, branding, and day-to-day booking operations.

This README describes the **current V1.0.1 production implementation** of this live client.

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

The current production release includes:

- Property listing homepage
- Responsive hero photo grid
- Shared photo lightbox
- Dedicated Photo Tour
- Amenities
- Host information
- Property highlights
- Sleeping arrangements / “Where You'll Sleep”
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
- Booking success, cancel, and request-success pages
- Public Privacy Policy and Terms
- Dynamic branding, logo, favicon, SEO title, and meta description
- Optimized image loading
- Property-page skeleton loading states
- Lazy-loaded Photo Tour images
- Adjacent-image Lightbox preloading
- Responsive mobile Lightbox behavior

---

## Administrator Dashboard

The protected administrator application uses a responsive **left-sidebar navigation system**.

### Desktop

- Expandable/collapsible left sidebar
- Sidebar state preserved between sessions
- Compact collapsed navigation
- Increased usable dashboard workspace

### Mobile

- Responsive admin header
- Slide-out navigation
- Touch-friendly dashboard navigation

### Main Navigation

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
  - platform Privacy Policy, Terms, and Documentation

---

## Calendar Workspace

The Calendar section is organized into four primary areas:

### Calendar

Displays:

- confirmed bookings
- pending booking activity
- owner blocks
- imported iCal blocks
- cleaning activity

Calendar events can be opened for additional information and linked back to related booking records.

### Availability

Provides property availability and owner-block management.

### Pricing

Pricing was moved from the Property section into Calendar so date-based pricing and availability controls are managed together.

Calendar → Pricing contains:

- Pricing Calendar
- Base rate settings
- Day-of-week pricing
- Date-specific pricing
- Date-specific minimum-night overrides
- Seasonal Pricing
- Rates
- Fees

The Pricing workspace is responsive:

- **Wide screens:** Pricing Calendar, rate settings, and Seasonal Pricing display in three columns.
- **Intermediate screens:** Pricing Calendar and rate settings display in two columns with Seasonal Pricing below.
- **Mobile:** Pricing tools display in a single-column layout.

The Pricing Calendar uses a compact layout so more pricing information remains visible without overwhelming the workspace.

### Calendar Sync

Provides:

- external iCal source management
- per-source synchronization
- Sync All
- source enable/disable controls
- synchronization status

---

## Admin Update Notifications

V1.0.1 includes a reusable **What's New** notification system for communicating important administrator-facing platform changes.

The current V1.0.1 update notification:

- appears after an eligible administrator login
- appears a maximum of **two times per administrator**
- appears only once during the same login session
- does not reappear while navigating between admin sections
- maintains separate appearance counts for different authenticated administrators
- maintains tracking separately by browser/device
- supports version-specific update cycles
- can provide direct links to newly changed platform areas

For V1.0.1, the notification includes a direct **Go to Pricing** action that opens:

```text
/admin/calendar?tab=pricing
```

A temporary `NEW` badge also identifies Calendar → Pricing for administrators who are learning the updated navigation.

---

## Booking & Payment Modes

The system supports four payment modes:

- `test_manual`
- `test_stripe`
- `live_manual`
- `live_stripe`

### Manual Flow

Guest request → `pending_review` → administrator review → approve or decline.

### Stripe Flow

Guest selects valid dates → Stripe Checkout → `pending_payment` → Stripe webhook → `confirmed`.

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

Client-side quotes are recalculated server-side before booking or payment actions.

The V1.0.1 dashboard redesign did **not** change pricing precedence, pricing calculations, fee calculations, or minimum-night behavior.

---

## Email System

Supported providers:

- SMTP
- Resend

The current production system supports:

- system templates
- custom templates
- event-based automations
- scheduled/date-based automations
- admin and guest recipients
- property/account template variables
- notification logs

### Test Tools

- **Provider Test** — verifies provider delivery
- **Template Test** — renders a selected template with sample variables
- **Automation Test** — tests the selected automation and its assigned template

Automation Test sends only to the configured admin email.

It uses a real confirmed booking when available and falls back to temporary in-memory sample booking data when no eligible booking exists.

The sample test does not:

- create a booking
- block dates
- invoke Stripe
- create normal automation send-history records

---

## Calendar & iCal

The live production client includes:

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

External iCal feeds are automatically checked every **15 minutes**.

The production scheduler uses:

- `public.run_ical_import()`
- pg_cron
- pg_net
- Bolt Database Vault
- the Vault-managed `edge_service_role_key`
- `public.verify_ical_scheduler_token()`

The scheduled execution path operates independently from the authenticated administrator Sync All workflow.

Admin Sync All continues to use the signed-in administrator's session authentication.

The production scheduler has been verified with real scheduled executions returning HTTP 200 and successfully synchronizing configured Airbnb and Vrbo feeds.

Actual reservation visibility can still depend on how quickly an external platform publishes a reservation to its iCal feed.

> **⚠️ LEGACY ICAL SCHEDULER EXCEPTION — DO NOT OVERWRITE**
>
> **This production client intentionally uses a different verified-working iCal scheduler/authentication implementation than the current Master Template. Do not automatically replace, refactor, or “sync” this client's iCal implementation to match the Master Template.**
>
> **Future fresh client deployments should use the current verified Master Template implementation.**

The following temporary scheduler infrastructure was removed after the final production scheduler was established:

- temporary `scheduler_config` table
- temporary custom `ical_scheduler_token`
- `public.run_scheduled_ical_import()`
- `public.store_scheduler_secret()`
- obsolete scheduler-token lookup logic inside `ical-import`

This exception applies specifically to the scheduler/authentication implementation. Existing iCal parsing, blocked-date handling, source management, manual synchronization, and export behavior remain part of the normal application.

---

## Photos & Media

Property photo uploads support:

- JPEG
- PNG
- WebP
- maximum source size of 25 MB
- maximum 3000 px longest dimension
- no upscaling
- image-orientation preservation
- aspect-ratio preservation
- sequential processing/uploads
- cleanup of temporary browser resources

### Automatic WebP Optimization

All newly uploaded property photos are automatically converted to WebP before upload.

New uploads use:

- `.webp` file extension
- `image/webp` content type
- WebP quality of approximately **85%**
- maximum dimension of **3000 px**
- proportional resizing
- preserved orientation and aspect ratio

If image conversion fails, the upload process stops instead of silently uploading an unoptimized original.

Existing photo-management functionality remains unchanged, including:

- sorting
- deletion
- gallery display
- Photo Tour section assignment
- sequential uploads

Previously uploaded images are not automatically reconverted merely because this functionality exists.

### Guest Image Performance

The guest property experience includes:

- primary hero-image loading priority
- smooth image fade-in transitions
- Photo Tour lazy loading
- Lightbox loading placeholders
- adjacent-image preloading
- responsive mobile Lightbox sizing
- mobile navigation arrows positioned within the image area

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

The property application uses the following primary Edge Functions:

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

Two additional email-template functions may exist in some development or master environments:

- `email-templates-update`
- `email-templates-reset`

They are **not part of the canonical fresh-client Edge Function set** and are not used by the current frontend.

Platform-only `platform-*` functions are separate from property-client deployments.

---

## Storage Buckets

- `branding` — logo, favicon, host, and branding assets
- `property-photos` — listing and Photo Tour images

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

This production client uses its own isolated application and database configuration.

---

## Current Production Limits

The current production application intentionally does not provide:

- multi-property management inside one property application
- public admin self-registration
- guest accounts or guest portal
- guest self-service booking modification/cancellation
- dynamic pricing optimization
- built-in SMS delivery
- multi-language/i18n
- PWA/offline mode
- built-in analytics platform
- automatic refunds without administrator action

Automatic recurring iCal import **is supported** in this production client and is therefore no longer considered a current limitation.

---

## Documentation

The detailed technical baseline is stored in:

```text
V1.0.0_Complete_System_Inventory_and_Architecture.md
```

Administrator-facing platform documentation is also available inside the protected Account area.

The technical documentation should be maintained alongside production changes so that it accurately reflects the live client rather than automatically mirroring the Master Template.

---

## Versioning

This repository uses semantic versioning for release tracking.

- `1.0.0` — original canonical V1 production baseline
- `1.0.1` — current production patch release
- Patch releases (`1.0.x`) — bug fixes, interface improvements, performance improvements, and small backward-compatible changes
- Minor releases (`1.x.0`) — backward-compatible feature additions
- Major releases (`x.0.0`) — substantial or breaking platform changes

Maintain release-specific changes in:

```text
CHANGELOG.md
```

### V1.0.1 Production Updates

V1.0.1 includes production improvements such as:

- automatic WebP conversion for new property-photo uploads
- automatic external iCal synchronization every 15 minutes
- verified production-specific scheduled iCal authentication
- responsive left-sidebar admin navigation
- mobile slide-out admin navigation
- Pricing moved from Property to Calendar
- responsive Calendar → Pricing workspace
- improved Pricing Calendar layout
- improved Seasonal Pricing layout
- reusable What's New administrator notification system
- temporary Calendar → Pricing `NEW` badge
- two-login maximum update-notification behavior
- per-administrator update tracking
- improved Pricing deep-link behavior

These updates preserve existing booking, payment, pricing, fee, email, and property-management functionality unless specifically documented otherwise.

---

## License

Proprietary. All rights reserved.