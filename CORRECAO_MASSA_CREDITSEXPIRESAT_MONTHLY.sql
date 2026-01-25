-- =====================================================================
-- CORREÇÃO EM MASSA: creditsExpiresAt em Planos MENSAIS
-- =====================================================================
-- Problema: Usuários com billingCycle = MONTHLY têm creditsExpiresAt preenchido
-- Impacto: Badge de créditos vai zerar quando a data expirar
-- Solução: Setar creditsExpiresAt = NULL para todos os planos mensais
-- =====================================================================

-- =====================================================================
-- 1. PRÉ-VALIDAÇÃO: Listar usuários afetados
-- =====================================================================

-- 1.1. Contar quantos usuários serão corrigidos
SELECT COUNT(*) as total_usuarios_afetados
FROM users
WHERE 
  "billingCycle" = 'MONTHLY' 
  AND "creditsExpiresAt" IS NOT NULL;

-- Resultado esperado: ~7-10 usuários

-- 1.2. Listar usuários que serão corrigidos (para auditoria)
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
  -- Cálculo do total
  (("creditsLimit" - "creditsUsed") + "creditsBalance") as total_calculado,
  -- Status de expiração
  CASE
    WHEN "creditsExpiresAt" < NOW() THEN 'JÁ EXPIROU ⚠️'
    WHEN "creditsExpiresAt" < NOW() + INTERVAL '7 days' THEN 'EXPIRA EM < 7 DIAS ⚠️'
    WHEN "creditsExpiresAt" < NOW() + INTERVAL '30 days' THEN 'EXPIRA EM < 30 DIAS ⚠️'
    ELSE 'EXPIRA EM > 30 DIAS'
  END as alerta_expiracao
FROM users
WHERE 
  "billingCycle" = 'MONTHLY' 
  AND "creditsExpiresAt" IS NOT NULL
ORDER BY "creditsExpiresAt" ASC;

-- =====================================================================
-- 2. BACKUP DE SEGURANÇA (OPCIONAL MAS RECOMENDADO)
-- =====================================================================

-- 2.1. Criar tabela temporária com backup dos dados
CREATE TEMP TABLE backup_users_credits_expires_at AS
SELECT 
  id,
  email,
  "creditsExpiresAt",
  NOW() as backup_timestamp
FROM users
WHERE 
  "billingCycle" = 'MONTHLY' 
  AND "creditsExpiresAt" IS NOT NULL;

-- 2.2. Confirmar backup
SELECT COUNT(*) as total_backup
FROM backup_users_credits_expires_at;

-- =====================================================================
-- 3. APLICAR CORREÇÃO EM MASSA
-- =====================================================================

-- 3.1. CRÍTICO: Setar creditsExpiresAt = NULL para planos MONTHLY
UPDATE users
SET 
  "creditsExpiresAt" = NULL,
  "updatedAt" = NOW()
WHERE 
  "billingCycle" = 'MONTHLY' 
  AND "creditsExpiresAt" IS NOT NULL;

-- ⚠️ ATENÇÃO: Esta correção afeta TODOS os usuários com plano mensal!

-- =====================================================================
-- 4. PÓS-VALIDAÇÃO: Confirmar correção
-- =====================================================================

-- 4.1. Verificar se ainda há usuários com o problema
SELECT COUNT(*) as usuarios_ainda_com_problema
FROM users
WHERE 
  "billingCycle" = 'MONTHLY' 
  AND "creditsExpiresAt" IS NOT NULL;

-- Resultado esperado: 0 ✅

-- 4.2. Listar usuários corrigidos
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
  (("creditsLimit" - "creditsUsed") + "creditsBalance") as total_calculado
FROM users
WHERE 
  "billingCycle" = 'MONTHLY' 
  AND "subscriptionStatus" = 'ACTIVE'
  AND plan IS NOT NULL
ORDER BY "createdAt" DESC
LIMIT 10;

-- Resultado esperado: creditsExpiresAt = NULL para todos ✅

-- =====================================================================
-- 5. VERIFICAR SE HÁ PLANOS ANUAIS COM PROBLEMA OPOSTO
-- =====================================================================

-- 5.1. Verificar planos ANUAIS sem creditsExpiresAt
SELECT
  id,
  email,
  name,
  plan,
  "billingCycle",
  "subscriptionStatus",
  "creditsExpiresAt",
  "subscriptionStartedAt"
FROM users
WHERE 
  "billingCycle" = 'YEARLY' 
  AND "creditsExpiresAt" IS NULL
  AND "subscriptionStatus" = 'ACTIVE';

-- Se retornar algum resultado, esses usuários precisam ter creditsExpiresAt preenchido!

-- =====================================================================
-- 6. ESTATÍSTICAS FINAIS
-- =====================================================================

-- 6.1. Resumo geral de planos por billingCycle
SELECT
  "billingCycle",
  COUNT(*) as total_usuarios,
  SUM(CASE WHEN "creditsExpiresAt" IS NULL THEN 1 ELSE 0 END) as sem_expiracao,
  SUM(CASE WHEN "creditsExpiresAt" IS NOT NULL THEN 1 ELSE 0 END) as com_expiracao,
  -- Esperado:
  -- MONTHLY: todos sem_expiracao
  -- YEARLY: todos com_expiracao
  -- NULL: todos sem_expiracao (parceiros)
  CASE
    WHEN "billingCycle" = 'MONTHLY' THEN 'Esperado: 100% sem expiração'
    WHEN "billingCycle" = 'YEARLY' THEN 'Esperado: 100% com expiração'
    WHEN "billingCycle" IS NULL THEN 'Esperado: 100% sem expiração (parceiros)'
    ELSE 'Desconhecido'
  END as status_esperado
FROM users
WHERE 
  "subscriptionStatus" = 'ACTIVE'
  AND plan IS NOT NULL
GROUP BY "billingCycle";

-- =====================================================================
-- 7. REVERTER CORREÇÃO (SE NECESSÁRIO - USAR APENAS EM EMERGÊNCIA)
-- =====================================================================

-- ⚠️ USAR APENAS SE A CORREÇÃO CAUSAR PROBLEMAS!
-- Esta query REVERTE a correção usando o backup temporário

-- UPDATE users u
-- SET 
--   "creditsExpiresAt" = b."creditsExpiresAt",
--   "updatedAt" = NOW()
-- FROM backup_users_credits_expires_at b
-- WHERE u.id = b.id;

-- =====================================================================
-- 8. LIMPAR BACKUP TEMPORÁRIO
-- =====================================================================

-- 8.1. Após confirmar que tudo funcionou, limpar o backup temporário
-- DROP TABLE IF EXISTS backup_users_credits_expires_at;

-- =====================================================================
-- 9. CONCLUSÃO
-- =====================================================================

-- ✅ Correção aplicada com sucesso
-- ✅ Todos os usuários MONTHLY agora têm creditsExpiresAt = NULL
-- ✅ Badge de créditos não será mais afetado por expiração incorreta

-- 🔧 PRÓXIMO PASSO OBRIGATÓRIO:
-- Aplicar correção sistêmica no código:
-- src/lib/services/credit-package-service.ts (adicionar verificação de billingCycle)
-- src/lib/db/subscriptions.ts (garantir que creditsExpiresAt = NULL para mensais)
