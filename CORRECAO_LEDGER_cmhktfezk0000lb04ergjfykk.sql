-- ============================================================================
-- SCRIPT DE CORREÇÃO DO LEDGER
-- Usuário: cmhktfezk0000lb04ergjfykk (lucasamoura@gmail.com)
-- Data: 25 de Janeiro de 2026
-- ============================================================================

-- PROBLEMA IDENTIFICADO:
-- - Saldo Ledger: 4745 créditos
-- - Saldo Real (User table): 3185 créditos
-- - Divergência: -1560 créditos (ledger inflado)
-- - Causa: Renovações mensais não registraram expiração dos créditos antigos

-- ============================================================================
-- PASSO 1: VALIDAÇÃO PRÉ-CORREÇÃO (EXECUTAR PRIMEIRO PARA CONFIRMAR)
-- ============================================================================

-- 1.1. Verificar estado atual do ledger vs. user table
SELECT
  'Antes da correção' as momento,
  (SELECT "balanceAfter" FROM credit_transactions WHERE "userId" = 'cmhktfezk0000lb04ergjfykk' ORDER BY "createdAt" DESC LIMIT 1) as balance_ledger,
  (SELECT ("creditsLimit" - "creditsUsed" + "creditsBalance") FROM users WHERE id = 'cmhktfezk0000lb04ergjfykk') as balance_usuario,
  ((SELECT "balanceAfter" FROM credit_transactions WHERE "userId" = 'cmhktfezk0000lb04ergjfykk' ORDER BY "createdAt" DESC LIMIT 1) - 
   (SELECT ("creditsLimit" - "creditsUsed" + "creditsBalance") FROM users WHERE id = 'cmhktfezk0000lb04ergjfykk')) as divergencia;

-- Resultado esperado:
-- balance_ledger: 4745
-- balance_usuario: 3185
-- divergencia: 1560

-- ============================================================================
-- PASSO 2: APLICAR CORREÇÃO (EXECUTAR APÓS VALIDAR PASSO 1)
-- ============================================================================

-- 2.1. Criar transação de ajuste NEGATIVO (remover 1560 créditos do ledger)
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
  'SPENT',  -- Tipo SPENT porque estamos REMOVENDO créditos
  'EXPIRATION',  -- Fonte EXPIRATION porque simula créditos que expiraram sem registro
  -1560,  -- Valor NEGATIVO (remove 1560 créditos)
  'Ajuste de reconciliação - correção de divergência no ledger (renovações sem registro de expiração)',
  (SELECT ("creditsLimit" - "creditsUsed" + "creditsBalance") FROM users WHERE id = 'cmhktfezk0000lb04ergjfykk'),
  jsonb_build_object(
    'type', 'manual_reconciliation',
    'reason', 'ledger_divergence_correction',
    'root_cause', 'monthly_renewals_without_expiration_records',
    'divergence_detected', 1560,
    'admin', 'system_fix',
    'date', NOW()::text,
    'before_balance_ledger', (SELECT "balanceAfter" FROM credit_transactions WHERE "userId" = 'cmhktfezk0000lb04ergjfykk' ORDER BY "createdAt" DESC LIMIT 1),
    'after_balance_user', (SELECT ("creditsLimit" - "creditsUsed" + "creditsBalance") FROM users WHERE id = 'cmhktfezk0000lb04ergjfykk'),
    'credits_removed', 1560,
    'note', 'Esta transação corrige o acúmulo de créditos de renovações anteriores que não foram expirados corretamente'
  ),
  NOW()
);

-- ============================================================================
-- PASSO 3: VALIDAÇÃO PÓS-CORREÇÃO (EXECUTAR IMEDIATAMENTE APÓS PASSO 2)
-- ============================================================================

-- 3.1. Verificar se a correção foi aplicada corretamente
SELECT
  'Após correção' as momento,
  (SELECT "balanceAfter" FROM credit_transactions WHERE "userId" = 'cmhktfezk0000lb04ergjfykk' ORDER BY "createdAt" DESC LIMIT 1) as balance_ledger,
  (SELECT ("creditsLimit" - "creditsUsed" + "creditsBalance") FROM users WHERE id = 'cmhktfezk0000lb04ergjfykk') as balance_usuario,
  ((SELECT "balanceAfter" FROM credit_transactions WHERE "userId" = 'cmhktfezk0000lb04ergjfykk' ORDER BY "createdAt" DESC LIMIT 1) - 
   (SELECT ("creditsLimit" - "creditsUsed" + "creditsBalance") FROM users WHERE id = 'cmhktfezk0000lb04ergjfykk')) as divergencia;

-- Resultado esperado:
-- balance_ledger: 3185
-- balance_usuario: 3185
-- divergencia: 0 ✅

-- 3.2. Verificar última transação criada
SELECT
  id,
  type,
  source,
  amount,
  "balanceAfter",
  description,
  metadata,
  "createdAt"
FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
ORDER BY "createdAt" DESC
LIMIT 1;

-- Resultado esperado:
-- type: SPENT
-- source: EXPIRATION
-- amount: -1560
-- balanceAfter: 3185
-- description: "Ajuste de reconciliação..."

-- 3.3. Validação tripla: Soma total do ledger
SELECT * FROM (
  SELECT
    'Soma de todas as transações' as metodo,
    SUM(amount) as saldo_calculado
  FROM credit_transactions
  WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
) AS soma
UNION ALL
SELECT * FROM (
  SELECT
    'Último balanceAfter' as metodo,
    "balanceAfter" as saldo_calculado
  FROM credit_transactions
  WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
  ORDER BY "createdAt" DESC
  LIMIT 1
) AS ultimo
UNION ALL
SELECT
  'Saldo User table' as metodo,
  ("creditsLimit" - "creditsUsed" + "creditsBalance") as saldo_calculado
FROM users
WHERE id = 'cmhktfezk0000lb04ergjfykk';

-- Resultado esperado (todos devem bater em 3185):
-- Soma de todas as transações: 3185 ✅
-- Último balanceAfter: 3185 ✅
-- Saldo User table: 3185 ✅

-- ============================================================================
-- PASSO 4: VERIFICAR /account/orders (FRONTEND)
-- ============================================================================

-- Após executar a correção, acessar a aplicação e verificar:
-- 1. URL: https://vibephoto.ai/account/orders
-- 2. Verificar que a última transação aparece:
--    - Tipo: "Expiração"
--    - Valor: -1560 créditos
--    - Descrição: "Ajuste de reconciliação..."
--    - Saldo após: 3185 créditos
-- 3. Verificar que o badge de créditos no header mostra: 3185 créditos

-- ============================================================================
-- ROLLBACK (APENAS SE NECESSÁRIO - NÃO EXECUTAR NORMALMENTE)
-- ============================================================================

/*
-- Se precisar desfazer a correção (APENAS PARA TESTES):
DELETE FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
  AND type = 'SPENT'
  AND source = 'EXPIRATION'
  AND amount = -1560
  AND description LIKE 'Ajuste de reconciliação%'
  AND "createdAt" > NOW() - INTERVAL '1 hour';

-- Depois de executar rollback, validar:
SELECT
  (SELECT "balanceAfter" FROM credit_transactions WHERE "userId" = 'cmhktfezk0000lb04ergjfykk' ORDER BY "createdAt" DESC LIMIT 1) as balance_ledger,
  (SELECT ("creditsLimit" - "creditsUsed" + "creditsBalance") FROM users WHERE id = 'cmhktfezk0000lb04ergjfykk') as balance_usuario;
-- Deve voltar para: balance_ledger=4745, balance_usuario=3185
*/

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================

-- 1. BACKUP: Este script NÃO modifica a tabela users, apenas adiciona uma
--    transação no ledger. É seguro executar.

-- 2. IDEMPOTÊNCIA: Se executar o PASSO 2 duas vezes por engano, haverá duas
--    transações de ajuste. Para evitar, sempre validar PASSO 3 antes de
--    executar PASSO 2 novamente.

-- 3. CAUSA RAIZ: Este ajuste é pontual. Para corrigir o problema de forma
--    permanente, é necessário implementar as correções no código:
--    - src/lib/db/subscriptions.ts (registrar expiração na renovação)
--    - Ver arquivo: ANALISE_SISTEMA_CREDITOS_LEDGER.md

-- 4. OUTROS USUÁRIOS: Este script é específico para o usuário
--    cmhktfezk0000lb04ergjfykk. Para corrigir outros usuários, é necessário:
--    - Executar DIAGNOSTICO_CREDITOS_LEDGER.sql (Query 10)
--    - Para cada usuário com divergência, adaptar este script

-- ============================================================================
-- FIM DO SCRIPT DE CORREÇÃO
-- ============================================================================
