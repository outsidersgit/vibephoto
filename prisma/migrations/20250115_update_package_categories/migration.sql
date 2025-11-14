-- Create new enum with desired categories
CREATE TYPE "PackageCategory_new" AS ENUM ('LIFESTYLE', 'PROFESSIONAL', 'CREATIVE', 'FASHION', 'PREMIUM');

-- Re-map existing rows to the new categories based on package names
ALTER TABLE "photo_packages"
  ALTER COLUMN "category" DROP DEFAULT;

ALTER TABLE "photo_packages"
  ALTER COLUMN "category"
  TYPE "PackageCategory_new"
  USING (
    CASE
      WHEN "name" IN (
        'Life Aesthetic',
        'Summer Vibes',
        'Wanderlust',
        'Neo Casual',
        'Mirror Selfie',
        'Pet Shot',
        'Food Mood',
        'Flight Mode',
        'Fitness Aesthetic'
      ) THEN 'LIFESTYLE'::"PackageCategory_new"
      WHEN "name" IN (
        'Executive Minimalist',
        'Urban'
      ) THEN 'PROFESSIONAL'::"PackageCategory_new"
      WHEN "name" IN (
        'Conceitual',
        'Comic Book',
        'Vintage',
        '2000s Cam'
      ) THEN 'CREATIVE'::"PackageCategory_new"
      WHEN "name" IN (
        'Makeup',
        'Rebel',
        'Outfit'
      ) THEN 'FASHION'::"PackageCategory_new"
      WHEN "name" IN (
        'Quiet Luxury',
        'Soft Power',
        'Golden Hour'
      ) THEN 'PREMIUM'::"PackageCategory_new"
      ELSE 'LIFESTYLE'::"PackageCategory_new"
    END
  );

-- Replace the old enum type with the new one
DROP TYPE "PackageCategory";
ALTER TYPE "PackageCategory_new" RENAME TO "PackageCategory";

-- Optional default for new inserts
ALTER TABLE "photo_packages"
  ALTER COLUMN "category"
  SET DEFAULT 'LIFESTYLE';

