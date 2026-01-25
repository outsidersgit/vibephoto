-- ============================================================================
-- DIAGNÓSTICO DETALHADO: cmhktfezk0000lb04ergjfykk (lucasamoura@gmail.com)
-- ============================================================================
-- Divergência detectada: -315 créditos
-- Saldo User Table: 3185 | Saldo Ledger: 3745
-- Total de transações: 560

-- ============================================================================
-- 1. DADOS ATUAIS DO USUÁRIO
-- ============================================================================
SELECT
  id,
  email,
  name,
  plan,
  "subscriptionStatus",
  "billingCycle",
  "creditsUsed",
  "creditsLimit",
  "creditsBalance",
  ("creditsLimit" - "creditsUsed" + "creditsBalance") as saldo_calculado,
  "subscriptionStartedAt",
  "lastCreditRenewalAt",
  "creditsExpiresAt",
  "createdAt"
FROM users
WHERE id = 'cmhktfezk0000lb04ergjfykk';

-- ============================================================================
-- 2. ÚLTIMAS 20 TRANSAÇÕES (mais recentes)
-- ============================================================================
SELECT
  id,
  type,
  source,
  amount,
  "balanceAfter",
  description,
  "createdAt"
FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
ORDER BY "createdAt" DESC
LIMIT 20;

-- ============================================================================
-- 3. PRIMEIRAS 20 TRANSAÇÕES (mais antigas)
-- ============================================================================
SELECT
  id,
  type,
  source,
  amount,
  "balanceAfter",
  description,
  "createdAt"
FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
ORDER BY "createdAt" ASC
LIMIT 20;

-- ============================================================================
-- 4. TODAS AS TRANSAÇÕES DE RENOVAÇÃO (EARNED + SUBSCRIPTION)
-- ============================================================================
SELECT
  id,
  amount,
  "balanceAfter",
  description,
  metadata,
  "createdAt"
FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
  AND type = 'EARNED'
  AND source = 'SUBSCRIPTION'
ORDER BY "createdAt" ASC;

-- ============================================================================
-- 5. VERIFICAR SE HÁ TRANSAÇÕES DE EXPIRAÇÃO
-- ============================================================================
SELECT
  COUNT(*) as total_expiracoes,
  SUM(amount) as total_creditos_expirados
FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
  AND type = 'EXPIRED';

-- ============================================================================
-- 6. RESUMO POR TIPO DE TRANSAÇÃO
-- ============================================================================
SELECT
  type,
  source,
  COUNT(*) as quantidade,
  SUM(amount) as soma_total
FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
GROUP BY type, source
ORDER BY type, source;

-- ============================================================================
-- 7. DETECTAR SALTOS NO LEDGER (inconsistências)
-- ============================================================================
WITH transacoes_com_lag AS (
  SELECT
    id,
    type,
    source,
    amount,
    "balanceAfter",
    LAG("balanceAfter") OVER (ORDER BY "createdAt") as balance_anterior,
    "createdAt"
  FROM credit_transactions
  WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
)
SELECT
  id,
  type,
  source,
  amount,
  balance_anterior,
  "balanceAfter",
  (balance_anterior + amount) as esperado,
  ("balanceAfter" - (balance_anterior + amount)) as diferenca,
  CASE
    WHEN balance_anterior IS NULL THEN '⚠️ Primeira transação'
    WHEN ("balanceAfter" - (balance_anterior + amount)) = 0 THEN '✅ OK'
    ELSE '❌ SALTO DETECTADO'
  END as status,
  "createdAt"
FROM transacoes_com_lag
WHERE
  -- Mostrar apenas saltos (diferença != 0)
  balance_anterior IS NOT NULL
  AND ("balanceAfter" - (balance_anterior + amount)) != 0
ORDER BY "createdAt" ASC;

-- ============================================================================
-- 8. CALCULAR O AJUSTE NECESSÁRIO
-- ============================================================================
WITH ultima_transacao AS (
  SELECT "balanceAfter"
  FROM credit_transactions
  WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
  ORDER BY "createdAt" DESC
  LIMIT 1
),
saldo_atual AS (
  SELECT
    ("creditsLimit" - "creditsUsed" + "creditsBalance") as saldo,
    "creditsLimit",
    "creditsUsed",
    "creditsBalance"
  FROM users
  WHERE id = 'cmhktfezk0000lb04ergjfykk'
)
SELECT
  ut."balanceAfter" as saldo_ledger,
  sa.saldo as saldo_usuario,
  sa."creditsLimit",
  sa."creditsUsed",
  sa."creditsBalance",
  (sa.saldo - ut."balanceAfter") as ajuste_necessario,
  CASE
    WHEN (sa.saldo - ut."balanceAfter") > 0 THEN 'EARNED'
    WHEN (sa.saldo - ut."balanceAfter") < 0 THEN 'SPENT'
    ELSE 'OK'
  END as tipo_ajuste,
  ABS(sa.saldo - ut."balanceAfter") as valor_absoluto_ajuste
FROM ultima_transacao ut, saldo_atual sa;

-- ============================================================================
-- 9. HISTÓRICO DE PAGAMENTOS (verificar renovações)
-- ============================================================================
SELECT
  id,
  type,
  status,
  value,
  "planType",
  "billingCycle",
  description,
  "dueDate",
  "confirmedDate",
  "createdAt"
FROM payments
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
  AND type = 'SUBSCRIPTION'
  AND status = 'CONFIRMED'
ORDER BY "confirmedDate" DESC;

-- ============================================================================
-- 10. VERIFICAR SE HÁ COMPRAS DE CRÉDITOS AVULSOS
-- ============================================================================
SELECT
  id,
  "packageName",
  "creditAmount",
  "bonusCredits",
  value,
  status,
  "confirmedAt"
FROM credit_purchases
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
  AND status = 'CONFIRMED'
ORDER BY "confirmedAt" DESC;

-- ============================================================================
-- 11. PROPOSTA DE SCRIPT DE CORREÇÃO (NÃO EXECUTAR AINDA)
-- ============================================================================
-- ATENÇÃO: Executar APENAS após analisar todos os resultados acima!

/*
-- PASSO 1: Verificar ajuste necessário (já calculado na query 8)

-- PASSO 2: Criar transação de ajuste
-- SUBSTITUIR <VALOR_AJUSTE> pelo resultado da query 8 (campo "valor_absoluto_ajuste")
-- SUBSTITUIR <TIPO_AJUSTE> por "EARNED" ou "SPENT" (campo "tipo_ajuste")

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
  '<TIPO_AJUSTE>',  -- EARNED (se positivo) ou SPENT (se negativo)
  'BONUS',
  <VALOR_AJUSTE>,  -- Valor POSITIVO se EARNED, NEGATIVO se SPENT
  'Ajuste de reconciliação - correção de divergência detectada em 25/01/2026',
  (SELECT ("creditsLimit" - "creditsUsed" + "creditsBalance") FROM users WHERE id = 'cmhktfezk0000lb04ergjfykk'),
  jsonb_build_object(
    'type', 'manual_reconciliation',
    'reason', 'ledger_divergence_correction',
    'divergence_detected', -315,
    'admin', 'system_fix',
    'date', NOW()::text,
    'before_balance_ledger', (SELECT "balanceAfter" FROM credit_transactions WHERE "userId" = 'cmhktfezk0000lb04ergjfykk' ORDER BY "createdAt" DESC LIMIT 1),
    'after_balance_user', (SELECT ("creditsLimit" - "creditsUsed" + "creditsBalance") FROM users WHERE id = 'cmhktfezk0000lb04ergjfykk')
  ),
  NOW()
);

-- PASSO 3: Validar correção
SELECT
  'Soma do ledger' as tipo,
  SUM(amount) as valor
FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
UNION ALL
SELECT
  'Último balanceAfter' as tipo,
  "balanceAfter" as valor
FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
ORDER BY "createdAt" DESC
LIMIT 1
UNION ALL
SELECT
  'Saldo User table' as tipo,
  ("creditsLimit" - "creditsUsed" + "creditsBalance") as valor
FROM users
WHERE id = 'cmhktfezk0000lb04ergjfykk';
*/

-- ============================================================================
-- FIM DO DIAGNÓSTICO DETALHADO
-- ============================================================================
