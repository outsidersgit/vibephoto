-- Remove unique constraint to allow multiple package generations per user
-- This allows users to generate the same package multiple times
ALTER TABLE "user_packages" DROP CONSTRAINT IF EXISTS "user_packages_userId_packageId_key";

