-- Old JWT session rows cannot be migrated onto the new hashed-refresh schema.
-- Users, trips, and other tables are not touched. Everyone signs in again.
DROP TABLE IF EXISTS "Session";
