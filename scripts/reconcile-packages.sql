-- Script SQL para reconciliar pacotes travados no banco de dados
-- Execute este script diretamente no Supabase SQL Editor

-- 1. Primeiro, vamos ver quantos pacotes estão travados
SELECT 
  id,
  "userId",
  "packageId",
  status,
  "totalImages",
  "generatedImages",
  "failedImages",
  "createdAt",
  "updatedAt"
FROM user_packages
WHERE status IN ('ACTIVE', 'GENERATING')
ORDER BY "createdAt" DESC;

-- 2. Criar uma função temporária para contar gerações por status
-- (ou usar CTEs inline)

-- 3. Atualizar pacotes que não têm gerações criadas (travados há mais de 5 minutos)
UPDATE user_packages
SET 
  status = 'FAILED',
  "errorMessage" = 'Nenhuma geração foi criada. O pacote pode ter falhado ao iniciar.',
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

-- 4. Atualizar contadores e status baseado nas gerações reais
WITH generation_stats AS (
  SELECT 
    g."packageId",
    COUNT(*) FILTER (WHERE g.status = 'PENDING') as pending,
    COUNT(*) FILTER (WHERE g.status = 'PROCESSING') as processing,
    COUNT(*) FILTER (WHERE g.status = 'COMPLETED') as completed,
    COUNT(*) FILTER (WHERE g.status = 'FAILED') as failed,
    COUNT(*) as total
  FROM generations g
  WHERE g."packageId" IS NOT NULL
  GROUP BY g."packageId"
)
UPDATE user_packages up
SET 
  "generatedImages" = COALESCE(gs.completed, 0),
  "failedImages" = COALESCE(gs.failed, 0),
  status = CASE
    -- Se não tem gerações e passou mais de 5 minutos, marca como FAILED
    WHEN gs.total IS NULL AND up."createdAt" < NOW() - INTERVAL '5 minutes' THEN 'FAILED'
    -- Se tem gerações em andamento, marca como GENERATING
    WHEN COALESCE(gs.pending, 0) > 0 OR COALESCE(gs.processing, 0) > 0 THEN 'GENERATING'
    -- Se todas as gerações terminaram
    WHEN gs.total IS NOT NULL AND (COALESCE(gs.completed, 0) + COALESCE(gs.failed, 0)) = gs.total THEN
      CASE
        -- Se todas falharam
        WHEN COALESCE(gs.failed, 0) = gs.total THEN 'FAILED'
        -- Se pelo menos uma completou
        WHEN COALESCE(gs.completed, 0) > 0 THEN 'COMPLETED'
        ELSE up.status
      END
    -- Caso contrário, mantém o status atual
    ELSE up.status
  END,
  "completedAt" = CASE
    WHEN (gs.total IS NOT NULL AND (COALESCE(gs.completed, 0) + COALESCE(gs.failed, 0)) = gs.total 
          AND COALESCE(gs.completed, 0) > 0) THEN NOW()
    ELSE up."completedAt"
  END,
  "errorMessage" = CASE
    WHEN gs.total IS NULL AND up."createdAt" < NOW() - INTERVAL '5 minutes' THEN 
      'Nenhuma geração foi criada. O pacote pode ter falhado ao iniciar.'
    WHEN gs.total IS NOT NULL AND COALESCE(gs.failed, 0) = gs.total THEN 
      'Todas as gerações falharam.'
    WHEN gs.total IS NOT NULL AND COALESCE(gs.failed, 0) > 0 AND COALESCE(gs.completed, 0) > 0 THEN 
      'Pacote concluído com falhas.'
    ELSE up."errorMessage"
  END,
  "updatedAt" = NOW()
FROM generation_stats gs
WHERE up.id = gs."packageId"
  AND up.status IN ('ACTIVE', 'GENERATING')
  AND (
    -- Atualiza se os contadores estão diferentes
    up."generatedImages" != COALESCE(gs.completed, 0)
    OR up."failedImages" != COALESCE(gs.failed, 0)
    -- Ou se o status precisa mudar
    OR (
      -- Precisa mudar para GENERATING
      (COALESCE(gs.pending, 0) > 0 OR COALESCE(gs.processing, 0) > 0) AND up.status != 'GENERATING'
    )
    OR (
      -- Precisa mudar para COMPLETED
      gs.total IS NOT NULL 
      AND (COALESCE(gs.completed, 0) + COALESCE(gs.failed, 0)) = gs.total
      AND COALESCE(gs.completed, 0) > 0
      AND up.status != 'COMPLETED'
    )
    OR (
      -- Precisa mudar para FAILED
      (
        (gs.total IS NULL AND up."createdAt" < NOW() - INTERVAL '5 minutes')
        OR (gs.total IS NOT NULL AND COALESCE(gs.failed, 0) = gs.total)
      )
      AND up.status != 'FAILED'
    )
  );

-- 5. Atualizar pacotes que não têm gerações (não foram encontrados no JOIN acima)
UPDATE user_packages
SET 
  status = CASE
    WHEN "createdAt" < NOW() - INTERVAL '5 minutes' THEN 'FAILED'
    ELSE 'ACTIVE'
  END,
  "errorMessage" = CASE
    WHEN "createdAt" < NOW() - INTERVAL '5 minutes' THEN 
      'Nenhuma geração foi criada. O pacote pode ter falhado ao iniciar.'
    ELSE "errorMessage"
  END,
  "updatedAt" = NOW()
WHERE status IN ('ACTIVE', 'GENERATING')
  AND id NOT IN (
    SELECT DISTINCT "packageId" 
    FROM generations 
    WHERE "packageId" IS NOT NULL
  );

-- 6. Verificar o resultado
SELECT 
  up.id,
  up.status,
  up."totalImages",
  up."generatedImages",
  up."failedImages",
  up."errorMessage",
  COUNT(g.id) FILTER (WHERE g.status = 'PENDING') as pending_gens,
  COUNT(g.id) FILTER (WHERE g.status = 'PROCESSING') as processing_gens,
  COUNT(g.id) FILTER (WHERE g.status = 'COMPLETED') as completed_gens,
  COUNT(g.id) FILTER (WHERE g.status = 'FAILED') as failed_gens,
  COUNT(g.id) as total_gens
FROM user_packages up
LEFT JOIN generations g ON g."packageId" = up.id
WHERE up.status IN ('ACTIVE', 'GENERATING', 'COMPLETED', 'FAILED')
GROUP BY up.id, up.status, up."totalImages", up."generatedImages", up."failedImages", up."errorMessage"
ORDER BY up."createdAt" DESC;

