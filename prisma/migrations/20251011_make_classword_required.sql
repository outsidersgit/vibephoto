-- Make classWord required and set defaults for existing models
-- First, update existing models that have NULL classWord based on their class

UPDATE "ai_models"
SET "classWord" = CASE
  WHEN class = 'MAN' THEN 'man'
  WHEN class = 'WOMAN' THEN 'woman'
  WHEN class = 'BOY' THEN 'boy'
  WHEN class = 'GIRL' THEN 'girl'
  WHEN class = 'ANIMAL' THEN 'person'
  ELSE 'person'
END
WHERE "classWord" IS NULL;

-- Now make the column NOT NULL
ALTER TABLE "ai_models" ALTER COLUMN "classWord" SET NOT NULL;

-- Add comment to clarify triggerWord usage
COMMENT ON COLUMN "ai_models"."triggerWord" IS 'Display name/title of the model (NOT used in generation prompts)';
COMMENT ON COLUMN "ai_models"."classWord" IS 'REQUIRED: Class word for generation (e.g., person, woman, man, boy, girl)';
