-- Remove unique constraint to allow multiple package generations per user
-- This allows users to generate the same package multiple times

-- Remove the unique constraint if it exists
ALTER TABLE "user_packages" DROP CONSTRAINT IF EXISTS "user_packages_userId_packageId_key";

-- CRITICAL: Also remove the unique index (PostgreSQL sometimes creates indexes separately)
DROP INDEX IF EXISTS "user_packages_userId_packageId_key";

