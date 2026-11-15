-- Persist ownership even before a user receives an API key.
ALTER TABLE reseller_users ADD COLUMN site_id TEXT;
CREATE INDEX IF NOT EXISTS idx_reseller_users_site ON reseller_users(site_id);
