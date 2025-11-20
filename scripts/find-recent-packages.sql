-- Script para encontrar os pacotes mais recentes e seus IDs
-- Use isso primeiro para encontrar o ID do pacote que você quer verificar

-- 1. Listar pacotes mais recentes (últimas 24 horas)
SELECT 
  up.id as user_package_id,
  up."userId",
  up."packageId",
  pp.name as package_name,
  up.status,
  up."totalImages",
  up."generatedImages",
  up."failedImages",
  up."activatedAt",
  up."completedAt",
  up."createdAt"
FROM user_packages up
LEFT JOIN photo_packages pp ON up."packageId" = pp.id
WHERE up."createdAt" >= NOW() - INTERVAL '24 hours'
ORDER BY up."createdAt" DESC
LIMIT 10;

-- 2. Para um pacote específico, verificar quantas gerações foram criadas
SELECT 
  up.id as user_package_id,
  up.status as package_status,
  up."totalImages" as expected_images,
  up."generatedImages" as completed_images,
  up."failedImages" as failed_images,
  COUNT(g.id) as total_generations,
  COUNT(CASE WHEN g.status = 'COMPLETED' THEN 1 END) as completed_generations,
  COUNT(CASE WHEN g.status = 'PROCESSING' THEN 1 END) as processing_generations,
  COUNT(CASE WHEN g.status = 'PENDING' THEN 1 END) as pending_generations,
  COUNT(CASE WHEN g.status = 'FAILED' THEN 1 END) as failed_generations
FROM user_packages up
LEFT JOIN generations g ON (
  g.metadata->>'source' = 'package' 
  AND g.metadata->>'userPackageId' = up.id
)
WHERE up."createdAt" >= NOW() - INTERVAL '24 hours'
GROUP BY up.id, up.status, up."totalImages", up."generatedImages", up."failedImages"
ORDER BY up."createdAt" DESC;

