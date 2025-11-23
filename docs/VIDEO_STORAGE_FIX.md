# 🎥 Correção: Falha no Storage e Thumbnail de Vídeos

## 📋 Problema Identificado

Quando um vídeo era gerado com sucesso pelo Replicate, mas:
1. **O upload para o S3 falhava** (timeout, credenciais, bucket incorreto)
2. **A geração de thumbnail falhava** (FFmpeg não disponível no Vercel serverless)
3. **A URL temporária do Replicate era salva no banco** mesmo quando o upload falhava
4. **URLs de thumbnails inexistentes eram salvas** no banco de dados

Isso resultava em:
- ❌ Vídeos com URLs inválidas/expiradas no banco
- ❌ Thumbnails genéricos aparecendo (mulher loira) ao invés do vídeo real
- ❌ Experiência ruim para o usuário (vídeo "concluído" mas não funciona)

---

## ✅ Solução Implementada

### 1. **Melhor Tratamento de Erros no Download/Upload** (`src/lib/storage/utils.ts`)

**Antes:**
```typescript
// Erro era silencioso, URL do Replicate era salva mesmo quando falhava
```

**Depois:**
```typescript
// Logs detalhados em cada etapa:
console.log(`📥 [DOWNLOAD_VIDEO] Starting download for generation ${videoGenId}`)
console.log(`✅ [DOWNLOAD_VIDEO] Buffer created, size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`)
console.log(`☁️ [UPLOAD_VIDEO] Uploading to ${videoKey}`)
console.log(`✅ [UPLOAD_VIDEO] Video uploaded successfully`)

// Se falhar em QUALQUER etapa, retorna success: false
return {
  success: false,
  error: errorMsg
}
```

---

### 2. **Webhook NÃO Salva URL do Replicate se Storage Falhar** (`src/app/api/webhooks/video/route.ts`)

**Antes:**
```typescript
// Storage falhava mas URL temporária era salva no banco
console.log(`⚠️ Storage failed, but will still update database with temporary URL`)
```

**Depois:**
```typescript
// Se storage falhar, vídeo é marcado como FAILED
if (!storageResult.success) {
  console.error(`❌ Storage failed - marking video as FAILED in database`)
  
  await prisma.videoGeneration.update({
    where: { id: updatedVideo.id },
    data: {
      status: 'FAILED',
      errorMessage: `Storage failed: ${errorMsg}`,
      metadata: {
        storageError: errorMsg,
        storageFailed: true,
        temporaryVideoUrl: videoUrl, // Apenas para debug
        failedAt: new Date().toISOString()
      }
    }
  })
  
  return NextResponse.json({
    success: false,
    status: 'FAILED',
    error: `Storage failed: ${errorMsg}`
  })
}
```

---

### 3. **Fallback Inteligente para Thumbnails** (`src/lib/video/thumbnail-generator.ts`)

**Estratégias de Thumbnail (em ordem de prioridade):**

1. ✅ **Thumbnail do provedor** (Replicate/Kling forneceu)
2. ✅ **Extração de frame com FFmpeg** (se disponível)
3. 🆕 **Imagem de origem (`sourceImageUrl`)** (novo fallback)
4. ❌ **Erro** (não gera placeholder fake)

**Código Adicionado:**
```typescript
// Strategy 3: Use sourceImageUrl as fallback if available
const fallbackThumbnail = await tryUseSourceImageAsThumbnail(videoGenId)
if (fallbackThumbnail) {
  console.log(`✅ Using source image as thumbnail fallback: ${fallbackThumbnail}`)
  return {
    success: true,
    thumbnailUrl: fallbackThumbnail
  }
}

// Strategy 4: No thumbnail available (frontend will show video icon)
console.warn('⚠️ No thumbnail available - FFmpeg not available in serverless environment')
return {
  success: false,
  error: 'No thumbnail available: FFmpeg not available and no fallback image found'
}
```

**Nova Função Helper:**
```typescript
async function tryUseSourceImageAsThumbnail(videoGenId: string): Promise<string | null> {
  try {
    const video = await prisma.videoGeneration.findUnique({
      where: { id: videoGenId },
      select: { sourceImageUrl: true }
    })

    if (video?.sourceImageUrl) {
      console.log(`✅ Found source image for video ${videoGenId}`)
      return video.sourceImageUrl
    }

    return null
  } catch (error) {
    console.error('❌ Error fetching source image:', error)
    return null
  }
}
```

---

## 🔍 Logs Melhorados para Debug

Agora você verá logs detalhados no console:

```
📥 [DOWNLOAD_VIDEO] Starting download for generation abc123
📥 [DOWNLOAD_VIDEO] Video URL: https://replicate.delivery/...
✅ [DOWNLOAD_VIDEO] Download successful (200), content-type: video/mp4
✅ [DOWNLOAD_VIDEO] Buffer created, size: 12.34 MB
☁️ [UPLOAD_VIDEO] Uploading to generated/user123/videos/abc123_xyz.mp4
✅ [UPLOAD_VIDEO] Video uploaded successfully: https://cloudfront...
🖼️ Generating thumbnail for video abc123
⚠️ FFmpeg not available in serverless environment
✅ [THUMBNAIL_FALLBACK] Found source image for video abc123
✅ Using source image as thumbnail fallback
```

Se falhar:
```
❌ [DOWNLOAD_VIDEO] Fetch failed: timeout
❌ [DOWNLOAD_AND_STORE_VIDEO] Critical error: Failed to fetch video: timeout
❌ [DOWNLOAD_AND_STORE_VIDEO] Error details: { videoUrl: '...', videoGenId: 'abc123', userId: 'user123', error: 'timeout' }
❌ [WEBHOOK_VIDEO] Failed to store video: timeout
❌ Storage failed - marking video as FAILED in database
```

---

## 🎯 Resultado Final

### ✅ Comportamento Correto

1. **Vídeo gerado com sucesso e armazenado:**
   - ✅ URL permanente do CloudFront salva
   - ✅ Thumbnail gerado (ou sourceImageUrl como fallback)
   - ✅ Status: `COMPLETED`

2. **Vídeo gerado mas storage falhou:**
   - ❌ Sem URL no banco (não salva URL temporária do Replicate)
   - ❌ Status: `FAILED`
   - ❌ ErrorMessage: "Storage failed: [motivo]"
   - ℹ️ User é notificado do erro

3. **Thumbnail não disponível:**
   - ✅ Usa `sourceImageUrl` se disponível
   - ✅ Frontend exibe ícone de vídeo se nenhuma imagem disponível
   - ℹ️ Não salva URLs de thumbnails inválidas

---

## 🔧 Debugging em Produção

Se um vídeo falhar novamente:

1. **Verifique os logs do Vercel:**
   ```bash
   vercel logs --follow
   ```

2. **Procure por:**
   - `[DOWNLOAD_VIDEO]` - Falha no download do Replicate
   - `[UPLOAD_VIDEO]` - Falha no upload para S3
   - `[THUMBNAIL_FALLBACK]` - Fallback de thumbnail
   - `Storage failed - marking video as FAILED` - Confirmação de erro

3. **Verifique o banco de dados:**
   ```sql
   SELECT id, status, errorMessage, videoUrl, thumbnailUrl, metadata
   FROM "VideoGeneration"
   WHERE userId = 'user_id'
   ORDER BY createdAt DESC
   LIMIT 10;
   ```

4. **Metadados incluem:**
   - `storageError` - Motivo da falha
   - `storageFailed: true`
   - `temporaryVideoUrl` - URL original do Replicate (apenas para debug)
   - `failedAt` - Timestamp da falha

---

## 🚀 Próximos Passos (Opcional)

Se os erros persistirem, considere:

1. **Aumentar timeout do download:**
   ```typescript
   setTimeout(() => controller.abort(), 180000) // 3 minutos
   ```

2. **Retry automático com backoff:**
   ```typescript
   for (let attempt = 1; attempt <= 3; attempt++) {
     try {
       const result = await downloadAndStoreVideo(...)
       if (result.success) break
     } catch (error) {
       if (attempt === 3) throw error
       await sleep(attempt * 1000) // 1s, 2s, 3s
     }
   }
   ```

3. **Processar vídeos em fila (BullMQ/Inngest):**
   - Webhook apenas marca "PENDING"
   - Worker processa download/upload em background
   - Maior controle e retry logic

---

## 📚 Arquivos Modificados

1. ✅ `src/lib/storage/utils.ts` - Logs detalhados e tratamento de erro
2. ✅ `src/app/api/webhooks/video/route.ts` - Não salva URL se storage falhar
3. ✅ `src/lib/video/thumbnail-generator.ts` - Fallback para sourceImageUrl
4. ✅ `docs/VIDEO_STORAGE_FIX.md` - Esta documentação

