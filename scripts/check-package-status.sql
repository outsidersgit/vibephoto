-- Script para verificar o status completo de um pacote e suas gerações
-- Substitua 'SEU_USER_PACKAGE_ID' pelo ID real do user_package

-- 1. Verificar status do UserPackage
SELECT 
  id,
  "userId",
  "packageId",
  status,
  "totalImages",
  "generatedImages",
  "failedImages",
  "activatedAt",
  "completedAt",
  "errorMessage",
  "createdAt",
  "updatedAt"
FROM user_packages
WHERE id = 'SEU_USER_PACKAGE_ID'; -- ⚠️ SUBSTITUA PELO ID REAL

-- 2. Verificar TODAS as gerações relacionadas ao pacote
-- (busca por metadata.userPackageId - novo formato)
SELECT 
  id,
  "userId",
  status,
  "jobId",
  "imageUrls",
  "completedAt",
  "errorMessage",
  metadata->>'source' as source,
  metadata->>'userPackageId' as user_package_id,
  metadata->>'packagePromptIndex' as prompt_index,
  metadata->>'webhookProcessed' as webhook_processed,
  metadata->>'processedVia' as processed_via,
  metadata->>'stored' as stored,
  metadata->>'storedAt' as stored_at,
  metadata->>'temporaryUrls' as temporary_urls,
  metadata->>'permanentUrls' as permanent_urls,
  "createdAt",
  "updatedAt"
FROM generations
WHERE 
  metadata->>'source' = 'package' 
  AND metadata->>'userPackageId' = 'SEU_USER_PACKAGE_ID' -- ⚠️ SUBSTITUA PELO ID REAL
ORDER BY 
  (metadata->>'packagePromptIndex')::int ASC,
  "createdAt" ASC;

-- 3. Contar gerações por status
SELECT 
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN "imageUrls" IS NOT NULL AND array_length("imageUrls", 1) > 0 THEN 1 END) as with_urls,
  COUNT(CASE WHEN metadata->>'webhookProcessed' = 'true' THEN 1 END) as webhook_processed,
  COUNT(CASE WHEN metadata->>'stored' = 'true' THEN 1 END) as stored
FROM generations
WHERE 
  metadata->>'source' = 'package' 
  AND metadata->>'userPackageId' = 'SEU_USER_PACKAGE_ID' -- ⚠️ SUBSTITUA PELO ID REAL
GROUP BY status;

-- 4. Verificar se há gerações sem URLs permanentes (problema!)
SELECT 
  id,
  status,
  "jobId",
  "imageUrls",
  array_length("imageUrls", 1) as urls_count,
  metadata->>'webhookProcessed' as webhook_processed,
  metadata->>'stored' as stored,
  metadata->>'permanentUrls' as permanent_urls,
  "errorMessage"
FROM generations
WHERE 
  metadata->>'source' = 'package' 
  AND metadata->>'userPackageId' = 'SEU_USER_PACKAGE_ID' -- ⚠️ SUBSTITUA PELO ID REAL
  AND status = 'COMPLETED'
  AND (
    "imageUrls" IS NULL 
    OR array_length("imageUrls", 1) IS NULL
    OR array_length("imageUrls", 1) = 0
    OR metadata->>'stored' != 'true'
  );

