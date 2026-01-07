-- ================================================
-- ROLLBACK: Billing Configuration System
-- ================================================
-- Este SQL remove APENAS as estruturas criadas pelo
-- sistema de billing configurável (20260106)
--
-- SEGURO: Não afeta tabelas existentes
-- ================================================

-- 1. Remover Foreign Keys primeiro (ordem correta)
ALTER TABLE "billing_config" DROP CONSTRAINT IF EXISTS "billing_config_modelBPlanId_fkey";
ALTER TABLE "billing_cycles" DROP CONSTRAINT IF EXISTS "billing_cycles_planId_fkey";

-- 2. Dropar tabelas (ordem: dependentes primeiro)
DROP TABLE IF EXISTS "billing_config_audit" CASCADE;
DROP TABLE IF EXISTS "billing_cycles" CASCADE;
DROP TABLE IF EXISTS "billing_plans" CASCADE;
DROP TABLE IF EXISTS "billing_config" CASCADE;

-- 3. Dropar enum
DROP TYPE IF EXISTS "BillingModel";

-- ================================================
-- Verificação pós-rollback
-- ================================================

-- Verificar que tabelas foram removidas
SELECT
    tablename
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename LIKE 'billing_%'
ORDER BY tablename;

-- Resultado esperado: 0 rows (todas removidas)

-- Verificar que enum foi removido
SELECT
    typname
FROM pg_type
WHERE typname = 'BillingModel';

-- Resultado esperado: 0 rows (enum removido)

-- Verificar que tabelas principais continuam intactas
SELECT
    tablename
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('users', 'subscription_plans', 'payments', 'credit_purchases')
ORDER BY tablename;

-- Resultado esperado: 4 rows (todas intactas)
