-- CreateTable
CREATE TABLE "subscription_plans" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_planId_key" ON "subscription_plans"("planId");

-- CreateIndex
CREATE INDEX "subscription_plans_planId_idx" ON "subscription_plans"("planId");

-- CreateIndex
CREATE INDEX "subscription_plans_isActive_idx" ON "subscription_plans"("isActive");

-- Insert initial data from pricing.ts (using values from constants/plans.ts for consistency)
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
    5.00,  -- monthlyPrice (de pricing.ts)
    10.00, -- annualPrice (de pricing.ts)
    59.00, -- monthlyEquivalent (de pricing.ts)
    500,   -- credits
    1,     -- models
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
    179.00,  -- monthlyPrice (de pricing.ts)
    1428.00, -- annualPrice (de pricing.ts)
    119.00,  -- monthlyEquivalent (de pricing.ts)
    1200,    -- credits
    1,       -- models
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
    359.00,  -- monthlyPrice (de pricing.ts)
    2868.00, -- annualPrice (de pricing.ts)
    239.00,  -- monthlyEquivalent (de pricing.ts)
    2500,    -- credits
    1,       -- models
    '2048x2048',
    '["1 modelo de IA", "2.500 créditos/mês", "250 fotos por mês", "Máxima resolução"]'::jsonb,
    NOW(),
    NOW()
);

