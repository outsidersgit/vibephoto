-- AlterTable: Remove unique constraint to allow multiple activations
ALTER TABLE "user_packages" DROP CONSTRAINT IF EXISTS "user_packages_userId_packageId_key";

