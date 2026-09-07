-- switch-role.sql
--
-- Flips a single test user's role in BOTH places the app checks it:
--   1. public.profiles.role_id                   - backend API authorization
--   2. auth.users.raw_user_meta_data->>'role_id' - frontend UI routing
--
-- NOTE: the backend's `User` entity (ClaimShieldDbContext.Users) maps
-- onto Supabase's public.profiles table, not a separate "Users" table -
-- see the "USER (maps to Supabase's public.profiles table...)" Fluent
-- config block in ClaimShield.Api/Data/Context/ClaimShieldDbContext.cs.
-- profiles uses lowercase snake_case columns (id, role_id, email, ...),
-- keyed by auth.users.id - not the PascalCase "RoleId"/"Email" a plain
-- EF table name would suggest. There is no public."Users" table at all;
-- an earlier draft of this script referenced one and would have failed
-- with "relation public.Users does not exist" - confirmed directly
-- against the live schema and the Fluent mapping before fixing this.
--
-- Role IDs (see ClaimShield.Api/Constants/RoleConstants.cs):
--   1 = Customer   2 = Repairer   3 = Surveyor   4 = Approver   5 = Admin
--
-- Usage (psql):
--   psql "<SupabaseConnection value from appsettings.Development.json>" \
--     -v email="'karthik@example.com'" \
--     -v role=4 \
--     -f switch-role.sql
--
-- Run it again with -v role=5 to switch back to Admin.
-- IMPORTANT: after running this, the person must sign out and sign back
-- in on the frontend - the role_id is baked into the JWT at token
-- issuance, so a page refresh alone will not pick up the change.

BEGIN;

UPDATE public.profiles
SET role_id = :role
WHERE email = :email;

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  raw_user_meta_data,
  '{role_id}',
  to_jsonb(:role::int)
)
WHERE email = :email;

COMMIT;

-- Verify both sides landed on the same value before trusting it.
SELECT email, role_id AS backend_role_id
FROM public.profiles
WHERE email = :email;

SELECT email, raw_user_meta_data -> 'role_id' AS frontend_role_id
FROM auth.users
WHERE email = :email;
