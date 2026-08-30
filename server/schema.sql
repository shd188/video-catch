CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_key TEXT NOT NULL UNIQUE,
  channel_id TEXT NOT NULL,
  email TEXT,
  max_devices INTEGER NOT NULL DEFAULT 2,
  single_use INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  note TEXT,
  sent_at TEXT,
  claim_token TEXT,
  order_no TEXT,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL,
  user_agent TEXT,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(license_id, installation_id)
);

CREATE TABLE IF NOT EXISTS releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  version TEXT NOT NULL,
  filename TEXT NOT NULL,
  release_notes TEXT,
  min_license INTEGER NOT NULL DEFAULT 1,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(channel_id, version)
);

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 兑换码（按次数套餐，与激活码并存；来源：sph-dl credits 模型）
CREATE TABLE IF NOT EXISTS redeem_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  pack INTEGER NOT NULL,
  total INTEGER NOT NULL,
  remaining INTEGER NOT NULL,
  note TEXT,
  activated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_activations_license ON activations(license_id);
CREATE INDEX IF NOT EXISTS idx_releases_channel ON releases(channel_id);
CREATE INDEX IF NOT EXISTS idx_redeem_codes_pack ON redeem_codes(pack);
CREATE INDEX IF NOT EXISTS idx_redeem_codes_remaining ON redeem_codes(remaining);

-- Unique per order only among active codes; revoked rows keep order_no for lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_channel_order
  ON licenses(channel_id, order_no)
  WHERE order_no IS NOT NULL AND order_no != '' AND ifnull(revoked, 0) = 0;
