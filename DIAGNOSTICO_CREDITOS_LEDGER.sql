-- ============================================================================
-- DIAGNÓSTICO COMPLETO DO SISTEMA DE CRÉDITOS E LEDGER
-- Data: 25 de Janeiro de 2026
-- ============================================================================

-- Usuário de teste: cmhktfezk0000lb04ergjfykk

-- ============================================================================
-- 1. DADOS DO USUÁRIO (Campos de créditos)
-- ============================================================================
SELECT
  id,
  email,
  name,
  plan,
  "subscriptionStatus",
  "creditsUsed",      -- Créditos já usados do plano mensal
  "creditsLimit",     -- Limite de créditos do plano mensal
  "creditsBalance",   -- Créditos avulsos comprados (não do plano)
  -- Saldo total disponível = (creditsLimit - creditsUsed) + creditsBalance
  ("creditsLimit" - "creditsUsed" + "creditsBalance") as saldo_total_disponivel,
  "subscriptionStartedAt",
  "lastCreditRenewalAt",
  "creditsExpiresAt",
  "createdAt",
  "updatedAt"
FROM users
WHERE id = 'cmhktfezk0000lb04ergjfykk';

-- ============================================================================
-- 2. TODAS AS TRANSAÇÕES DE CRÉDITO (Ledger /account/orders)
-- ============================================================================
SELECT
  id,
  type,        -- EARNED, SPENT, EXPIRED, REFUNDED
  source,      -- SUBSCRIPTION, PURCHASE, GENERATION, TRAINING, EDIT, VIDEO, etc
  amount,      -- Positivo = entrada, Negativo = saída
  "balanceAfter",  -- Saldo APÓS esta transação
  description,
  "referenceId",
  "creditPurchaseId",
  metadata,
  "createdAt"
FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
ORDER BY "createdAt" ASC;

-- ============================================================================
-- 3. COMPARAÇÃO: Saldo Calculado (Ledger) vs. Saldo Real (User Table)
-- ============================================================================
WITH ledger_balance AS (
  SELECT SUM(amount) as saldo_calculado_ledger
  FROM credit_transactions
  WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
),
user_balance AS (
  SELECT
    ("creditsLimit" - "creditsUsed" + "creditsBalance") as saldo_atual_usuario,
    "creditsLimit",
    "creditsUsed",
    "creditsBalance"
  FROM users
  WHERE id = 'cmhktfezk0000lb04ergjfykk'
)
SELECT
  l.saldo_calculado_ledger,
  u.saldo_atual_usuario,
  (l.saldo_calculado_ledger - u.saldo_atual_usuario) as divergencia,
  CASE
    WHEN (l.saldo_calculado_ledger - u.saldo_atual_usuario) = 0 THEN '✅ Saldos batem'
    WHEN (l.saldo_calculado_ledger - u.saldo_atual_usuario) != 0 THEN '❌ DIVERGÊNCIA DETECTADA'
    WHEN l.saldo_calculado_ledger IS NULL THEN '⚠️ Nenhuma transação no ledger'
  END as status,
  u."creditsLimit" as limite_plano,
  u."creditsUsed" as usado_plano,
  u."creditsBalance" as creditos_avulsos
FROM ledger_balance l, user_balance u;

-- ============================================================================
-- 4. RESUMO DE TRANSAÇÕES POR TIPO E FONTE
-- ============================================================================
SELECT
  type,
  source,
  COUNT(*) as total_transacoes,
  SUM(amount) as soma_total,
  MIN("createdAt") as primeira_transacao,
  MAX("createdAt") as ultima_transacao
FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
GROUP BY type, source
ORDER BY type, source;

-- ============================================================================
-- 5. ÚLTIMA TRANSAÇÃO (Para verificar balanceAfter)
-- ============================================================================
SELECT
  id,
  type,
  source,
  amount,
  "balanceAfter" as saldo_apos_ultima_transacao,
  description,
  "createdAt"
FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
ORDER BY "createdAt" DESC
LIMIT 1;

-- ============================================================================
-- 6. PAGAMENTOS RELACIONADOS (Para verificar renovações)
-- ============================================================================
SELECT
  id,
  type,       -- SUBSCRIPTION, CREDIT_PURCHASE
  status,
  value,
  description,
  "planType",
  "billingCycle",
  "creditAmount",
  "dueDate",
  "confirmedDate",
  "createdAt"
FROM payments
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
ORDER BY "createdAt" DESC;

-- ============================================================================
-- 7. COMPRAS DE CRÉDITOS AVULSOS
-- ============================================================================
SELECT
  id,
  "packageName",
  "creditAmount",
  "bonusCredits",
  value,
  status,
  "usedCredits",
  "validUntil",
  "isExpired",
  "purchasedAt",
  "confirmedAt"
FROM credit_purchases
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
ORDER BY "purchasedAt" DESC;

-- ============================================================================
-- 8. VERIFICAR SE HÁ TRANSAÇÕES "ÓRFÃS" (sem lastTransaction anterior)
-- ============================================================================
-- Verificar se há saltos no balanceAfter que indicam inconsistência
WITH transacoes_ordenadas AS (
  SELECT
    id,
    type,
    source,
    amount,
    "balanceAfter",
    LAG("balanceAfter", 1) OVER (ORDER BY "createdAt") as balance_anterior,
    "createdAt"
  FROM credit_transactions
  WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
)
SELECT
  id,
  type,
  source,
  amount,
  "balanceAfter",
  balance_anterior,
  (balance_anterior + amount) as esperado_balanceAfter,
  ("balanceAfter" - (balance_anterior + amount)) as diferenca,
  CASE
    WHEN balance_anterior IS NULL THEN '⚠️ Primeira transação'
    WHEN ("balanceAfter" - (balance_anterior + amount)) = 0 THEN '✅ OK'
    ELSE '❌ SALTO DETECTADO'
  END as status,
  "createdAt"
FROM transacoes_ordenadas
ORDER BY "createdAt" ASC;

-- ============================================================================
-- 9. DIAGNÓSTICO GLOBAL: Usuários sem registros no ledger
-- ============================================================================
-- Verificar quantos usuários têm assinaturas ativas mas NENHUMA transação
SELECT
  u.id,
  u.email,
  u.plan,
  u."subscriptionStatus",
  u."creditsLimit",
  u."creditsUsed",
  u."creditsBalance",
  (u."creditsLimit" - u."creditsUsed" + u."creditsBalance") as saldo_total,
  COUNT(ct.id) as total_transacoes
FROM users u
LEFT JOIN credit_transactions ct ON ct."userId" = u.id
WHERE u."subscriptionStatus" = 'ACTIVE'
  AND u.plan IS NOT NULL
GROUP BY u.id, u.email, u.plan, u."subscriptionStatus", u."creditsLimit", u."creditsUsed", u."creditsBalance"
HAVING COUNT(ct.id) = 0
ORDER BY u."createdAt" DESC
LIMIT 20;

-- ============================================================================
-- 10. DIAGNÓSTICO GLOBAL: Divergências em massa
-- ============================================================================
-- Verificar usuários onde o saldo do ledger NÃO bate com o saldo da tabela users
WITH ledger_balances AS (
  SELECT
    "userId",
    SUM(amount) as saldo_ledger,
    COUNT(*) as total_transacoes,
    MAX("balanceAfter") as ultimo_balance_after
  FROM credit_transactions
  GROUP BY "userId"
),
user_balances AS (
  SELECT
    id as "userId",
    ("creditsLimit" - "creditsUsed" + "creditsBalance") as saldo_usuario,
    "creditsLimit",
    "creditsUsed",
    "creditsBalance",
    email
  FROM users
  WHERE plan IS NOT NULL
)
SELECT
  ub."userId",
  ub.email,
  ub.saldo_usuario,
  lb.saldo_ledger,
  lb.ultimo_balance_after,
  (ub.saldo_usuario - lb.ultimo_balance_after) as divergencia_vs_ultimo_balance,
  (lb.saldo_ledger - ub.saldo_usuario) as divergencia_soma_vs_usuario,
  lb.total_transacoes,
  CASE
    WHEN lb.saldo_ledger IS NULL THEN '⚠️ Sem transações no ledger'
    WHEN (ub.saldo_usuario - lb.ultimo_balance_after) = 0 THEN '✅ OK'
    ELSE '❌ DIVERGÊNCIA'
  END as status
FROM user_balances ub
LEFT JOIN ledger_balances lb ON lb."userId" = ub."userId"
WHERE
  -- Filtrar apenas divergências ou casos sem transações
  (lb.saldo_ledger IS NULL OR (ub.saldo_usuario - lb.ultimo_balance_after) != 0)
ORDER BY lb.total_transacoes DESC NULLS LAST, divergencia_vs_ultimo_balance DESC
LIMIT 50;

-- ============================================================================
-- 11. SCRIPT DE RECONCILIAÇÃO PARA UM USUÁRIO ESPECÍFICO
-- ============================================================================
-- ATENÇÃO: NÃO EXECUTAR SEM REVISAR OS DADOS PRIMEIRO!
-- Este script deve ser usado APENAS após validar o diagnóstico acima.

/*
-- Passo 1: Verificar última transação
WITH ultima_transacao AS (
  SELECT "balanceAfter"
  FROM credit_transactions
  WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
  ORDER BY "createdAt" DESC
  LIMIT 1
),
saldo_atual AS (
  SELECT ("creditsLimit" - "creditsUsed" + "creditsBalance") as saldo
  FROM users
  WHERE id = 'cmhktfezk0000lb04ergjfykk'
)
SELECT
  ut."balanceAfter" as saldo_ledger,
  sa.saldo as saldo_usuario,
  (sa.saldo - ut."balanceAfter") as ajuste_necessario
FROM ultima_transacao ut, saldo_atual sa;

-- Passo 2: Se houver divergência, criar transação de ajuste
-- EXEMPLO (AJUSTAR VALORES CONFORME NECESSÁRIO):
/*
INSERT INTO credit_transactions (
  id,
  "userId",
  type,
  source,
  amount,
  description,
  "balanceAfter",
  metadata,
  "createdAt"
) VALUES (
  gen_random_uuid(),
  'cmhktfezk0000lb04ergjfykk',
  'EARNED',  -- ou 'SPENT' se for ajuste negativo
  'BONUS',
  50,  -- AJUSTAR VALOR (positivo para adicionar, negativo para remover)
  'Ajuste de reconciliação - correção de divergência no ledger',
  (SELECT ("creditsLimit" - "creditsUsed" + "creditsBalance") FROM users WHERE id = 'cmhktfezk0000lb04ergjfykk'),
  '{"reason": "reconciliation", "admin": "manual_fix", "date": "2026-01-25"}'::jsonb,
  NOW()
);
*/

-- Passo 3: Validar após ajuste
/*
SELECT
  (SELECT SUM(amount) FROM credit_transactions WHERE "userId" = 'cmhktfezk0000lb04ergjfykk') as saldo_ledger,
  (SELECT ("creditsLimit" - "creditsUsed" + "creditsBalance") FROM users WHERE id = 'cmhktfezk0000lb04ergjfykk') as saldo_usuario,
  (SELECT "balanceAfter" FROM credit_transactions WHERE "userId" = 'cmhktfezk0000lb04ergjfykk' ORDER BY "createdAt" DESC LIMIT 1) as ultimo_balance_after;
*/
*/

-- ============================================================================
-- FIM DO DIAGNÓSTICO
-- ============================================================================
