-- Script para verificar e corrigir gerações travadas
-- Execute este script no Supabase SQL Editor

-- 1. Ver detalhes das gerações "em_andamento" dos pacotes GENERATING
SELECT 
  g.id as generation_id,
  g."packageId",
  g.status as generation_status,
  g."jobId",
  g."createdAt",
  g."updatedAt",
  EXTRACT(EPOCH FROM (NOW() - g."updatedAt")) / 60 as minutos_sem_atualizar,
  up.status as package_status
FROM generations g
INNER JOIN user_packages up ON up.id = g."packageId"
WHERE up.status = 'GENERATING'
  AND g.status IN ('PENDING', 'PROCESSING')
ORDER BY g."updatedAt" ASC;

-- 2. Marcar como FAILED todas as gerações PENDING/PROCESSING que não foram atualizadas há mais de 10 minutos
UPDATE generations
SET 
  status = 'FAILED'::"GenerationStatus",
  "errorMessage" = 'Geração travada - não atualizada há mais de 10 minutos. Reconciliado automaticamente.',
  "updatedAt" = NOW()
WHERE status IN ('PENDING', 'PROCESSING')
  AND "packageId" IS NOT NULL
  AND "updatedAt" < NOW() - INTERVAL '10 minutes';

-- 3. Atualizar contadores dos pacotes
UPDATE user_packages up
SET 
  "generatedImages" = COALESCE((
    SELECT COUNT(*) 
    FROM generations g 
    WHERE g."packageId" = up.id AND g.status = 'COMPLETED'
  ), 0),
  "failedImages" = COALESCE((
    SELECT COUNT(*) 
    FROM generations g 
    WHERE g."packageId" = up.id AND g.status = 'FAILED'
  ), 0),
  "updatedAt" = NOW()
WHERE up.status = 'GENERATING';

-- 4. Atualizar status dos pacotes baseado no estado real das gerações
UPDATE user_packages up
SET 
  status = CASE
    -- Se não tem gerações em andamento e tem completadas = COMPLETED
    WHEN NOT EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status IN ('PENDING', 'PROCESSING'))
      AND EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status = 'COMPLETED')
      THEN 'COMPLETED'::"PackageStatus"
    -- Se não tem gerações em andamento e todas falharam = FAILED
    WHEN NOT EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status IN ('PENDING', 'PROCESSING', 'COMPLETED'))
      THEN 'FAILED'::"PackageStatus"
    -- Caso contrário mantém GENERATING
    ELSE 'GENERATING'::"PackageStatus"
  END,
  "completedAt" = CASE
    WHEN NOT EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status IN ('PENDING', 'PROCESSING'))
      AND EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status = 'COMPLETED')
    THEN NOW()
    ELSE up."completedAt"
  END,
  "errorMessage" = CASE
    WHEN NOT EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status IN ('PENDING', 'PROCESSING', 'COMPLETED'))
      THEN 'Todas as gerações falharam. Reconciliado automaticamente.'
    ELSE up."errorMessage"
  END,
  "updatedAt" = NOW()
WHERE up.status = 'GENERATING';

-- 5. Verificar resultado final
SELECT 
  up.id,
  up.status,
  up."totalImages",
  up."generatedImages",
  up."failedImages",
  COUNT(g.id) FILTER (WHERE g.status IN ('PENDING', 'PROCESSING')) as em_andamento,
  COUNT(g.id) FILTER (WHERE g.status = 'COMPLETED') as completadas,
  COUNT(g.id) FILTER (WHERE g.status = 'FAILED') as falhadas
FROM user_packages up
LEFT JOIN generations g ON g."packageId" = up.id
WHERE up.id IN ('cmhfp7rn300011704esoldylu', 'cmhfql8sq0001jp041qkdkraj')
GROUP BY up.id, up.status, up."totalImages", up."generatedImages", up."failedImages";

