-- Script SQL AGRESSIVO para limpar pacotes travados
-- Este script verifica se as gerações estão realmente ativas e limpa pacotes travados
-- Execute no Supabase SQL Editor

-- PASSO 1: Ver quais pacotes estão GENERATING e suas gerações
SELECT 
  up.id as package_id,
  up.status as package_status,
  up."totalImages",
  up."generatedImages",
  up."failedImages",
  up."createdAt",
  COUNT(g.id) as total_geracoes,
  COUNT(g.id) FILTER (WHERE g.status = 'PENDING') as pending,
  COUNT(g.id) FILTER (WHERE g.status = 'PROCESSING') as processing,
  COUNT(g.id) FILTER (WHERE g.status = 'COMPLETED') as completed,
  COUNT(g.id) FILTER (WHERE g.status = 'FAILED') as failed,
  -- Verificar se as gerações "processando" são antigas (provavelmente travadas)
  MAX(g."updatedAt") FILTER (WHERE g.status IN ('PENDING', 'PROCESSING')) as ultima_atualizacao_processando
FROM user_packages up
LEFT JOIN generations g ON g."packageId" = up.id
WHERE up.status = 'GENERATING'
GROUP BY up.id, up.status, up."totalImages", up."generatedImages", up."failedImages", up."createdAt"
ORDER BY up."createdAt" DESC;

-- PASSO 2: Marcar gerações PENDING/PROCESSING antigas como FAILED
-- (se não foram atualizadas há mais de 30 minutos, provavelmente estão travadas)
UPDATE generations
SET 
  status = 'FAILED',
  "errorMessage" = 'Geração travada - não foi atualizada há mais de 30 minutos. Reconciliado automaticamente.',
  "updatedAt" = NOW()
WHERE status IN ('PENDING', 'PROCESSING')
  AND "updatedAt" < NOW() - INTERVAL '30 minutes'
  AND "packageId" IS NOT NULL;

-- PASSO 3: Atualizar contadores dos pacotes baseado nas gerações reais
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
WHERE up.status = 'GENERATING'
  AND EXISTS (
    SELECT 1 
    FROM generations g 
    WHERE g."packageId" = up.id
  );

-- PASSO 4: Marcar pacotes como COMPLETED se todas as gerações terminaram (completas ou falhadas)
UPDATE user_packages up
SET 
  status = 'COMPLETED',
  "completedAt" = NOW(),
  "updatedAt" = NOW()
WHERE up.status = 'GENERATING'
  AND EXISTS (
    SELECT 1 
    FROM generations g 
    WHERE g."packageId" = up.id
  )
  AND NOT EXISTS (
    SELECT 1 
    FROM generations g 
    WHERE g."packageId" = up.id 
      AND g.status IN ('PENDING', 'PROCESSING')
  )
  AND EXISTS (
    SELECT 1 
    FROM generations g 
    WHERE g."packageId" = up.id AND g.status = 'COMPLETED'
  );

-- PASSO 5: Marcar pacotes como FAILED se todas as gerações falharam OU não há gerações
UPDATE user_packages up
SET 
  status = 'FAILED',
  "errorMessage" = CASE
    WHEN NOT EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id) THEN
      'Nenhuma geração foi criada. Reconciliado automaticamente.'
    WHEN EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status = 'FAILED')
      AND NOT EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status IN ('PENDING', 'PROCESSING', 'COMPLETED')) THEN
      'Todas as gerações falharam. Reconciliado automaticamente.'
    ELSE
      'Pacote travado. Reconciliado automaticamente.'
  END,
  "updatedAt" = NOW()
WHERE up.status = 'GENERATING'
  AND (
    -- Sem gerações
    NOT EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id)
    OR
    -- Todas as gerações falharam
    (
      EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id)
      AND NOT EXISTS (SELECT 1 FROM generations g WHERE g."packageId" = up.id AND g.status IN ('PENDING', 'PROCESSING', 'COMPLETED'))
    )
  );

-- PASSO 6: Verificar resultado final
SELECT 
  up.id,
  up.status,
  up."totalImages",
  up."generatedImages",
  up."failedImages",
  up."errorMessage",
  COUNT(g.id) as total_geracoes,
  COUNT(g.id) FILTER (WHERE g.status = 'PENDING') as pending,
  COUNT(g.id) FILTER (WHERE g.status = 'PROCESSING') as processing,
  COUNT(g.id) FILTER (WHERE g.status = 'COMPLETED') as completed,
  COUNT(g.id) FILTER (WHERE g.status = 'FAILED') as failed
FROM user_packages up
LEFT JOIN generations g ON g."packageId" = up.id
WHERE up.status IN ('GENERATING', 'COMPLETED', 'FAILED')
GROUP BY up.id, up.status, up."totalImages", up."generatedImages", up."failedImages", up."errorMessage"
ORDER BY up."updatedAt" DESC;

