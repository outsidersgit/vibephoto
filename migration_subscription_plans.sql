-- Verificar e criar enum Plan se necessário
DO $$ BEGIN
  CREATE TYPE "Plan" AS ENUM ('STARTER', 'PREMIUM', 'GOLD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "subscription_plans" (
    "id" TEXT NOT NULL,
    "planId" "Plan" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT,
    "monthlyPrice" DOUBLE PRECISION NOT NULL,
    "annualPrice" DOUBLE PRECISION NOT NULL,
    "monthlyEquivalent" DOUBLE PRECISION NOT NULL,
    "credits" INTEGER NOT NULL,
    "models" INTEGER NOT NULL,
    "resolution" TEXT NOT NULL,
    "features" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (usando IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_planId_key" ON "subscription_plans"("planId");
CREATE INDEX IF NOT EXISTS "subscription_plans_planId_idx" ON "subscription_plans"("planId");
CREATE INDEX IF NOT EXISTS "subscription_plans_isActive_idx" ON "subscription_plans"("isActive");

-- Insert initial data (usando ON CONFLICT para evitar duplicatas)
INSERT INTO "subscription_plans" (
    "id",
    "planId",
    "name",
    "description",
    "isActive",
    "popular",
    "color",
    "monthlyPrice",
    "annualPrice",
    "monthlyEquivalent",
    "credits",
    "models",
    "resolution",
    "features",
    "createdAt",
    "updatedAt"
) VALUES
-- STARTER plan
(
    'sub_plan_starter',
    'STARTER',
    'Starter',
    'Perfeito para começar sua jornada com IA',
    true,
    false,
    'blue',
    5.00,
    10.00,
    59.00,
    500,
    1,
    '512x512',
    '["1 modelo de IA", "500 créditos/mês", "50 fotos por mês", "Máxima resolução"]'::jsonb,
    NOW(),
    NOW()
),
-- PREMIUM plan
(
    'sub_plan_premium',
    'PREMIUM',
    'Premium',
    'Ideal para criadores de conteúdo',
    true,
    true,
    'purple',
    179.00,
    1428.00,
    119.00,
    1200,
    1,
    '1024x1024',
    '["1 modelo de IA", "1.200 créditos/mês", "120 fotos por mês", "Máxima resolução"]'::jsonb,
    NOW(),
    NOW()
),
-- GOLD plan
(
    'sub_plan_gold',
    'GOLD',
    'Gold',
    'Para profissionais e agências',
    true,
    false,
    'yellow',
    359.00,
    2868.00,
    239.00,
    2500,
    1,
    '2048x2048',
    '["1 modelo de IA", "2.500 créditos/mês", "250 fotos por mês", "Máxima resolução"]'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT ("planId") DO NOTHING;

