-- Script para calcular nextDueDate correto baseado em subscriptionStartedAt + ciclo de billing
-- subscriptionEndsAt é usado APENAS para cancelamentos antecipados (antes do fim do mês vigente)

-- IMPORTANTE: Este script atualiza nextDueDate para usuários ACTIVE com subscriptionStartedAt preenchido

-- Para assinaturas MENSAIS (MONTHLY):
-- nextDueDate = subscriptionStartedAt + 1 mês
UPDATE users
SET "nextDueDate" = "subscriptionStartedAt" + INTERVAL '1 month'
WHERE
  "subscriptionStatus" = 'ACTIVE'
  AND "subscriptionStartedAt" IS NOT NULL
  AND "billingCycle" = 'MONTHLY'
  AND "subscriptionId" IS NOT NULL;

-- Para assinaturas ANUAIS (YEARLY):
-- nextDueDate = subscriptionStartedAt + 1 ano
UPDATE users
SET "nextDueDate" = "subscriptionStartedAt" + INTERVAL '1 year'
WHERE
  "subscriptionStatus" = 'ACTIVE'
  AND "subscriptionStartedAt" IS NOT NULL
  AND "billingCycle" = 'YEARLY'
  AND "subscriptionId" IS NOT NULL;

-- Verificar resultados
SELECT
  id,
  email,
  plan,
  "billingCycle",
  "subscriptionStatus",
  "subscriptionStartedAt",
  "nextDueDate",
  "subscriptionEndsAt",
  -- Calcular diferença em dias entre subscriptionStartedAt e nextDueDate
  EXTRACT(DAY FROM ("nextDueDate" - "subscriptionStartedAt")) as dias_ate_renovacao
FROM users
WHERE
  "subscriptionStatus" = 'ACTIVE'
  AND "subscriptionId" IS NOT NULL
ORDER BY "subscriptionStartedAt" DESC;

-- NOTA IMPORTANTE SOBRE subscriptionEndsAt:
-- subscriptionEndsAt deve ser usado APENAS quando:
-- 1. Usuário CANCELOU a assinatura mas ainda está dentro do período pago
-- 2. subscriptionStatus = 'ACTIVE' mas subscriptionCancelledAt IS NOT NULL
-- 3. Neste caso, subscriptionEndsAt = data fim do período vigente (quando acesso será bloqueado)
--
-- Para renovações automáticas normais, use SEMPRE nextDueDate
