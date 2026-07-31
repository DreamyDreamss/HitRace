-- A weekly distance goal is the habit loop of every running app: something to be
-- 40% of the way through on Wednesday. Per-user, tunable, defaults to 20km.
BEGIN;
SET search_path TO hitrace, public;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS weekly_goal_km INT NOT NULL DEFAULT 20
  CHECK (weekly_goal_km BETWEEN 0 AND 500);

COMMIT;
