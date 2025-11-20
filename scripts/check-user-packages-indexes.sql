-- Verificar índices únicos na tabela user_packages
-- Às vezes o PostgreSQL cria índices únicos que não aparecem como constraints

SELECT 
    indexname,
    indexdef,
    indisunique
FROM 
    pg_indexes
    JOIN pg_index ON pg_indexes.indexname = pg_class.relname
    JOIN pg_class ON pg_index.indexrelid = pg_class.oid
WHERE 
    tablename = 'user_packages'
ORDER BY 
    indexname;

-- Versão mais simples
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    tablename = 'user_packages'
    AND indexdef LIKE '%UNIQUE%';

