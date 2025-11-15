-- Script SQL CORRIGIDO para limpar pacotes GENERATING travados
-- Execute este script no Supabase SQL Editor
-- CORRIGIDO: Cast explícito para enum PackageStatus

-- 1. Ver o estado atual dos pacotes GENERATING
SELECT 
  up.id,
  up.status,
  up."totalImages",
  up."generatedImages",
  up."failedImages",
  COUNT(g.id) as total_geracoes,
  COUNT(g.id) FILTER (WHERE g.status IN ('PENDING', 'PROCESSING')) as em_andamento,
  COUNT(g.id) FILTER (WHERE g.status = 'COMPLETED') as completadas,
  COUNT(g.id) FILTER (WHERE g.status = 'FAILED') as falhadas
FROM user_packages up
LEFT JOIN generations g ON g."packageId" = up.id
WHERE up.status = 'GENERATING'
GROUP BY up.id, up.status, up."totalImages", up."generatedImages", up."failedImages";

-- 2. FORÇAR: Marcar gerações PENDING/PROCESSING antigas como FAILED (mais de 10 minutos sem atualizar)
UPDATE generations
SET 
  status = 'FAILED'::"GenerationStatus",
  "errorMessage" = 'Geração travada - reconciliado automaticamente',
  "updatedAt" = NOW()
WHERE status IN ('PENDING', 'PROCESSING')
  AND "packageId" IS NOT NULL
  AND "updatedAt" < NOW() - INTERVAL '10 minutes';

-- 3. FORÇAR: Atualizar todos os pacotes GENERATING baseado no estado real
-- CORRIGIDO: Cast explícito para enum PackageStatus
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
  status = CASE
    -- Se não tem gerações ou todas falharam = FAILED
    WHEN NOT EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id)
      OR (
        EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id)
        AND NOT EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status IN ('PENDING', 'PROCESSING', 'COMPLETED'))
      ) THEN 'FAILED'::"PackageStatus"
    -- Se tem gerações completadas e nenhuma em andamento = COMPLETED
    WHEN EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status = 'COMPLETED')
      AND NOT EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status IN ('PENDING', 'PROCESSING')) THEN 'COMPLETED'::"PackageStatus"
    -- Caso contrário mantém GENERATING (mas não deveria chegar aqui)
    ELSE 'GENERATING'::"PackageStatus"
  END,
  "completedAt" = CASE
    WHEN EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status = 'COMPLETED')
      AND NOT EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status IN ('PENDING', 'PROCESSING')) THEN NOW()
    ELSE up."completedAt"
  END,
  "errorMessage" = CASE
    WHEN NOT EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id) THEN
      'Nenhuma geração foi criada. Reconciliado automaticamente.'
    WHEN EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id)
      AND NOT EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status IN ('PENDING', 'PROCESSING', 'COMPLETED')) THEN
      'Todas as gerações falharam. Reconciliado automaticamente.'
    ELSE up."errorMessage"
  END,
  "updatedAt" = NOW()
WHERE up.status = 'GENERATING';

-- 4. Verificar resultado
SELECT 
  status,
  COUNT(*) as quantidade
FROM user_packages
WHERE status IN ('GENERATING', 'COMPLETED', 'FAILED')
GROUP BY status;

