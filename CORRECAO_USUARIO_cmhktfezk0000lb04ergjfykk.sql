-- =====================================================================
-- CORREÇÃO EMERGENCIAL: creditsExpiresAt em Plano MENSAL
-- =====================================================================
-- Usuário: cmhktfezk0000lb04ergjfykk (Lucas Aragao)
-- Data: 25/01/2026
-- Problema: creditsExpiresAt preenchido incorretamente para plano MONTHLY
-- Impacto: Badge mostrando 1845 ao invés de 3185 créditos
-- =====================================================================

-- =====================================================================
-- 1. PRÉ-VALIDAÇÃO: Estado atual
-- =====================================================================

-- 1.1. Dados do usuário ANTES da correção
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
  -- Cálculo manual do total
  (("creditsLimit" - "creditsUsed") + "creditsBalance") as total_calculado,
  -- Status de expiração
  CASE
    WHEN "creditsExpiresAt" IS NULL THEN 'SEM EXPIRAÇÃO (correto para mensal)'
    WHEN "creditsExpiresAt" < NOW() THEN 'EXPIRADO ❌'
    ELSE 'VÁLIDO ✅'
  END as status_expiracao
FROM users
WHERE id = 'cmhktfezk0000lb04ergjfykk';

-- Resultado esperado ANTES:
-- plan: PREMIUM
-- billingCycle: MONTHLY
-- creditsUsed: 160
-- creditsLimit: 1500
-- creditsBalance: 1845
-- creditsExpiresAt: 2026-01-07 ❌
-- total_calculado: 3185
-- status_expiracao: EXPIRADO ❌

-- =====================================================================
-- 2. APLICAR CORREÇÃO
-- =====================================================================

-- 2.1. Corrigir creditsExpiresAt (deve ser NULL para planos mensais)
UPDATE users
SET 
  "creditsExpiresAt" = NULL,
  -- Atualizar para simular que a renovação mensal ocorreu em 08/01/2026
  "lastCreditRenewalAt" = '2026-01-08 00:00:00'::timestamp,
  "updatedAt" = NOW()
WHERE id = 'cmhktfezk0000lb04ergjfykk';

-- ⚠️ NOTA: NÃO estamos resetando creditsUsed porque o usuário já usou 160 créditos
-- no ciclo atual (desde 08/12/2025). O reset só deve ocorrer na próxima renovação real.

-- =====================================================================
-- 3. PÓS-VALIDAÇÃO: Confirmar correção
-- =====================================================================

-- 3.1. Verificar estado APÓS correção
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
  -- Cálculo manual do total
  (("creditsLimit" - "creditsUsed") + "creditsBalance") as total_calculado,
  -- Status de expiração
  CASE
    WHEN "creditsExpiresAt" IS NULL THEN 'SEM EXPIRAÇÃO (correto para mensal) ✅'
    WHEN "creditsExpiresAt" < NOW() THEN 'EXPIRADO ❌'
    ELSE 'VÁLIDO ✅'
  END as status_expiracao
FROM users
WHERE id = 'cmhktfezk0000lb04ergjfykk';

-- Resultado esperado APÓS:
-- plan: PREMIUM
-- billingCycle: MONTHLY
-- creditsUsed: 160
-- creditsLimit: 1500
-- creditsBalance: 1845
-- creditsExpiresAt: NULL ✅
-- lastCreditRenewalAt: 2026-01-08 ✅
-- total_calculado: 3185 ✅
-- status_expiracao: SEM EXPIRAÇÃO (correto para mensal) ✅

-- =====================================================================
-- 4. CÁLCULO DETALHADO DO BADGE
-- =====================================================================

-- 4.1. Simular lógica do endpoint /api/credits/balance
SELECT
  id,
  email,
  -- Créditos da assinatura (disponíveis no ciclo atual)
  CASE
    WHEN "subscriptionStatus" = 'ACTIVE' AND "creditsLimit" > 0 THEN
      CASE
        -- ✅ APÓS CORREÇÃO: planos mensais não verificam creditsExpiresAt
        WHEN "billingCycle" = 'MONTHLY' THEN 
          GREATEST(0, "creditsLimit" - "creditsUsed")
        -- Para planos anuais, verificar expiração
        WHEN "billingCycle" = 'YEARLY' AND ("creditsExpiresAt" IS NULL OR "creditsExpiresAt" >= NOW()) THEN
          GREATEST(0, "creditsLimit" - "creditsUsed")
        ELSE 0
      END
    ELSE 0
  END as subscription_credits,
  
  -- Créditos comprados (sempre disponíveis)
  "creditsBalance" as purchased_credits,
  
  -- Total
  (
    CASE
      WHEN "subscriptionStatus" = 'ACTIVE' AND "creditsLimit" > 0 THEN
        CASE
          WHEN "billingCycle" = 'MONTHLY' THEN 
            GREATEST(0, "creditsLimit" - "creditsUsed")
          WHEN "billingCycle" = 'YEARLY' AND ("creditsExpiresAt" IS NULL OR "creditsExpiresAt" >= NOW()) THEN
            GREATEST(0, "creditsLimit" - "creditsUsed")
          ELSE 0
        END
      ELSE 0
    END
    + "creditsBalance"
  ) as total_credits

FROM users
WHERE id = 'cmhktfezk0000lb04ergjfykk';

-- Resultado esperado:
-- subscription_credits: 1340 (1500 - 160)
-- purchased_credits: 1845
-- total_credits: 3185 ✅

-- =====================================================================
-- 5. VERIFICAÇÃO NO LEDGER (credit_transactions)
-- =====================================================================

-- 5.1. Últimas transações do usuário
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
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
ORDER BY "createdAt" DESC
LIMIT 10;

-- 5.2. Verificar se balanceAfter bate com creditsBalance
SELECT
  u."creditsBalance" as saldo_na_tabela_users,
  (
    SELECT "balanceAfter"
    FROM credit_transactions
    WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
    ORDER BY "createdAt" DESC
    LIMIT 1
  ) as ultimo_balance_after,
  -- Divergência
  (
    u."creditsBalance" - COALESCE(
      (
        SELECT "balanceAfter"
        FROM credit_transactions
        WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
        ORDER BY "createdAt" DESC
        LIMIT 1
      ), 0
    )
  ) as divergencia
FROM users u
WHERE u.id = 'cmhktfezk0000lb04ergjfykk';

-- Se divergencia != 0, indica problema no ledger (não causado por este bug específico)

-- =====================================================================
-- 6. PRÓXIMOS PASSOS
-- =====================================================================

-- ✅ 6.1. Testar API /api/credits/balance no console do browser:
--    fetch('/api/credits/balance', { credentials: 'include' })
--      .then(r => r.json())
--      .then(d => console.log('Badge:', d));
--    Resultado esperado: { subscriptionCredits: 1340, purchasedCredits: 1845, totalCredits: 3185 }

-- ✅ 6.2. Hard refresh no app → Badge deve mostrar 3185

-- ✅ 6.3. Se o badge ainda mostrar 1845:
--    - Executar: fetch('/api/credits/invalidate-cache', { method: 'POST', credentials: 'include' })
--    - Hard refresh novamente

-- ✅ 6.4. Aplicar correção sistêmica no código:
--    - src/lib/services/credit-package-service.ts (adicionar verificação de billingCycle)
--    - src/lib/db/subscriptions.ts (garantir que creditsExpiresAt = NULL para mensais)

-- ✅ 6.5. Após validar neste usuário, executar migração em massa:
--    UPDATE users
--    SET "creditsExpiresAt" = NULL
--    WHERE "billingCycle" = 'MONTHLY' AND "creditsExpiresAt" IS NOT NULL;
