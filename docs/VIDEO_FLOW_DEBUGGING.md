# 🔍 Sistema de Diagnóstico do Fluxo de Vídeo

Este documento explica como usar o sistema completo de diagnóstico para identificar exatamente onde o fluxo de geração de vídeo está quebrando.

## 📋 Ferramentas Disponíveis

### 1. Endpoint de Diagnóstico Completo

**GET `/api/video/diagnose/[id]`**

Executa uma verificação completa de todas as etapas do fluxo de vídeo.

**Exemplo de uso:**
```bash
curl -X GET "https://vibephoto.app/api/video/diagnose/cmixxxxxx" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Resposta:**
```json
{
  "success": true,
  "diagnostic": {
    "videoId": "cmixxxxxx",
    "jobId": "replicate-job-id",
    "overallStatus": "HEALTHY" | "BROKEN" | "INCOMPLETE",
    "stages": [
      {
        "stage": "1_RECORD_EXISTS",
        "status": "OK",
        "message": "Vídeo encontrado no banco de dados",
        "timestamp": "2025-11-19T15:00:00.000Z"
      },
      {
        "stage": "2_REQUIRED_FIELDS",
        "status": "OK",
        "message": "Todos os campos obrigatórios preenchidos"
      },
      // ... mais estágios
    ],
    "summary": {
      "totalStages": 10,
      "passed": 8,
      "warnings": 1,
      "errors": 0,
      "missing": 1
    },
    "recommendations": [
      "Preencher campos obrigatórios faltantes"
    ]
  }
}
```

### 2. Logs Estruturados no Webhook

O webhook agora gera logs estruturados em cada etapa do processamento.

**Logs disponíveis:**
- `WEBHOOK_RECEIVED` - Webhook recebido
- `PARSE_WEBHOOK_DATA` - Parse do JSON
- `UPDATE_DATABASE_INITIAL` - Atualização inicial do banco
- `DOWNLOAD_AND_STORE_VIDEO` - Download e armazenamento
- `GENERATE_THUMBNAIL` - Geração de thumbnail
- `UPDATE_DATABASE_FINAL` - Atualização final do banco
- `WEBHOOK_COMPLETE` - Webhook finalizado

**Formato dos logs:**
```
🔵 [FLOW_STAGE_NAME] START - videoId - jobId
✅ [FLOW_STAGE_NAME] SUCCESS - message (duration ms)
❌ [FLOW_STAGE_NAME] ERROR - message
⚠️ [FLOW_STAGE_NAME] WARNING - message
```

**Resposta do webhook inclui:**
```json
{
  "success": true,
  "videoId": "cmixxxxxx",
  "status": "COMPLETED",
  "logs": {
    "total": 7,
    "success": 6,
    "errors": 0,
    "warnings": 1,
    "stages": [
      {
        "stage": "WEBHOOK_RECEIVED",
        "status": "SUCCESS",
        "message": "Webhook recebido e parseado",
        "duration": 5
      }
      // ... mais estágios
    ]
  },
  "processingTime": 1234
}
```

## 🔍 Estágios Verificados

### Stage 1: RECORD_EXISTS
Verifica se o vídeo existe no banco de dados.

**Status esperado:** `OK`

### Stage 2: REQUIRED_FIELDS
Verifica campos obrigatórios:
- `userId` ✅ obrigatório
- `prompt` ✅ obrigatório
- `duration` ⚠️ opcional (usa default)
- `aspectRatio` ⚠️ opcional (usa default)
- `quality` ⚠️ opcional (usa default)

**Status esperado:** `OK` ou `WARNING`

### Stage 3: JOB_ID
Verifica se `jobId` está preenchido.

**Status esperado:** `OK` (se vídeo foi enviado ao Replicate)

### Stage 4: STATUS
Verifica se o status é válido e consistente:
- Status válidos: `STARTING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`
- Se `COMPLETED`, verifica se `videoUrl` está preenchido

**Status esperado:** `OK`

### Stage 5: URLS
Verifica URLs:
- `videoUrl` deve estar preenchido se status é `COMPLETED`
- `videoUrl` deve ser URL permanente (S3) se status é `COMPLETED`
- `thumbnailUrl` é opcional mas recomendado

**Status esperado:** `OK` ou `WARNING`

### Stage 6: STORAGE
Verifica campos de storage:
- `storageProvider` ✅ obrigatório se vídeo está em S3
- `publicUrl` ✅ obrigatório se vídeo está em S3
- `storageKey` ⚠️ opcional mas útil
- `mimeType` ⚠️ opcional mas útil

**Status esperado:** `OK` ou `WARNING`

### Stage 7: TIMESTAMPS
Verifica timestamps:
- `createdAt` ✅ obrigatório
- `updatedAt` ✅ obrigatório
- `processingCompletedAt` ✅ obrigatório se `COMPLETED`
- `processingStartedAt` ⚠️ opcional mas útil

**Status esperado:** `OK` ou `WARNING`

### Stage 8: METADATA
Verifica metadata JSON:
- `metadata.stored` ⚠️ recomendado
- `metadata.processedAt` ⚠️ recomendado
- `metadata.originalUrl` ou `temporaryVideoUrl` ⚠️ recomendado

**Status esperado:** `OK` ou `WARNING`

### Stage 9: VIDEO_ACCESSIBLE
Verifica se o vídeo está acessível via HTTP.

**Status esperado:** `OK`

### Stage 10: THUMBNAIL_ACCESSIBLE
Verifica se o thumbnail está acessível via HTTP.

**Status esperado:** `OK` ou `WARNING` (thumbnail é opcional)

## 🚨 Interpretando Resultados

### Status `HEALTHY`
✅ Todos os estágios críticos passaram. O vídeo deve funcionar corretamente.

### Status `INCOMPLETE`
⚠️ Alguns campos opcionais estão faltando, mas o vídeo deve funcionar. Revisar warnings.

### Status `BROKEN`
❌ Erros críticos encontrados. O vídeo não funcionará corretamente até corrigir.

## 📊 Exemplo de Diagnóstico Completo

```json
{
  "overallStatus": "BROKEN",
  "stages": [
    {
      "stage": "1_RECORD_EXISTS",
      "status": "OK",
      "message": "Vídeo encontrado no banco de dados"
    },
    {
      "stage": "4_STATUS",
      "status": "ERROR",
      "message": "Status é COMPLETED mas videoUrl não está preenchido"
    },
    {
      "stage": "5_URLS",
      "status": "ERROR",
      "message": "videoUrl não preenchido para vídeo COMPLETED"
    }
  ],
  "summary": {
    "totalStages": 10,
    "passed": 3,
    "warnings": 2,
    "errors": 2,
    "missing": 3
  },
  "recommendations": [
    "Corrigir erros críticos antes de continuar",
    "Preencher campos obrigatórios faltantes"
  ]
}
```

## 🔧 Como Usar Quando Há Erro

1. **Identificar o vídeo com problema:**
   - Pegar o `videoId` da URL ou do banco de dados

2. **Executar diagnóstico:**
   ```bash
   GET /api/video/diagnose/{videoId}
   ```

3. **Analisar os estágios:**
   - Verificar qual estágio retornou `ERROR` ou `MISSING`
   - Ler a `message` para entender o problema
   - Verificar o `data` para detalhes adicionais

4. **Verificar logs do webhook:**
   - Os logs do webhook mostram exatamente onde o processamento parou
   - Cada etapa tem timestamp e duração
   - Erros incluem stack trace completo

5. **Corrigir o problema:**
   - Usar as `recommendations` do diagnóstico
   - Verificar se o problema é no webhook, storage, ou banco de dados

## 📝 Campos Críticos para o Fluxo

### Campos OBRIGATÓRIOS para vídeo COMPLETED:
- ✅ `status = 'COMPLETED'`
- ✅ `videoUrl` (URL permanente S3)
- ✅ `jobId`
- ✅ `processingCompletedAt`
- ✅ `storageProvider = 'aws'`
- ✅ `publicUrl` (igual ao videoUrl)
- ✅ `updatedAt`

### Campos RECOMENDADOS:
- ⚠️ `thumbnailUrl`
- ⚠️ `storageKey`
- ⚠️ `mimeType`
- ⚠️ `sizeBytes`
- ⚠️ `durationSec`
- ⚠️ `processingStartedAt`

## 🎯 Checklist de Verificação Rápida

Quando um vídeo não aparece na galeria ou preview:

1. ✅ Vídeo existe no banco? → Stage 1
2. ✅ Status é `COMPLETED`? → Stage 4
3. ✅ `videoUrl` está preenchido? → Stage 5
4. ✅ `videoUrl` é URL permanente (S3)? → Stage 5
5. ✅ Vídeo está acessível via HTTP? → Stage 9
6. ✅ Campos de storage preenchidos? → Stage 6
7. ✅ Timestamps corretos? → Stage 7

Se todos passarem, o vídeo deve aparecer corretamente.

