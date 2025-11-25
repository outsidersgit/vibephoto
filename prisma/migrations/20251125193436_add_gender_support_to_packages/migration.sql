-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'BOTH');

-- AlterTable ALTER photo_packages ADD COLUMN gender
ALTER TABLE "photo_packages" ADD COLUMN "gender" "Gender" DEFAULT 'BOTH';

-- AlterTable: Add gender-specific fields to photo_packages
ALTER TABLE "photo_packages" ADD COLUMN "promptsMale" JSONB[] DEFAULT ARRAY[]::JSONB[];
ALTER TABLE "photo_packages" ADD COLUMN "promptsFemale" JSONB[] DEFAULT ARRAY[]::JSONB[];
ALTER TABLE "photo_packages" ADD COLUMN "previewUrlsMale" JSONB[] DEFAULT ARRAY[]::JSONB[];
ALTER TABLE "photo_packages" ADD COLUMN "previewUrlsFemale" JSONB[] DEFAULT ARRAY[]::JSONB[];

-- AlterTable: Add selectedGender to user_packages
ALTER TABLE "user_packages" ADD COLUMN "selectedGender" "Gender";

-- Data migration: Copy existing prompts and previewUrls to both gender fields
UPDATE "photo_packages"
SET
  "promptsMale" = "prompts",
  "promptsFemale" = "prompts",
  "previewUrlsMale" = "previewUrls",
  "previewUrlsFemale" = "previewUrls"
WHERE "prompts" IS NOT NULL AND array_length("prompts", 1) > 0;
