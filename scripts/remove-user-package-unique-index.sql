-- Script para remover o índice único de user_packages
-- O PostgreSQL criou um índice único que também impede duplicatas
-- Execute este script diretamente no banco de dados de produção

-- Remove o índice único se existir
DROP INDEX IF EXISTS "user_packages_userId_packageId_key";

-- Verifica se o índice foi removido
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    tablename = 'user_packages'
    AND indexname = 'user_packages_userId_packageId_key';

-- Se não retornar nenhuma linha, o índice foi removido com sucesso

