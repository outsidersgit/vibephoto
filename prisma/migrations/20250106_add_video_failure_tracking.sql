-- Add failureReason and creditsRefunded fields to VideoGeneration table
-- This migration adds support for:
-- 1. Categorized error tracking (SAFETY_BLOCKED, PROVIDER_ERROR, etc.)
-- 2. Idempotent credit refunds (prevent double refunds)

-- Add failureReason column to track specific error categories
ALTER TABLE "VideoGeneration" 
ADD COLUMN IF NOT EXISTS "failureReason" TEXT;

-- Add creditsRefunded column for idempotency (prevents double refunds)
ALTER TABLE "VideoGeneration" 
ADD COLUMN IF NOT EXISTS "creditsRefunded" BOOLEAN NOT NULL DEFAULT false;

-- Add index on failureReason for analytics queries
CREATE INDEX IF NOT EXISTS "VideoGeneration_failureReason_idx" 
ON "VideoGeneration"("failureReason") 
WHERE "failureReason" IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN "VideoGeneration"."failureReason" IS 'Categorized error reason: SAFETY_BLOCKED, PROVIDER_ERROR, INTERNAL_ERROR, STORAGE_ERROR, TIMEOUT_ERROR, QUOTA_ERROR';
COMMENT ON COLUMN "VideoGeneration"."creditsRefunded" IS 'Whether credits were refunded for this video generation (for idempotency)';

