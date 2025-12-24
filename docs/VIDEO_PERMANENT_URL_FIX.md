# Fix: Webhook Salvando Links Provisórios do Replicate

## 🔴 Problema

O webhook de vídeo estava salvando **links provisórios do Replicate** no banco de dados em vez dos **links permanentes do CloudFront/S3**.

### Causa Raiz

O webhook tinha **duas atualizações** da URL:

1. **Primeira atualização** (linha 420): Logo após receber o webhook, salvava o link provisório do Replicate
2. **Segunda atualização** (linha 726): Após fazer storage, tentava salvar o link permanente

**Problema:** Se a segunda atualização falhasse ou fosse sobrescrita, o link provisório permanecia no banco.

---

## ✅ Solução Implementada

### **1. Remover Salvamento de URL Temporária (Primeira Atualização)**

**Antes:**
```typescript
// ❌ Salvava URL temporária logo ao receber webhook
updatedVideo = await updateVideoGenerationByJobId(
  jobId,
  internalStatus,
  videoUrl,  // ❌ Link provisório do Replicate
  errorMessage,
  undefined,
  mergedMetadata
)
```

**Depois:**
```typescript
// ✅ NÃO salva URL na primeira atualização
updatedVideo = await updateVideoGenerationByJobId(
  jobId,
  internalStatus,
  undefined,  // ✅ Não salva URL ainda
  errorMessage,
  undefined,
  mergedMetadata
)
```

### **2. Salvar APENAS URL Permanente (Após Storage)**

**Antes:**
```typescript
// ❌ Salvava URL temporária como fallback
const videoUrlToSave = storageResult.success && storageResult.videoUrl 
  ? storageResult.videoUrl  // Permanent URL from storage
  : videoUrl  // ❌ Temporary URL from Replicate (fallback)
```

**Depois:**
```typescript
// ✅ SOMENTE URL permanente - falha se storage falhar
if (!storageResult.success || !storageResult.videoUrl) {
  throw new Error(`Storage failed: ${storageResult.error || 'No permanent URL generated'}`)
}

const videoUrlToSave = storageResult.videoUrl  // ✅ ONLY permanent URL
```

### **3. Validar URL Permanente**

```typescript
// ✅ Verifica se URL é permanente
const isPermanentUrl = videoUrlToSave.includes('amazonaws.com') || 
                      videoUrlToSave.includes('cloudfront.net') ||
                      videoUrlToSave.includes('s3')

if (!isPermanentUrl) {
  throw new Error(`Generated URL is not permanent: ${videoUrlToSave}`)
}
```

### **4. Marcar como FAILED se Storage Falhar**

**Antes:**
```typescript
// ❌ Salvava URL temporária se storage falhasse
await updateVideoGenerationByJobId(
  jobId,
  VideoStatus.COMPLETED,  // ❌ Marcava como COMPLETED
  videoUrl,  // ❌ URL temporária
  undefined,
  undefined,
  { temporaryVideoUrl: videoUrl, storageError: true }
)
```

**Depois:**
```typescript
// ✅ Marca como FAILED se storage falhar
await prisma.videoGeneration.update({
  where: { id: updatedVideo.id },
  data: {
    status: 'FAILED',  // ✅ FAILED, não COMPLETED
    errorMessage: `Storage failed: ${errorMsg}`,
    metadata: {
      storageError: true,
      temporaryVideoUrl: videoUrl,  // Salva apenas em metadata
      failedAt: new Date().toISOString()
    }
  }
})
```

### **5. Simplificar Lógica de Metadata**

**Antes:**
```typescript
// ❌ Metadata diferente dependendo do sucesso do storage
if (storageResult.success && isPermanentUrl) {
  updateData.metadata.stored = true
  updateData.metadata.sizeBytes = storageResult.sizeBytes
} else {
  updateData.metadata.stored = false
  updateData.metadata.storageFailed = true
  updateData.metadata.isTemporaryUrl = true
}
```

**Depois:**
```typescript
// ✅ Metadata sempre indica sucesso (só chega aqui se storage funcionou)
updateData.metadata.storageProvider = 'aws'
updateData.metadata.stored = true
updateData.metadata.sizeBytes = storageResult.sizeBytes
// Se falhar, lança exceção antes de chegar aqui
```

---

## 📊 Comparação: Antes vs Depois

### ❌ **ANTES (Salvava Link Provisório)**

```
1. Webhook recebe sucesso do Replicate
   ↓
2. ❌ Salva videoUrl = "https://replicate.delivery/pbxt/..."
   ↓
3. Tenta fazer storage no S3
   ↓
4. Storage retorna URL permanente
   ↓
5. ❌ Tenta atualizar videoUrl (mas pode falhar ou ser ignorado)
   ↓
6. ❌ Banco fica com link provisório que expira em 24h
```

### ✅ **DEPOIS (Apenas Link Permanente)**

```
1. Webhook recebe sucesso do Replicate
   ↓
2. ✅ NÃO salva videoUrl ainda (apenas status e metadata)
   ↓
3. Faz storage no S3
   ↓
4. ✅ SE storage SUCESSO:
      → Salva videoUrl = "https://d2df849qfdugnh.cloudfront.net/..."
   ↓
5. ✅ SE storage FALHA:
      → Marca vídeo como FAILED
      → NÃO salva videoUrl
      → Salva URL temporária apenas em metadata (para debug)
```

---

## 🎯 Garantias da Solução

1. ✅ **Nunca salva link provisório do Replicate em `videoUrl`**
2. ✅ **Apenas salva URL permanente do CloudFront/S3**
3. ✅ **Valida que URL é permanente antes de salvar**
4. ✅ **Marca como FAILED se storage falhar**
5. ✅ **Notifica usuário em caso de falha**
6. ✅ **URL temporária salva apenas em metadata (para debug)**

---

## 🧪 Como Testar

### **Teste 1: Geração de Vídeo com Sucesso**

1. Gere um vídeo normalmente
2. Aguarde conclusão
3. **Verificar no banco:**
   ```sql
   SELECT 
     id, 
     status, 
     videoUrl, 
     thumbnailUrl,
     metadata->>'stored' as stored,
     metadata->>'temporaryVideoUrl' as temp_url
   FROM "video_generations"
   WHERE id = 'VIDEO_ID'
   ORDER BY "createdAt" DESC
   LIMIT 1;
   ```
4. **Esperado:**
   - `status` = `COMPLETED`
   - `videoUrl` = `https://d2df849qfdugnh.cloudfront.net/...` ✅ CloudFront
   - `stored` = `true`
   - `temp_url` = `https://replicate.delivery/...` (apenas em metadata)

### **Teste 2: Falha no Storage**

1. Simular falha no storage (desabilitar AWS temporariamente)
2. Gerar vídeo
3. **Verificar no banco:**
   ```sql
   SELECT id, status, videoUrl, errorMessage
   FROM "video_generations"
   WHERE id = 'VIDEO_ID';
   ```
4. **Esperado:**
   - `status` = `FAILED` ✅
   - `videoUrl` = `NULL` ✅ (não salva provisório)
   - `errorMessage` = `Storage failed: ...`

### **Teste 3: Logs do Webhook**

Verificar logs no Vercel:
```
💾 [WEBHOOK_VIDEO] Updating database with PERMANENT URL: https://d2df849qfdugnh.cloudfront.net/...
✅ [WEBHOOK_VIDEO] Video stored successfully: https://d2df849qfdugnh.cloudfront.net/...
```

**NÃO deve aparecer:**
```
⚠️ [WEBHOOK_VIDEO] Storage failed, saving temporary URL
```

---

## 📝 Arquivos Modificados

1. ✅ `src/app/api/webhooks/video/route.ts`
   - Linha 420: Removido salvamento de `videoUrl` temporária
   - Linha 431: Removido salvamento de `videoUrl` temporária (fallback)
   - Linha 651-659: Validação de URL permanente
   - Linha 724-784: Simplificado metadata (apenas sucesso)
   - Linha 850-874: Marcar como FAILED se storage falhar

2. ✅ `docs/VIDEO_PERMANENT_URL_FIX.md` (este arquivo)
   - Documentação completa da solução

---

## 🔍 Verificação de Links Existentes

Se já existem vídeos com links provisórios no banco, executar:

```sql
-- Verificar vídeos com links provisórios
SELECT 
  id, 
  status, 
  videoUrl,
  "createdAt"
FROM "video_generations"
WHERE videoUrl LIKE '%replicate.delivery%'
  OR videoUrl LIKE '%pbxt%'
ORDER BY "createdAt" DESC;
```

**Ação:** Marcar esses vídeos como FAILED ou regenerar:
```sql
-- Marcar como FAILED vídeos com link provisório
UPDATE "video_generations"
SET 
  status = 'FAILED',
  errorMessage = 'Storage failed - temporary URL expired'
WHERE videoUrl LIKE '%replicate.delivery%'
  OR videoUrl LIKE '%pbxt%';
```

---

## 🚀 Deploy

Após fazer deploy:
1. Gerar novo vídeo de teste
2. Verificar que URL salva é do CloudFront
3. Verificar que vídeo é acessível permanentemente
4. Limpar vídeos antigos com URLs provisórias

---

**Data**: 24/12/2025  
**Status**: ✅ Implementado e Documentado

**Garantia:** Nunca mais salva links provisórios do Replicate! 🎯

