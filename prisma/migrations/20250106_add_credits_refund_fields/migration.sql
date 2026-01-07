-- Migration: Add credits tracking and refund fields to all generation types
-- Date: 2025-01-06
-- Purpose: Enable automatic credit refunds for failed generations across all media types

-- Add creditsUsed and creditsRefunded to Generation (images)
ALTER TABLE "Generation" 
ADD COLUMN IF NOT EXISTS "creditsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "creditsRefunded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "failureReason" TEXT;

-- Add creditsUsed and creditsRefunded to EditHistory (image edits)
ALTER TABLE "edit_history"
ADD COLUMN IF NOT EXISTS "credits_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "credits_refunded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "failure_reason" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'COMPLETED',
ADD COLUMN IF NOT EXISTS "error_message" TEXT,
ADD COLUMN IF NOT EXISTS "job_id" TEXT;

-- Add creditsUsed and creditsRefunded to AIModel (training)
ALTER TABLE "ai_models"
ADD COLUMN IF NOT EXISTS "credits_used" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "credits_refunded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "failure_reason" TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "Generation_creditsRefunded_idx" ON "Generation"("creditsRefunded");
CREATE INDEX IF NOT EXISTS "Generation_failureReason_idx" ON "Generation"("failureReason");
CREATE INDEX IF NOT EXISTS "edit_history_credits_refunded_idx" ON "edit_history"("credits_refunded");
CREATE INDEX IF NOT EXISTS "edit_history_job_id_idx" ON "edit_history"("job_id");
CREATE INDEX IF NOT EXISTS "ai_models_credits_refunded_idx" ON "ai_models"("credits_refunded");

-- Add comments for documentation
COMMENT ON COLUMN "Generation"."creditsUsed" IS 'Credits debited for this generation (for refund tracking)';
COMMENT ON COLUMN "Generation"."creditsRefunded" IS 'Whether credits were refunded (idempotency flag)';
COMMENT ON COLUMN "Generation"."failureReason" IS 'Categorized failure reason: SAFETY_BLOCKED, PROVIDER_ERROR, etc.';

COMMENT ON COLUMN "edit_history"."credits_used" IS 'Credits debited for this edit (for refund tracking)';
COMMENT ON COLUMN "edit_history"."credits_refunded" IS 'Whether credits were refunded (idempotency flag)';
COMMENT ON COLUMN "edit_history"."failure_reason" IS 'Categorized failure reason: SAFETY_BLOCKED, PROVIDER_ERROR, etc.';

COMMENT ON COLUMN "ai_models"."credits_used" IS 'Credits debited for this training (for refund tracking)';
COMMENT ON COLUMN "ai_models"."credits_refunded" IS 'Whether credits were refunded (idempotency flag)';
COMMENT ON COLUMN "ai_models"."failure_reason" IS 'Categorized failure reason for training failure';

