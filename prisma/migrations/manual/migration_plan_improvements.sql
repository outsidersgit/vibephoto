-- Migration: Improve subscription plans for FREE/PAID types
-- 1. Create PlanType enum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'PAID');

-- 2. Add planType column with default PAID
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS "planType" "PlanType" DEFAULT 'PAID';

-- 3. Change planId from enum to String for flexibility
-- IMPORTANT: This requires manual intervention for existing data
-- First, create a temporary column
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS "planId_new" TEXT;

-- Update new column with current values (convert enum to text)
UPDATE subscription_plans SET "planId_new" = "planId"::TEXT;

-- Drop the old constraint and column (after backing up data!)
-- WARNING: Only run this after verifying data is copied correctly
-- ALTER TABLE subscription_plans DROP COLUMN "planId";
-- ALTER TABLE subscription_plans RENAME COLUMN "planId_new" TO "planId";
-- ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_planId_unique UNIQUE ("planId");

-- Note: The above steps need to be done carefully in production
-- For now, keep both columns and migrate data gradually

COMMENT ON COLUMN subscription_plans."planType" IS 'FREE = créditos únicos sem renovação, PAID = renovação mensal/anual';
