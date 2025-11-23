-- Verificar gerações duplicadas para o usuário
-- Execute no Supabase SQL Editor ou Prisma Studio

-- 1. Ver todas as gerações recentes (últimas 2 horas)
SELECT 
  id, 
  prompt,
  status,
  "jobId",
  TO_CHAR("createdAt", 'YYYY-MM-DD HH24:MI:SS') as created,
  TO_CHAR("updatedAt", 'YYYY-MM-DD HH24:MI:SS') as updated,
  "operationType",
  metadata
FROM "Generation" 
WHERE "userId" = 'cmf3555br0004qjk80pe9dhqr'
  AND "createdAt" > NOW() - INTERVAL '2 hours'
ORDER BY "createdAt" DESC;

-- 2. Buscar duplicados (mesmo prompt, status PROCESSING, criados próximos)
WITH duplicates AS (
  SELECT 
    prompt,
    COUNT(*) as count,
    STRING_AGG(id::text, ', ') as ids,
    STRING_AGG(status::text, ', ') as statuses
  FROM "Generation"
  WHERE "userId" = 'cmf3555br0004qjk80pe9dhqr'
    AND "createdAt" > NOW() - INTERVAL '2 hours'
  GROUP BY prompt
  HAVING COUNT(*) > 1
)
SELECT * FROM duplicates;

-- 3. Buscar gerações em PROCESSING que nunca completaram
SELECT 
  id,
  prompt,
  status,
  "jobId",
  "createdAt",
  "updatedAt",
  EXTRACT(EPOCH FROM (NOW() - "createdAt"))/60 as minutes_stuck
FROM "Generation"
WHERE "userId" = 'cmf3555br0004qjk80pe9dhqr'
  AND status = 'PROCESSING'
  AND "createdAt" < NOW() - INTERVAL '10 minutes'
ORDER BY "createdAt" DESC;

