-- =====================================================================
-- DIAGNÓSTICO: Usuário sem Orders mas com créditos funcionando
-- =====================================================================
-- Usuário: cmf3555br0004qjk80pe9dhqr
-- Problema: Página /account/orders vazia
-- Observação: Badge de créditos funciona corretamente
-- =====================================================================

-- =====================================================================
-- 1. DADOS DO USUÁRIO
-- =====================================================================

-- 1.1. Informações básicas e créditos
SELECT
  id,
  email,
  name,
  plan,
  "billingCycle",
  "subscriptionStatus",
  "creditsUsed",
  "creditsLimit",
  "creditsBalance",
  "creditsExpiresAt",
  "lastCreditRenewalAt",
  "subscriptionStartedAt",
  "createdAt",
  -- Cálculo do total
  (("creditsLimit" - "creditsUsed") + "creditsBalance") as total_calculado
FROM users
WHERE id = 'cmf3555br0004qjk80pe9dhqr';

-- Resultado esperado:
-- creditsUsed: ?
-- creditsLimit: ?
-- creditsBalance: 350 (adicionado via admin)
-- total_calculado: 690 + 350 = 1040

-- =====================================================================
-- 2. VERIFICAR LEDGER (credit_transactions)
-- =====================================================================

-- 2.1. Contar transações
SELECT COUNT(*) as total_transacoes
FROM credit_transactions
WHERE "userId" = 'cmf3555br0004qjk80pe9dhqr';

-- Se retornar 0 → CONFIRMA que o ledger está vazio

-- 2.2. Listar todas as transações (se houver)
SELECT
  id,
  "userId",
  type,
  source,
  amount,
  "balanceAfter",
  description,
  "createdAt"
FROM credit_transactions
WHERE "userId" = 'cmf3555br0004qjk80pe9dhqr'
ORDER BY "createdAt" DESC;

-- =====================================================================
-- 3. VERIFICAR COMPRAS DE CRÉDITOS (credit_purchases)
-- =====================================================================

-- 3.1. Verificar se há compras registradas
SELECT
  id,
  "userId",
  "creditAmount",
  "usedCredits",
  status,
  "validUntil",
  "createdAt"
FROM credit_purchases
WHERE "userId" = 'cmf3555br0004qjk80pe9dhqr'
ORDER BY "createdAt" DESC;

-- =====================================================================
-- 4. VERIFICAR PAYMENTS (histórico de pagamentos)
-- =====================================================================

-- 4.1. Listar pagamentos
SELECT
  id,
  "userId",
  type,
  status,
  amount,
  "asaasPaymentId",
  "createdAt"
FROM payments
WHERE "userId" = 'cmf3555br0004qjk80pe9dhqr'
ORDER BY "createdAt" DESC;

-- =====================================================================
-- 5. VERIFICAR GERAÇÕES (generations)
-- =====================================================================

-- 5.1. Verificar se o usuário gerou imagens
SELECT
  COUNT(*) as total_geracoes,
  SUM(
    CASE 
      WHEN status = 'completed' THEN 1 
      ELSE 0 
    END
  ) as geracoes_completas,
  SUM(
    CASE 
      WHEN "estimatedCost" IS NOT NULL THEN "estimatedCost"
      ELSE 0
    END
  ) as total_creditos_gastos_estimado
FROM generations
WHERE "userId" = 'cmf3555br0004qjk80pe9dhqr';

-- 5.2. Últimas 5 gerações
SELECT
  id,
  "modelId",
  prompt,
  status,
  "estimatedCost",
  "createdAt"
FROM generations
WHERE "userId" = 'cmf3555br0004qjk80pe9dhqr'
ORDER BY "createdAt" DESC
LIMIT 5;

-- =====================================================================
-- 6. VERIFICAR ASSINATURA (subscriptionId)
-- =====================================================================

-- 6.1. Verificar se há subscriptionId
SELECT
  id,
  email,
  "subscriptionId",
  "subscriptionStatus",
  "subscriptionStartedAt",
  "nextDueDate"
FROM users
WHERE id = 'cmf3555br0004qjk80pe9dhqr';

-- =====================================================================
-- 7. ANÁLISE: POR QUE O LEDGER ESTÁ VAZIO?
-- =====================================================================

-- Hipóteses:
-- 1. Usuário criado ANTES da implementação do ledger
-- 2. Créditos adicionados via admin SEM registrar transação
-- 3. Assinatura ativada sem chamar a função de registro no ledger
-- 4. Bug na função de ativação de assinatura

-- =====================================================================
-- 8. COMPARAÇÃO: LEDGER vs SALDO CALCULADO
-- =====================================================================

-- 8.1. Saldo no ledger vs saldo na tabela users
SELECT
  u.id,
  u.email,
  u."creditsBalance" as saldo_na_tabela_users,
  (
    SELECT "balanceAfter"
    FROM credit_transactions
    WHERE "userId" = 'cmf3555br0004qjk80pe9dhqr'
    ORDER BY "createdAt" DESC
    LIMIT 1
  ) as ultimo_balance_after,
  (
    SELECT SUM(amount)
    FROM credit_transactions
    WHERE "userId" = 'cmf3555br0004qjk80pe9dhqr'
  ) as soma_amount_ledger,
  -- Divergências
  (
    u."creditsBalance" - COALESCE(
      (
        SELECT "balanceAfter"
        FROM credit_transactions
        WHERE "userId" = 'cmf3555br0004qjk80pe9dhqr'
        ORDER BY "createdAt" DESC
        LIMIT 1
      ), 0
    )
  ) as divergencia_balance_after,
  (
    u."creditsBalance" - COALESCE(
      (
        SELECT SUM(amount)
        FROM credit_transactions
        WHERE "userId" = 'cmf3555br0004qjk80pe9dhqr'
      ), 0
    )
  ) as divergencia_sum_amount
FROM users u
WHERE u.id = 'cmf3555br0004qjk80pe9dhqr';

-- =====================================================================
-- 9. CONCLUSÃO ESPERADA
-- =====================================================================

-- Se credit_transactions estiver vazio:
-- ✅ Badge funciona porque lê de users.creditsBalance
-- ❌ /account/orders vazio porque não há transações para exibir
-- 🔧 Solução: criar transações iniciais (MIGRATION SCRIPT)

-- =====================================================================
-- 10. PRÓXIMOS PASSOS (se ledger estiver vazio)
-- =====================================================================

-- 10.1. Criar transação inicial de ativação de assinatura
-- (Executar APÓS confirmar que o ledger está vazio)

-- INSERT INTO credit_transactions (
--   id,
--   "userId",
--   type,
--   source,
--   amount,
--   "balanceAfter",
--   description,
--   "createdAt",
--   "updatedAt"
-- ) VALUES (
--   gen_random_uuid(),
--   'cmf3555br0004qjk80pe9dhqr',
--   'RENEWED',
--   'SUBSCRIPTION',
--   0,  -- Não sabemos o valor inicial da assinatura
--   0,  -- Será ajustado no próximo INSERT
--   'Migração: Registro inicial de créditos da assinatura',
--   (SELECT "subscriptionStartedAt" FROM users WHERE id = 'cmf3555br0004qjk80pe9dhqr'),
--   NOW()
-- );

-- 10.2. Criar transação de créditos adicionados via admin
-- INSERT INTO credit_transactions (
--   id,
--   "userId",
--   type,
--   source,
--   amount,
--   "balanceAfter",
--   description,
--   "createdAt",
--   "updatedAt"
-- ) VALUES (
--   gen_random_uuid(),
--   'cmf3555br0004qjk80pe9dhqr',
--   'ADMIN_GRANT',
--   'ADMIN',
--   350,
--   (SELECT "creditsBalance" FROM users WHERE id = 'cmf3555br0004qjk80pe9dhqr'),
--   'Créditos adicionados pelo administrador',
--   NOW(),
--   NOW()
-- );
