-- Script V2 para calcular nextDueDate correto baseado em subscriptionStartedAt + ciclo de billing
-- Com verificação mais detalhada e retorno de resultados

-- PASSO 1: Verificar dados ANTES do update
SELECT '=== ANTES DO UPDATE ===' as status;

SELECT
  'Usuários ACTIVE com subscriptionId' as descricao,
  COUNT(*) as total
FROM users
WHERE
  "subscriptionStatus" = 'ACTIVE'
  AND "subscriptionId" IS NOT NULL;

SELECT
  'Usuários ACTIVE com subscriptionStartedAt' as descricao,
  COUNT(*) as total
FROM users
WHERE
  "subscriptionStatus" = 'ACTIVE'
  AND "subscriptionId" IS NOT NULL
  AND "subscriptionStartedAt" IS NOT NULL;

SELECT
  'Usuários ACTIVE com billingCycle definido' as descricao,
  COUNT(*) as total
FROM users
WHERE
  "subscriptionStatus" = 'ACTIVE'
  AND "subscriptionId" IS NOT NULL
  AND "billingCycle" IS NOT NULL;

-- PASSO 2: Mostrar usuários que SERÃO atualizados (MONTHLY)
SELECT '=== USUÁRIOS QUE SERÃO ATUALIZADOS (MONTHLY) ===' as status;

SELECT
  id,
  email,
  "subscriptionStartedAt",
  "nextDueDate" as next_due_date_atual,
  "subscriptionStartedAt" + INTERVAL '1 month' as next_due_date_novo
FROM users
WHERE
  "subscriptionStatus" = 'ACTIVE'
  AND "subscriptionStartedAt" IS NOT NULL
  AND "billingCycle" = 'MONTHLY'
  AND "subscriptionId" IS NOT NULL;

-- PASSO 3: Mostrar usuários que SERÃO atualizados (YEARLY)
SELECT '=== USUÁRIOS QUE SERÃO ATUALIZADOS (YEARLY) ===' as status;

SELECT
  id,
  email,
  "subscriptionStartedAt",
  "nextDueDate" as next_due_date_atual,
  "subscriptionStartedAt" + INTERVAL '1 year' as next_due_date_novo
FROM users
WHERE
  "subscriptionStatus" = 'ACTIVE'
  AND "subscriptionStartedAt" IS NOT NULL
  AND "billingCycle" = 'YEARLY'
  AND "subscriptionId" IS NOT NULL;

-- PASSO 4: EXECUTAR UPDATE para assinaturas MENSAIS
UPDATE users
SET "nextDueDate" = "subscriptionStartedAt" + INTERVAL '1 month'
WHERE
  "subscriptionStatus" = 'ACTIVE'
  AND "subscriptionStartedAt" IS NOT NULL
  AND "billingCycle" = 'MONTHLY'
  AND "subscriptionId" IS NOT NULL
RETURNING
  id,
  email,
  "subscriptionStartedAt",
  "nextDueDate",
  "billingCycle";

-- PASSO 5: EXECUTAR UPDATE para assinaturas ANUAIS
UPDATE users
SET "nextDueDate" = "subscriptionStartedAt" + INTERVAL '1 year'
WHERE
  "subscriptionStatus" = 'ACTIVE'
  AND "subscriptionStartedAt" IS NOT NULL
  AND "billingCycle" = 'YEARLY'
  AND "subscriptionId" IS NOT NULL
RETURNING
  id,
  email,
  "subscriptionStartedAt",
  "nextDueDate",
  "billingCycle";

-- PASSO 6: Verificar resultados DEPOIS do update
SELECT '=== DEPOIS DO UPDATE ===' as status;

SELECT
  id,
  email,
  plan,
  "billingCycle",
  "subscriptionStatus",
  "subscriptionStartedAt",
  "nextDueDate",
  "subscriptionEndsAt",
  -- Calcular diferença em dias
  CASE
    WHEN "billingCycle" = 'MONTHLY' THEN
      EXTRACT(DAY FROM ("nextDueDate" - "subscriptionStartedAt"))
    WHEN "billingCycle" = 'YEARLY' THEN
      EXTRACT(DAY FROM ("nextDueDate" - "subscriptionStartedAt"))
    ELSE NULL
  END as dias_diferenca
FROM users
WHERE
  "subscriptionStatus" = 'ACTIVE'
  AND "subscriptionId" IS NOT NULL
ORDER BY "subscriptionStartedAt" DESC;

-- PASSO 7: Verificar se há inconsistências
SELECT '=== VERIFICAR INCONSISTÊNCIAS ===' as status;

SELECT
  COUNT(*) as usuarios_com_inconsistencia
FROM users
WHERE
  "subscriptionStatus" = 'ACTIVE'
  AND "subscriptionStartedAt" IS NOT NULL
  AND "billingCycle" IS NOT NULL
  AND "subscriptionId" IS NOT NULL
  AND (
    "nextDueDate" IS NULL
    OR
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
