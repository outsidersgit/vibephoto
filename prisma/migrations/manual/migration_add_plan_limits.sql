-- Migration: Add plan feature limits
-- Add optional feature limit fields to subscription_plans table

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS "maxPhotos" INTEGER,
ADD COLUMN IF NOT EXISTS "maxVideos" INTEGER,
ADD COLUMN IF NOT EXISTS "maxModels" INTEGER,
ADD COLUMN IF NOT EXISTS "maxStorage" INTEGER;

COMMENT ON COLUMN subscription_plans."maxPhotos" IS 'Limite de fotos por mês';
COMMENT ON COLUMN subscription_plans."maxVideos" IS 'Limite de vídeos por mês';  
COMMENT ON COLUMN subscription_plans."maxModels" IS 'Limite de modelos IA';
COMMENT ON COLUMN subscription_plans."maxStorage" IS 'Limite de armazenamento em GB';
