-- Script para verificar TODAS as constraints na tabela user_packages
-- Execute este script para ver se há outras constraints além da que removemos

-- Verificar todas as constraints únicas
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    kcu.ordinal_position
FROM 
    information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
WHERE 
    tc.table_name = 'user_packages'
    AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY 
    tc.constraint_name, kcu.ordinal_position;

-- Verificar índices únicos também
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    tablename = 'user_packages'
    AND indexdef LIKE '%UNIQUE%';

