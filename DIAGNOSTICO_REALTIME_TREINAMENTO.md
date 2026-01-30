# 🔍 Diagnóstico: Atualização em Tempo Real do Treinamento

## Problema Reportado
- Modelo já está **READY** no banco de dados há muito tempo
- Interface ainda mostra **"Preparando..."** (~10 minutos)
- Atualização não acontece em tempo real

## 🔍 Checklist de Diagnóstico

### 1. Verificar Estado do Modelo no Banco de Dados

```sql
-- Ver o modelo mais recente e seu status
SELECT
  id,
  name,
  status,
  progress,
  "trainingJobId",
  "updatedAt",
  "trainedAt",
  "modelUrl"
FROM ai_models
ORDER BY "createdAt" DESC
LIMIT 5;
```

**Status esperado se treinamento terminou:**
- ✅ `status` = `'READY'`
- ✅ `progress` = `100`
- ✅ `trainedAt` deve ter timestamp
- ✅ `modelUrl` deve ter o tune_id

---

### 2. Verificar Logs do Webhook Astria

**No console do backend (Vercel/Railway logs)**, procure por:

```
📥 [WEBHOOK_ASTRIA] Webhook request received
🎯 Processing Astria tune webhook for model: [model_id]
✅ Model [model_id] successfully updated to status: READY, progress: 100%
📡 Broadcasting model status change for model [model_id]: READY
✅ Broadcast sent successfully for model [model_id]
```

**Se NÃO ver esses logs:**
- ❌ Webhook do Astria não está chegando
- Verificar callback URL configurado no treino
- Verificar se Astria está enviando webhooks

---

### 3. Verificar SSE (Server-Sent Events) no Frontend

**Abra DevTools Console na página de criação do modelo**

Procure por logs:

```javascript
// ✅ SSE conectado com sucesso:
"✅ SSE connection opened - event-driven system active"

// ✅ Recebendo heartbeats (a cada ~30s):
"📨 [useRealtimeUpdates] RAW SSE message received"

// ✅ Recebendo evento de status do modelo:
"📥 [useRealtimeUpdates] SSE event parsed: { type: 'model_status_changed', ... }"
```

**Se NÃO ver conexão SSE:**
- ❌ SSE não está conectado
- Verificar `/api/events/stream` endpoint
- Verificar se session do usuário está ativa

**Se NÃO ver evento `model_status_changed`:**
- ❌ Broadcast não está chegando
- Verificar se `broadcastModelStatusChange` está sendo chamado no webhook
- Verificar se `userId` está correto

---

### 4. Verificar Handler do Frontend

**Em `/models/create/page.tsx`, linha 132-165**

O handler `handlePendingModelStatus` deve ser chamado quando SSE recebe evento:

```typescript
useRealtimeUpdates({
  onModelStatusChange: (modelId, status, data) => {
    console.log('🎯 [CREATE_PAGE] Model status changed:', { modelId, status, data })

    if (modelId === pendingModelId) {
      handlePendingModelStatus(status, data)
    }
  }
})
```

**Logs esperados no console:**
```
🎯 [CREATE_PAGE] Model status changed: { modelId: '...', status: 'READY', data: {...} }
```

---

### 5. Verificar Endpoint SSE `/api/events/stream`

**Arquivo:** `src/app/api/events/stream/route.ts`

Deve estar:
- ✅ Mantendo conexões abertas
- ✅ Enviando heartbeats
- ✅ Broadcasting eventos para userId correto

**Teste manual:** Abrir em nova aba:
```
https://vibephoto.app/api/events/stream
```

**Deve ver:**
```
data: {"type":"connected","timestamp":"...","message":"SSE connected"}

data: {"type":"heartbeat","timestamp":"..."}
```

---

## 🔧 Soluções por Cenário

### Cenário 1: Webhook não está chegando

**Sintomas:**
- Modelo fica em `TRAINING` no banco
- Sem logs de webhook no backend

**Solução:**
1. Verificar callback URL no código que cria o treino
2. Verificar se Astria está enviando webhooks (Dashboard Astria)
3. Testar webhook manualmente com curl

---

### Cenário 2: Webhook chega mas broadcast não funciona

**Sintomas:**
- Modelo atualiza para `READY` no banco
- Logs mostram "Broadcasting..." mas SSE não recebe

**Solução:**
1. Verificar se `broadcastFunction` está configurada no SSE endpoint
2. Verificar se `userId` está correto no broadcast
3. Restart do servidor Next.js

---

### Cenário 3: SSE não conecta no frontend

**Sintomas:**
- Sem log "SSE connection opened" no console
- EventSource failing silently

**Solução:**
1. Verificar session do usuário (deve estar logado)
2. Verificar erros no Network tab (filtrar por `events/stream`)
3. Verificar CORS/cookies se usando domínio diferente

---

### Cenário 4: SSE conecta mas não recebe eventos

**Sintomas:**
- SSE conectado (vê heartbeats)
- Não recebe `model_status_changed` event

**Solução:**
1. Verificar se `userId` no broadcast === `userId` na sessão SSE
2. Verificar logs do broadcast no backend
3. Adicionar debug logs no handler SSE

---

### Cenário 5: Frontend recebe evento mas não atualiza UI

**Sintomas:**
- Log "Model status changed" aparece
- UI não atualiza (fica em "Preparando...")

**Solução:**
1. Verificar se `pendingModelId` está setado corretamente
2. Verificar se `handlePendingModelStatus` está sendo chamado
3. Verificar estado React (useState pode não estar atualizando)

---

## 🚀 Solução Rápida (Quick Fix)

Se precisar de solução imediata enquanto investiga:

### Adicionar Polling como Fallback

Em `/models/create/page.tsx`, adicionar polling de status:

```typescript
// Polling fallback a cada 10s se modelo está em treinamento
useEffect(() => {
  if (!pendingModelId || !pendingModelStatus) return
  if (['READY', 'ERROR'].includes(pendingModelStatus)) return

  const pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/models/${pendingModelId}/status`)
      const data = await res.json()

      if (data.status === 'READY') {
        handlePendingModelStatus('READY', data)
        clearInterval(pollInterval)
      } else if (data.status === 'ERROR') {
        handlePendingModelStatus('ERROR', data)
        clearInterval(pollInterval)
      }
    } catch (err) {
      console.error('Polling error:', err)
    }
  }, 10000) // 10s

  return () => clearInterval(pollInterval)
}, [pendingModelId, pendingModelStatus])
```

**Criar endpoint `/api/models/[id]/status`:**

```typescript
// src/app/api/models/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const model = await prisma.aIModel.findFirst({
    where: {
      id: params.id,
      userId: session.user.id
    },
    select: {
      id: true,
      status: true,
      progress: true,
      errorMessage: true,
      modelUrl: true,
      trainedAt: true
    }
  })

  if (!model) {
    return NextResponse.json({ error: 'Model not found' }, { status: 404 })
  }

  return NextResponse.json(model)
}
```

---

## 📊 Logs para Coletar

Ao reportar o problema, incluir:

1. **Logs do webhook Astria** (últimos 50 linhas)
2. **Console do browser** (Network tab + Console logs)
3. **Query SQL do modelo** mostrando status atual
4. **Timestamp de quando criou o modelo** vs **quando ficou READY** no banco

---

## ✅ Resultado Esperado Final

Quando tudo funciona:

1. **Webhook chega** (< 1min após treino terminar no Astria)
2. **Banco atualiza** para `READY` imediatamente
3. **Broadcast SSE** envia evento em **< 1 segundo**
4. **Frontend recebe** evento e atualiza UI **instantaneamente**
5. **Usuário vê** "Treinamento concluído! Abrindo seus modelos..." e **redirect automático**

**Tempo total: < 2 segundos** entre Astria terminar treino e usuário ver confirmação.

Se está demorando **10 minutos**, algo está quebrado no fluxo acima.
