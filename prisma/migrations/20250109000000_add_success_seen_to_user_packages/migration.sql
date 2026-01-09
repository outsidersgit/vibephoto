-- AlterTable: Add successSeen field to UserPackage
-- This field tracks whether the user has seen the success banner/modal for a completed package
-- Prevents success notifications from re-appearing on every login

ALTER TABLE "user_packages" ADD COLUMN "successSeen" BOOLEAN NOT NULL DEFAULT false;

-- Optional: Add index for faster queries filtering by successSeen
CREATE INDEX "user_packages_successSeen_idx" ON "user_packages"("successSeen");
