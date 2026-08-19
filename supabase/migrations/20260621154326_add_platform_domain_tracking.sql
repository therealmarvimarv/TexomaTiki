-- ── Instance domains ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_instance_domains (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           uuid NOT NULL REFERENCES platform_clients(id) ON DELETE CASCADE,
  instance_id         uuid NOT NULL REFERENCES platform_instances(id) ON DELETE CASCADE,
  domain              text NOT NULL,
  domain_type         text NOT NULL DEFAULT 'primary'
    CHECK (domain_type IN ('primary','redirect','temporary','staging')),
  status              text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','pending_dns','dns_configured','connected_to_netlify','ssl_pending','ssl_active','live','failed')),
  dns_provider        text,
  registrar           text,
  netlify_domain_id   text,
  ssl_status          text,
  is_primary          boolean NOT NULL DEFAULT false,
  notes               text,
  last_checked_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_domain_per_instance UNIQUE (instance_id, domain)
);

CREATE TRIGGER trg_instance_domains_updated_at
  BEFORE UPDATE ON platform_instance_domains
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

ALTER TABLE platform_instance_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "domains_select" ON platform_instance_domains
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "domains_insert" ON platform_instance_domains
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "domains_update" ON platform_instance_domains
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "domains_delete" ON platform_instance_domains
  FOR DELETE TO authenticated USING (is_platform_super_admin());

CREATE INDEX IF NOT EXISTS idx_domains_instance_id ON platform_instance_domains(instance_id);
CREATE INDEX IF NOT EXISTS idx_domains_client_id   ON platform_instance_domains(client_id);

-- ── DNS records ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_instance_dns_records (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id        uuid NOT NULL REFERENCES platform_instance_domains(id) ON DELETE CASCADE,
  record_type      text NOT NULL DEFAULT 'CNAME'
    CHECK (record_type IN ('A','CNAME','TXT','MX','ALIAS','ANAME','other')),
  host             text NOT NULL,
  value            text NOT NULL,
  required_value   text,
  status           text NOT NULL DEFAULT 'needed'
    CHECK (status IN ('needed','pending','verified','failed','skipped')),
  notes            text,
  last_checked_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_dns_records_updated_at
  BEFORE UPDATE ON platform_instance_dns_records
  FOR EACH ROW EXECUTE FUNCTION update_platform_updated_at();

ALTER TABLE platform_instance_dns_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dns_records_select" ON platform_instance_dns_records
  FOR SELECT TO authenticated USING (is_platform_super_admin());
CREATE POLICY "dns_records_insert" ON platform_instance_dns_records
  FOR INSERT TO authenticated WITH CHECK (is_platform_super_admin());
CREATE POLICY "dns_records_update" ON platform_instance_dns_records
  FOR UPDATE TO authenticated USING (is_platform_super_admin()) WITH CHECK (is_platform_super_admin());
CREATE POLICY "dns_records_delete" ON platform_instance_dns_records
  FOR DELETE TO authenticated USING (is_platform_super_admin());

CREATE INDEX IF NOT EXISTS idx_dns_records_domain_id ON platform_instance_dns_records(domain_id);
