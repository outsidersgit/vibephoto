-- Add seed field to package prompts
-- NOTE: Prompts are stored as Json[] in PhotoPackage.prompts
-- Each prompt object will now have: { text: string, style?: string, description?: string, seed?: number }
-- This migration is informational only - Json fields don't require schema changes
-- Seeds will be added programmatically when admins edit packages

-- No SQL changes needed - Json[] fields are schema-less
-- This migration serves as documentation for the new prompt structure

