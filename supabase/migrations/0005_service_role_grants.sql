-- 0005: table privileges for service_role.
-- This project has "Automatically expose new tables" off, so new tables get no
-- grants by default. 0002 granted only to anon/authenticated. service_role
-- bypasses RLS but still needs ordinary privileges, so every server-side query
-- through lib/supabase/admin.ts failed with 42501 (insufficient privilege).
-- Safe to re-run.

grant usage on schema public to service_role;

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Future objects get the same grants. Default privileges apply to objects
-- created by the role running this (postgres, in the SQL editor and the CLI).
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
