-- Script SQL SIMPLIFICADO para reconciliar pacotes travados
-- Execute este script diretamente no Supabase SQL Editor
-- Este script é mais seguro e faz uma atualização por vez

-- PASSO 1: Ver quantos pacotes estão travados
SELECT 
  COUNT(*) as total_travados,
  COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
  COUNT(*) FILTER (WHERE status = 'GENERATING') as generating
FROM user_packages
WHERE status IN ('ACTIVE', 'GENERATING');

-- PASSO 2: Ver detalhes dos pacotes travados
SELECT 
  up.id,
  up.status as status_atual,
  up."totalImages",
  up."generatedImages",
  up."failedImages",
  up."createdAt",
  COUNT(g.id) as total_geracoes,
  COUNT(g.id) FILTER (WHERE g.status = 'PENDING') as pending,
  COUNT(g.id) FILTER (WHERE g.status = 'PROCESSING') as processing,
  COUNT(g.id) FILTER (WHERE g.status = 'COMPLETED') as completed,
  COUNT(g.id) FILTER (WHERE g.status = 'FAILED') as failed
FROM user_packages up
LEFT JOIN generations g ON g."packageId" = up.id
WHERE up.status IN ('ACTIVE', 'GENERATING')
GROUP BY up.id, up.status, up."totalImages", up."generatedImages", up."failedImages", up."createdAt"
ORDER BY up."createdAt" DESC;

-- PASSO 3: Marcar como FAILED os pacotes sem gerações há mais de 5 minutos
UPDATE user_packages
SET 
  status = 'FAILED',
  "errorMessage" = 'Nenhuma geração foi criada. Reconciliado automaticamente.',
  "updatedAt" = NOW()
WHERE id IN (
  SELECT up.id
  FROM user_packages up
  WHERE up.status IN ('ACTIVE', 'GENERATING')
    AND NOT EXISTS (
      SELECT 1 
      FROM generations g 
      WHERE g."packageId" = up.id
    )
    AND up."createdAt" < NOW() - INTERVAL '5 minutes'
);

-- PASSO 4: Atualizar contadores (generatedImages e failedImages) baseado nas gerações reais
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
WHERE up.status IN ('ACTIVE', 'GENERATING')
  AND EXISTS (
    SELECT 1 
    FROM generations g 
    WHERE g."packageId" = up.id
  );

-- PASSO 5: Marcar como GENERATING se tem gerações em andamento
UPDATE user_packages up
SET 
  status = 'GENERATING',
  "updatedAt" = NOW()
WHERE up.status = 'ACTIVE'
  AND EXISTS (
    SELECT 1 
    FROM generations g 
    WHERE g."packageId" = up.id 
      AND g.status IN ('PENDING', 'PROCESSING')
  );

-- PASSO 6: Marcar como COMPLETED se todas as gerações terminaram e pelo menos uma completou
UPDATE user_packages up
SET 
  status = 'COMPLETED',
  "completedAt" = NOW(),
  "updatedAt" = NOW()
WHERE up.status IN ('ACTIVE', 'GENERATING')
  AND EXISTS (
    SELECT 1 
    FROM generations g 
    WHERE g."packageId" = up.id AND g.status = 'COMPLETED'
  )
  AND NOT EXISTS (
    SELECT 1 
    FROM generations g 
    WHERE g."packageId" = up.id 
      AND g.status IN ('PENDING', 'PROCESSING')
  );

-- PASSO 7: Marcar como FAILED se todas as gerações falharam
UPDATE user_packages up
SET 
  status = 'FAILED',
  "errorMessage" = 'Todas as gerações falharam.',
  "updatedAt" = NOW()
WHERE up.status IN ('ACTIVE', 'GENERATING')
  AND EXISTS (
    SELECT 1 
    FROM generations g 
    WHERE g."packageId" = up.id
  )
  AND NOT EXISTS (
    SELECT 1 
    FROM generations g 
    WHERE g."packageId" = up.id 
      AND g.status IN ('PENDING', 'PROCESSING', 'COMPLETED')
  )
  AND EXISTS (
    SELECT 1 
    FROM generations g 
    WHERE g."packageId" = up.id AND g.status = 'FAILED'
  );

-- PASSO 8: Verificar o resultado final
SELECT 
  status,
  COUNT(*) as quantidade,
  SUM("generatedImages") as total_geradas,
  SUM("failedImages") as total_falhadas
FROM user_packages
GROUP BY status
ORDER BY status;

