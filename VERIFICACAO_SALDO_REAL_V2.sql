-- ============================================================================
-- VERIFICAÇÃO URGENTE: Saldo real do usuário cmhktfezk0000lb04ergjfykk
-- Query simplificada e testada
-- ============================================================================

-- Badge no frontend mostra: 1845 créditos
-- Nossa query calculou: 3185 créditos
-- Precisamos confirmar qual está correto!

-- ============================================================================
-- QUERY 1: DADOS DO USUÁRIO
-- ============================================================================
SELECT
  id,
  email,
  name,
  plan,
  "subscriptionStatus",
  "creditsUsed",
  "creditsLimit",
  "creditsBalance",
  ("creditsLimit" - "creditsUsed" + "creditsBalance") as saldo_total
FROM users
WHERE id = 'cmhktfezk0000lb04ergjfykk';

-- ============================================================================
-- QUERY 2: ÚLTIMA TRANSAÇÃO DO LEDGER
-- ============================================================================
SELECT
  "balanceAfter",
  amount,
  type,
  source,
  description,
  "createdAt"
FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
ORDER BY "createdAt" DESC
LIMIT 1;

-- ============================================================================
-- QUERY 3: COMPARAÇÃO DOS 3 VALORES
-- ============================================================================
WITH user_data AS (
  SELECT
    ("creditsLimit" - "creditsUsed" + "creditsBalance") as saldo_user
  FROM users
  WHERE id = 'cmhktfezk0000lb04ergjfykk'
),
ledger_data AS (
  SELECT "balanceAfter" as saldo_ledger
  FROM credit_transactions
  WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
  ORDER BY "createdAt" DESC
  LIMIT 1
)
SELECT
  'Badge Frontend' as origem,
  1845 as valor
UNION ALL
SELECT
  'User Table' as origem,
  saldo_user as valor
FROM user_data
UNION ALL
SELECT
  'Ledger' as origem,
  saldo_ledger as valor
FROM ledger_data;
