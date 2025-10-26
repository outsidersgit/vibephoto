-- Add asaasCustomerId column to webhook_events table
-- This column stores the Asaas customer ID for better webhook tracking and debugging

-- Add the column (nullable since existing records won't have this value)
ALTER TABLE webhook_events
ADD COLUMN IF NOT EXISTS "asaasCustomerId" TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS "webhook_events_asaasCustomerId_idx"
ON webhook_events("asaasCustomerId");

-- Add comment for documentation
COMMENT ON COLUMN webhook_events."asaasCustomerId" IS 'Customer ID from Asaas webhook payload';
