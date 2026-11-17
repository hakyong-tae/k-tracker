-- Daily counters for metered third-party APIs (e.g. Google Photorealistic 3D sessions)
CREATE TABLE IF NOT EXISTS api_quota (
  day TEXT NOT NULL,                         -- YYYY-MM-DD in US Pacific (Google's quota day)
  name TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
);
