# Correção do Sistema de Tratamento de Erros de Vídeo

## 📋 Contexto do Problema

Um usuário tentou gerar um vídeo e a resposta do Replicate retornou erro por "conteúdo sensível / safety / moderation". Os problemas identificados foram:

1. ❌ A UI mostrou apenas "erro" genérico, sem explicar o motivo
2. ❌ Os créditos foram debitados mesmo sem entrega do vídeo
3. ❌ Não havia categorização dos tipos de erro
4. ❌ Não havia estorno automático de créditos

## ✅ Solução Implementada

### 1. Schema do Banco de Dados

**Arquivo:** `prisma/schema.prisma`

Adicionados dois novos campos ao modelo `VideoGeneration`:

```prisma
failureReason String?  // Categorias: SAFETY_BLOCKED, PROVIDER_ERROR, STORAGE_ERROR, etc.
creditsRefunded Boolean @default(false)  // Para garantir idempotência
```

**Migração:** `prisma/migrations/20250106_add_video_failure_tracking.sql`

Execute:
```bash
npx prisma db push
# ou
psql -U postgres -d vibephoto < prisma/migrations/20250106_add_video_failure_tracking.sql
```

### 2. Sistema de Detecção e Tratamento de Erros

**Arquivo:** `src/lib/video/error-handler.ts` (NOVO)

#### Funcionalidades:

✅ **Categorização Automática de Erros:**
- `SAFETY_BLOCKED` - Conteúdo bloqueado por moderação
- `PROVIDER_ERROR` - Erro do Replicate/modelo
- `STORAGE_ERROR` - Falha ao armazenar vídeo
- `TIMEOUT_ERROR` - Timeout de processamento
- `QUOTA_ERROR` - Limite do provider excedido
- `NETWORK_ERROR` - Erro de conectividade
- `INVALID_INPUT` - Input inválido
- `UNKNOWN_ERROR` - Erro desconhecido

✅ **Mensagens Amigáveis:**
Cada categoria tem uma mensagem específica e orientativa para o usuário.

Exemplo para SAFETY_BLOCKED:
```
"Não foi possível gerar o vídeo porque o conteúdo do prompt foi bloqueado 
pela política de segurança do sistema. Por favor, ajuste o texto do prompt 
e tente novamente."
```

✅ **Estorno Automático com Idempotência:**
```typescript
await handleVideoFailure(videoId, errorMessage)
```
- Detecta o tipo de erro
- Faz estorno automático de créditos
- Marca o vídeo como `creditsRefunded: true`
- Garante que estorno só ocorre UMA vez (idempotência)
- Registra logs completos para auditoria

### 3. Webhook de Vídeo Atualizado

**Arquivo:** `src/app/api/webhooks/video/route.ts`

Integração do sistema de tratamento de erros:

```typescript
// Quando status é FAILED
const errorHandlingResult = await handleVideoFailure(
  updatedVideo.id,
  errorMessage,
  { userId }
)

// Broadcast com informações detalhadas
await broadcastNotification(
  userId,
  errorHandlingResult.refunded 
    ? '❌ Falha na Geração de Vídeo - Créditos Devolvidos'
    : '❌ Falha na Geração de Vídeo',
  errorHandlingResult.userMessage,
  'error'
)
```

**Tratamento de erros de storage também incluído:**
- Se o vídeo é gerado mas falha ao salvar no S3
- Créditos são automaticamente devolvidos
- Usuário recebe notificação clara

### 4. API de Status Atualizada

**Arquivo:** `src/app/api/video/status/[id]/route.ts`

Agora retorna os novos campos:
```typescript
{
  // ... campos existentes
  failureReason: videoGeneration.failureReason,
  creditsRefunded: videoGeneration.creditsRefunded
}
```

### 5. Interface de Usuário Melhorada

**Arquivo:** `src/components/video/video-progress.tsx`

Exibição de erros específicos com ícones e cores:

```typescript
{status.failureReason === 'SAFETY_BLOCKED' && '🚫 Conteúdo Bloqueado'}
{status.failureReason === 'STORAGE_ERROR' && '💾 Erro de Armazenamento'}
{status.failureReason === 'PROVIDER_ERROR' && '⚙️ Erro do Serviço'}
// ... outras categorias
```

Indicador de estorno de créditos:
```
✅ Seus créditos foram automaticamente devolvidos
```

## 🧪 Como Testar

### 1. Executar Script de Teste

```bash
npx ts-node scripts/test-video-error-handling.ts
```

O script testa:
- ✅ Categorização correta de erros
- ✅ Mensagens amigáveis para cada categoria
- ✅ Lógica de detecção de necessidade de estorno
- ✅ Idempotência (prevenir estorno duplicado)
- ✅ Estatísticas do sistema

### 2. Testar Cenário Real

#### Cenário: Conteúdo Sensível

1. Tente gerar um vídeo com prompt que pode ser bloqueado
2. Aguarde o webhook do Replicate com erro de safety
3. Verifique:
   - ✅ Mensagem específica na UI
   - ✅ Créditos devolvidos automaticamente
   - ✅ Badge "Créditos Devolvidos" visível
   - ✅ Campo `failureReason` = "SAFETY_BLOCKED" no banco
   - ✅ Campo `creditsRefunded` = true no banco

#### Verificar no Banco:

```sql
-- Ver vídeos com falha e seus motivos
SELECT 
  id, 
  status, 
  "failureReason", 
  "creditsUsed", 
  "creditsRefunded",
  "errorMessage"
FROM "VideoGeneration"
WHERE status = 'FAILED'
ORDER BY "createdAt" DESC
LIMIT 10;

-- Ver estatísticas de erros
SELECT 
  "failureReason", 
  COUNT(*) as total,
  SUM(CASE WHEN "creditsRefunded" THEN 1 ELSE 0 END) as refunded
FROM "VideoGeneration"
WHERE status = 'FAILED'
GROUP BY "failureReason";
```

### 3. Verificar Logs

Procure por logs como:
```
🚨 Safety error detected: keyword "nsfw" found in error message
💰 [handleVideoFailure] Refunding 100 credits to user xyz
✅ [handleVideoFailure] Credits refunded successfully for video abc
⏭️ [handleVideoFailure] Credits already refunded, skipping (idempotência)
```

## 📊 Regras de Estorno

Os créditos são AUTOMATICAMENTE devolvidos quando:

1. ✅ Erro de safety/moderação (conteúdo bloqueado)
2. ✅ Erro do provider (falha do Replicate/modelo)
3. ✅ Erro de storage (vídeo gerado mas não salvo)
4. ✅ Timeout de processamento
5. ✅ Erro de quota/limite
6. ✅ Qualquer erro que impeça entrega do vídeo

**Exceção:** Créditos NÃO são devolvidos se:
- Vídeo foi gerado E salvo com sucesso
- URLs permanentes estão disponíveis
- Vídeo está acessível na galeria

## 🔒 Garantias de Segurança

### Idempotência
- Campo `creditsRefunded` previne estorno duplicado
- Webhook pode chegar múltiplas vezes sem problemas
- Sistema verifica antes de cada estorno

### Atomicidade
- Estorno usa transação do banco
- Se estorno falhar, vídeo não é marcado como refunded
- Logs completos para auditoria

### Rastreabilidade
- Cada estorno registra timestamp
- Motivo do erro é categorizado e salvo
- Metadata completa no banco de dados

## 📈 Monitoramento

### Métricas Importantes

```sql
-- Taxa de falha por categoria
SELECT 
  "failureReason",
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM "VideoGeneration" WHERE status = 'FAILED'), 2) as percentage
FROM "VideoGeneration"
WHERE status = 'FAILED' AND "failureReason" IS NOT NULL
GROUP BY "failureReason"
ORDER BY total DESC;

-- Créditos reembolsados (total)
SELECT 
  SUM("creditsUsed") as total_refunded
FROM "VideoGeneration"
WHERE "creditsRefunded" = true;

-- Vídeos que precisam de estorno (alerta)
SELECT COUNT(*) as needs_refund
FROM "VideoGeneration"
WHERE status = 'FAILED' 
  AND "creditsUsed" > 0 
  AND "creditsRefunded" = false;
```

## 🚀 Próximos Passos

1. ✅ Aplicar migração do banco
2. ✅ Executar script de teste
3. ✅ Monitorar logs em produção
4. ⏳ Ajustar mensagens baseado em feedback dos usuários
5. ⏳ Adicionar dashboard de métricas de erro

## 📝 Checklist de Validação

- [x] Schema atualizado com novos campos
- [x] Migração criada e documentada
- [x] Sistema de categorização de erros implementado
- [x] Estorno automático com idempotência
- [x] Webhook integrado com tratamento de erros
- [x] API de status retornando novos campos
- [x] UI exibindo mensagens específicas
- [x] Indicador de estorno de créditos na UI
- [x] Script de teste criado
- [x] Documentação completa
- [ ] Migração aplicada em produção
- [ ] Testes em ambiente real
- [ ] Monitoramento ativo

## 🎯 Resultado Esperado

Após implementação, quando um vídeo falhar:

1. ✅ **Usuário vê mensagem clara** explicando o motivo
2. ✅ **Créditos são devolvidos automaticamente**
3. ✅ **Status e motivo salvos corretamente** no banco
4. ✅ **Sem estorno duplicado** (idempotência garantida)
5. ✅ **Notificação em tempo real** via SSE/toast

Exemplo visual na UI:
```
┌─────────────────────────────────────────────┐
│ 🚫 Conteúdo Bloqueado                       │
│                                             │
│ Não foi possível gerar o vídeo porque o    │
│ conteúdo do prompt foi bloqueado pela      │
│ política de segurança do sistema.           │
│                                             │
│ Por favor, ajuste o texto e tente nova-   │
│ mente.                                      │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ ✅ Seus créditos foram automaticamente      │
│    devolvidos                                │
└─────────────────────────────────────────────┘
```

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs do webhook: `/api/webhooks/video`
2. Execute o script de teste: `npx ts-node scripts/test-video-error-handling.ts`
3. Consulte as queries SQL de monitoramento acima
4. Revise o arquivo `src/lib/video/error-handler.ts`

---

**Data de Implementação:** 06/01/2025  
**Versão:** 1.0.0  
**Status:** ✅ Implementado, aguardando testes em produção

