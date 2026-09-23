# Tiki Cottage â€” Vacation Rental Management Platform

**Release:** V1.0.0  
**Status:** Canonical production baseline  
**Application type:** Single-property direct-booking and property-management platform

Tiki Cottage is a self-managed vacation-rental platform with a public guest website and a protected administrator dashboard. It supports direct booking, Stripe payments, calendar synchronization, pricing, property content, automated email communication, cleaning, maintenance, branding, and day-to-day booking operations.

This README describes the **current V1.0.0 implementation**. Older documentation that references Express, Prisma, MySQL, PM2, Nginx, local file uploads, or `/api/...` REST endpoints is legacy and does not describe the active application.

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
- **Calendar:** iCal import/export
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

V1.0.0 includes:

- Property listing homepage
- Responsive hero photo grid
- Shared photo lightbox
- Dedicated Photo Tour
- Amenities
- Host information
- Property highlights
- Sleeping arrangements / â€œWhere Youâ€™ll Sleepâ€
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

---

## Administrator Dashboard

The protected admin application includes:

- **Overview**
- **Calendar**
  - booking events
  - owner blocks
  - imported iCal activity
  - cleaning activity
  - availability editor
  - calendar sync
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
  - Pricing
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

## Booking & Payment Modes

The system supports four payment modes:

- `test_manual`
- `test_stripe`
- `live_manual`
- `live_stripe`

### Manual flow

Guest request â†’ `pending_review` â†’ administrator review â†’ approve or decline.

### Stripe flow

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

Refunds and cancellations are separate operations. A refund does not automatically cancel the booking or release its dates.

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

---

## Email System

Supported providers:

- SMTP
- Resend

V1.0.0 supports:

- system templates
- custom templates
- event-based automations
- scheduled/date-based automations
- admin and guest recipients
- property/account template variables
- notification logs

### Test tools

- **Provider Test** â€” verifies provider delivery
- **Template Test** â€” renders a selected template with sample variables
- **Automation Test** â€” tests the selected automation and its assigned template

Automation Test sends only to the configured admin email. It uses a real confirmed booking when available and falls back to temporary in-memory sample booking data when no eligible booking exists. The sample test does not create a booking, block dates, invoke Stripe, or create normal automation send-history records.

---

## Calendar & iCal

V1.0.0 includes:

- token-protected iCal export
- confirmed booking export
- owner-block export
- external iCal import
- Airbnb / VRBO / Booking.com / Other source support
- per-source sync
- Sync All
- enable/disable import sources
- owner blocks
- availability overrides

The export feed is generated dynamically and does not require an export cron job.

External iCal import is manually triggered in V1.0.0.

---

## Photos & Media

Property photo uploads support:

- JPEG
- PNG
- WebP
- maximum source size of 25 MB
- maximum 3000 px longest dimension
- no upscaling
- JPEG/WebP quality 0.85
- PNG preserved losslessly
- image-orientation handling
- sequential processing/uploads
- cleanup of temporary browser resources

The shared Lightbox preserves natural image aspect ratio within a maximum rendered size of approximately **1036 Ã— 583 px**.

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
- Sensitive Stripe/email credentials stored in Vault
- Public availability exposed through a controlled view rather than direct booking-table access

---

## Canonical Fresh-Client Edge Functions

A fresh V1.0.0 property deployment uses **16 canonical Edge Functions**:

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

Two additional email-template functions may exist in the master live environment:

- `email-templates-update`
- `email-templates-reset`

They are **not part of the canonical fresh-client V1 deployment** and are not used by the current frontend.

Platform-only `platform-*` functions are also separate from fresh client deployments.

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

Each client deployment is isolated with its own application/database configuration.

---

## V1.0.0 Known Limits

V1.0.0 intentionally does not provide:

- multi-property management inside one property application
- public admin self-registration
- guest accounts/guest portal
- guest self-service booking modification/cancellation
- automatic recurring iCal import
- dynamic pricing optimization
- built-in SMS delivery
- multi-language/i18n
- PWA/offline mode
- built-in analytics platform
- automatic refunds without administrator action

---

## Documentation

The detailed technical baseline for this release is:

`V1.0.0_Complete_System_Inventory_and_Architecture.md`

Administrator-facing platform documentation is also available inside the protected Account area.

---

## Versioning

This repository uses semantic versioning for release tracking.

- `1.0.0` â€” canonical V1 production baseline
- Patch releases (`1.0.x`) â€” bug fixes and small corrections
- Minor releases (`1.x.0`) â€” backward-compatible feature additions
- Major releases (`x.0.0`) â€” substantial or breaking platform changes

Maintain release changes in `CHANGELOG.md`.

---

## License

Proprietary. All rights reserved.
