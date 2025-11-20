-- Script de debug detalhado para gerações de pacote
-- Substitua 'SEU_USER_PACKAGE_ID' pelo ID real do user_package

-- 0. PRIMEIRO: Encontrar o user_package_id mais recente (se não souber)
-- SELECT id, "packageId", status, "createdAt" 
-- FROM user_packages 
-- ORDER BY "createdAt" DESC 
-- LIMIT 5;

-- 1. Verificar detalhes completos de cada geração
SELECT 
  id,
  "userId",
  status,
  "jobId",
  "imageUrls",
  array_length("imageUrls", 1) as urls_count,
  "completedAt",
  "errorMessage",
  "createdAt",
  "updatedAt",
  -- Metadata completo
  metadata->>'source' as source,
  metadata->>'userPackageId' as user_package_id,
  metadata->>'packagePromptIndex' as prompt_index,
  metadata->>'webhookProcessed' as webhook_processed,
  metadata->>'processedVia' as processed_via,
  metadata->>'stored' as stored,
  metadata->>'storedAt' as stored_at,
  -- Verificar se jobId está preenchido (crítico para webhook encontrar)
  CASE 
    WHEN "jobId" IS NULL OR "jobId" = '' THEN '❌ SEM JOBID'
    ELSE '✅ TEM JOBID'
  END as jobid_status
FROM generations
WHERE 
  metadata->>'source' = 'package' 
  AND metadata->>'userPackageId' = 'SEU_USER_PACKAGE_ID' -- ⚠️ SUBSTITUA PELO ID REAL
ORDER BY 
  (metadata->>'packagePromptIndex')::int ASC;

-- 2. Verificar se há gerações com jobId mas sem processamento
SELECT 
  id,
  "jobId",
  status,
  "createdAt",
  EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 60 as minutes_since_creation,
  CASE 
    WHEN "jobId" IS NULL OR "jobId" = '' THEN '❌ SEM JOBID - Webhook não pode encontrar'
    WHEN metadata->>'webhookProcessed' != 'true' THEN '⚠️ TEM JOBID mas webhook não processou'
    ELSE '✅ Processado'
  END as status_diagnosis
FROM generations
WHERE 
  metadata->>'source' = 'package' 
  AND metadata->>'userPackageId' = 'SEU_USER_PACKAGE_ID' -- ⚠️ SUBSTITUA PELO ID REAL
  AND status IN ('PROCESSING', 'PENDING')
ORDER BY "createdAt" DESC;

-- 3. Verificar UserPackage atual
SELECT 
  id,
  status,
  "totalImages",
  "generatedImages",
  "failedImages",
  "activatedAt",
  "completedAt",
  "createdAt",
  EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 60 as minutes_since_creation
FROM user_packages
WHERE id = 'SEU_USER_PACKAGE_ID'; -- ⚠️ SUBSTITUA PELO ID REAL

