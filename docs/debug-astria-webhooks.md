# 🔍 Guia de Debugging - Callbacks do Astria

## 📋 Checklist de Verificação

### 1. Verificar se o Callback foi Chamado

**Nos logs do Vercel, procure por:**
```
📥 [WEBHOOK_ASTRIA] Webhook request received
```

**Se NÃO aparecer:**
- O Astria não está chamando o callback
- Verifique se o callback URL está correto na resposta do Astria
- Verifique se o endpoint está acessível publicamente (HTTPS)

### 2. Verificar Tipo de Webhook

**Para TUNE (treinamento):**
```
🔍 [WEBHOOK_ASTRIA] URL parameters extracted: { webhookType: 'TUNE', userId: '...', tuneId: '...' }
```

**Para PROMPT (geração):**
```
🔍 [WEBHOOK_ASTRIA] URL parameters extracted: { webhookType: 'PROMPT', promptId: '...' }
```

### 3. Verificar Payload do Astria

**Procure por:**
```
📋 Astria webhook payload: { id: ..., status: ..., object: 'tune' | 'prompt', ... }
```

**Verifique:**
- `id`: Deve corresponder ao `tune_id` ou `prompt_id`
- `status`: Deve ser `trained` (TUNE) ou `generated` (PROMPT)
- `object`: Deve ser `tune` ou `prompt`

### 4. Verificar Busca no Banco de Dados

**Para TUNE:**
```
🔍 [WEBHOOK_ASTRIA_TUNE] Processing tune webhook: { tuneId: '...', userId: '...' }
```

**Para PROMPT:**
```
🔍 [WEBHOOK_ASTRIA_PROMPT] Looking for generation with prompt_id: { promptId: '...' }
```

**Se aparecer:**
```
❌ [WEBHOOK_ASTRIA] CRITICAL: No generation found for Astria prompt: ...
```

**Problema:** O `prompt_id` do Astria não corresponde ao `jobId` armazenado no banco.

**Solução:**
1. Verifique se o `jobId` foi salvo corretamente na criação da geração
2. Verifique se o `prompt_id` do Astria corresponde ao `jobId` salvo
3. Verifique se há gerações com status `PROCESSING` nas últimas 24h

### 5. Verificar Extração de IDs das URLs

**Procure por:**
```
🔍 [WEBHOOK_ASTRIA_PROMPT] Extracted IDs from Astria URL: { tuneId: '...', promptId: '...' }
```

**Se NÃO aparecer:**
- O payload não contém a URL do Astria
- Verifique se `payload.url` está presente

### 6. Verificar Armazenamento de Imagens

**Para PROMPT completado:**
```
💾 [WEBHOOK_ASTRIA] Storing X images permanently for generation: ...
📊 [WEBHOOK_ASTRIA] Storage result: { success: true, permanentUrlsCount: X }
```

**Se aparecer:**
```
❌ [WEBHOOK_ASTRIA] CRITICAL: Storage failed for generation ...
```

**Problema:** Falha ao salvar imagens no storage.

### 7. Verificar Atualização do Banco

**Procure por:**
```
✅ [WEBHOOK_ASTRIA] Generation updated successfully: { status: 'COMPLETED', ... }
```

**Se aparecer:**
```
❌ [WEBHOOK_ASTRIA] CRITICAL: Failed to update generation ...
```

**Problema:** Falha ao atualizar o registro no banco.

## 🔧 Ferramentas de Debug

### 1. Logs do Vercel

**Acesse:** Vercel Dashboard → Seu Projeto → Logs

**Filtros úteis:**
- `WEBHOOK_ASTRIA` - Todos os logs do webhook
- `WEBHOOK_ASTRIA_TUNE` - Logs de treinamento
- `WEBHOOK_ASTRIA_PROMPT` - Logs de geração
- `ASTRIA_CALLBACK` - Verificação de callbacks

### 2. Verificar Geração no Banco

**Query SQL:**
```sql
SELECT 
  id,
  "jobId",
  status,
  "imageUrls",
  metadata->>'tune_id' as tune_id,
  metadata->>'prompt_id' as prompt_id,
  metadata->>'webhookProcessed' as webhook_processed,
  "createdAt",
  "updatedAt"
FROM generations
WHERE status = 'PROCESSING'
ORDER BY "createdAt" DESC
LIMIT 10;
```

### 3. Verificar Modelo no Banco

**Query SQL:**
```sql
SELECT 
  id,
  "trainingJobId",
  status,
  "modelUrl",
  progress,
  "createdAt",
  "updatedAt"
FROM "ai_models"
WHERE status IN ('TRAINING', 'PROCESSING')
ORDER BY "createdAt" DESC
LIMIT 10;
```

## 🐛 Problemas Comuns

### Problema 1: Callback não é chamado

**Sintomas:**
- Não aparece `📥 [WEBHOOK_ASTRIA] Webhook request received` nos logs
- Geração fica em `PROCESSING` indefinidamente

**Possíveis causas:**
1. Callback URL incorreta ou inacessível
2. Astria não está enviando o callback
3. Endpoint não está acessível publicamente

**Solução:**
1. Verifique se `NEXTAUTH_URL` está configurado corretamente
2. Verifique se o endpoint `/api/webhooks/astria` está acessível
3. Verifique a resposta do Astria para confirmar o callback URL

### Problema 2: Geração não encontrada

**Sintomas:**
```
❌ [WEBHOOK_ASTRIA] CRITICAL: No generation found for Astria prompt: ...
```

**Possíveis causas:**
1. `jobId` não foi salvo corretamente
2. `prompt_id` do Astria não corresponde ao `jobId`
3. Geração foi deletada ou não existe

**Solução:**
1. Verifique se o `jobId` foi salvo na criação da geração
2. Compare o `prompt_id` do Astria com o `jobId` no banco
3. Verifique se há gerações recentes com status `PROCESSING`

### Problema 3: Imagens não são salvas

**Sintomas:**
```
❌ [WEBHOOK_ASTRIA] CRITICAL: Storage failed for generation ...
```

**Possíveis causas:**
1. Storage provider não configurado
2. Erro ao fazer upload das imagens
3. URLs temporárias do Astria expiraram

**Solução:**
1. Verifique a configuração do storage provider
2. Verifique os logs de erro do storage
3. Verifique se as URLs do Astria ainda estão acessíveis

## 📊 Exemplo de Logs de Sucesso

### TUNE (Treinamento)
```
📥 [WEBHOOK_ASTRIA] Webhook request received
🔍 [WEBHOOK_ASTRIA] URL parameters extracted: { webhookType: 'TUNE', userId: '...', tuneId: '...' }
📋 Astria webhook payload: { id: ..., status: 'trained', object: 'tune' }
🔍 [WEBHOOK_ASTRIA_TUNE] Processing tune webhook: { tuneId: '...', userId: '...' }
✅ Model ... successfully updated to status: READY
✅ [WEBHOOK_ASTRIA] Tune webhook processed successfully
```

### PROMPT (Geração)
```
📥 [WEBHOOK_ASTRIA] Webhook request received
🔍 [WEBHOOK_ASTRIA] URL parameters extracted: { webhookType: 'PROMPT', promptId: '...' }
📋 Astria webhook payload: { id: ..., status: 'generated', object: 'prompt' }
🔍 [WEBHOOK_ASTRIA_PROMPT] Looking for generation with prompt_id: { promptId: '...' }
🔍 [WEBHOOK_ASTRIA_PROMPT] Extracted IDs from Astria URL: { tuneId: '...', promptId: '...' }
💾 [WEBHOOK_ASTRIA] Storing X images permanently for generation: ...
✅ [WEBHOOK_ASTRIA] Successfully stored X images permanently
✅ [WEBHOOK_ASTRIA] Generation updated successfully
✅ [WEBHOOK_ASTRIA] Prompt webhook processed successfully
```

