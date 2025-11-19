-- Script para remover a constraint única de user_packages
-- Isso permite que usuários gerem o mesmo pacote múltiplas vezes
-- Execute este script diretamente no banco de dados de produção

-- Remove a constraint única se existir
ALTER TABLE "user_packages" DROP CONSTRAINT IF EXISTS "user_packages_userId_packageId_key";

-- Verifica se a constraint foi removida
SELECT 
    constraint_name,
    constraint_type
FROM 
    information_schema.table_constraints
WHERE 
    table_name = 'user_packages' 
    AND constraint_name = 'user_packages_userId_packageId_key';

-- Se não retornar nenhuma linha, a constraint foi removida com sucesso

