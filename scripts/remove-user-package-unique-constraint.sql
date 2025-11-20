-- Script para remover a constraint única e o índice único de user_packages
-- Isso permite que usuários gerem o mesmo pacote múltiplas vezes
-- Execute este script diretamente no banco de dados de produção

-- Remove a constraint única se existir
ALTER TABLE "user_packages" DROP CONSTRAINT IF EXISTS "user_packages_userId_packageId_key";

-- CRITICAL: Also remove the unique index (PostgreSQL sometimes creates indexes separately)
DROP INDEX IF EXISTS "user_packages_userId_packageId_key";

-- Verifica se a constraint foi removida
SELECT 
    constraint_name,
    constraint_type
FROM 
    information_schema.table_constraints
WHERE 
    table_name = 'user_packages' 
    AND constraint_name = 'user_packages_userId_packageId_key';

-- Verifica se o índice foi removido
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    tablename = 'user_packages'
    AND indexname = 'user_packages_userId_packageId_key';

-- Se ambas as queries não retornarem nenhuma linha, a constraint e o índice foram removidos com sucesso

