CREATE TABLE IF NOT EXISTS races (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',      -- draft | published | hidden
  date TEXT NOT NULL,                        -- YYYY-MM-DD local race date
  country TEXT,
  meta TEXT NOT NULL,                        -- RaceMeta JSON
  course TEXT NOT NULL,                      -- Course JSON (resampled)
  gpx_key TEXT,                              -- R2 key of the original GPX
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS races_status_date ON races(status, date);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'new',          -- new | edit
  race_id INTEGER,                           -- target race for edits
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | approved | rejected
  meta TEXT NOT NULL,
  course TEXT,
  gpx_key TEXT,
  submitter TEXT,
  contact TEXT,
  message TEXT,
  checks TEXT,
  review_note TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS submissions_status ON submissions(status, created_at);
CREATE INDEX IF NOT EXISTS submissions_ip ON submissions(ip_hash, created_at);

CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires INTEGER NOT NULL
);
