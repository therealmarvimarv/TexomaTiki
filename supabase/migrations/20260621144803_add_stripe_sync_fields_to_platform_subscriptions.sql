ALTER TABLE platform_client_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_price_id              text,
  ADD COLUMN IF NOT EXISTS stripe_product_id            text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id   text,
  ADD COLUMN IF NOT EXISTS stripe_latest_invoice_id     text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status   text,
  ADD COLUMN IF NOT EXISTS last_synced_at               timestamptz,
  ADD COLUMN IF NOT EXISTS sync_status                  text NOT NULL DEFAULT 'not_connected'
    CHECK (sync_status IN ('not_connected','connected','sync_failed')),
  ADD COLUMN IF NOT EXISTS sync_error                   text;
