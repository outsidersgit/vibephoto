-- Script para verificar dados de assinatura antes e depois do update

-- 1. Verificar quantos usuários ACTIVE têm os campos necessários preenchidos
SELECT
  COUNT(*) as total_active_users,
  COUNT("subscriptionStartedAt") as tem_subscription_started,
  COUNT("billingCycle") as tem_billing_cycle,
  COUNT("subscriptionId") as tem_subscription_id,
  COUNT("nextDueDate") as tem_next_due_date
FROM users
WHERE "subscriptionStatus" = 'ACTIVE';

-- 2. Ver detalhes dos usuários ACTIVE com assinatura
SELECT
  id,
  email,
  plan,
  "billingCycle",
  "subscriptionStatus",
  "subscriptionId",
  "subscriptionStartedAt",
  "nextDueDate",
  "subscriptionEndsAt",
  -- Verificar se nextDueDate foi calculado corretamente
  CASE
    WHEN "billingCycle" = 'MONTHLY' THEN
      EXTRACT(DAY FROM ("nextDueDate" - "subscriptionStartedAt"))
    WHEN "billingCycle" = 'YEARLY' THEN
      EXTRACT(DAY FROM ("nextDueDate" - "subscriptionStartedAt")) / 365
    ELSE NULL
  END as diferenca_calculada
FROM users
WHERE
  "subscriptionStatus" = 'ACTIVE'
  AND "subscriptionId" IS NOT NULL
ORDER BY "subscriptionStartedAt" DESC;

-- 3. Verificar usuários que deveriam ter sido atualizados mas não foram
SELECT
  id,
  email,
  plan,
  "billingCycle",
  "subscriptionStatus",
  "subscriptionStartedAt",
  "nextDueDate",
  "subscriptionId"
FROM users
WHERE
  "subscriptionStatus" = 'ACTIVE'
  AND "subscriptionStartedAt" IS NOT NULL
  AND "billingCycle" IN ('MONTHLY', 'YEARLY')
  AND "subscriptionId" IS NOT NULL
  AND (
    "nextDueDate" IS NULL
    OR
    -- Verificar se nextDueDate está incorreto (não é subscriptionStartedAt + ciclo)
    (
      "billingCycle" = 'MONTHLY'
      AND "nextDueDate" != "subscriptionStartedAt" + INTERVAL '1 month'
    )
    OR
    (
      "billingCycle" = 'YEARLY'
      AND "nextDueDate" != "subscriptionStartedAt" + INTERVAL '1 year'
    )
  );

-- 4. Contar usuários por status
SELECT
  "subscriptionStatus",
  COUNT(*) as total
FROM users
WHERE "subscriptionId" IS NOT NULL
GROUP BY "subscriptionStatus"
ORDER BY total DESC;
