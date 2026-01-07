# 🎯 Guia de Teste - Correção de Erro de Safety em Vídeos

## 📋 Resumo das Correções Implementadas

### ✅ Correções Aplicadas

1. **✅ Salvamento de créditos debitados**
   - O campo `creditsUsed` agora é salvo no `VideoGeneration` imediatamente após o débito
   - Isso permite rastreamento e estorno correto em caso de falha

2. **✅ Expansão de palavras-chave de detecção**
   - Adicionadas 20+ novas palavras-chave para detectar erros de safety/moderação
   - Inclui termos em inglês e português
   - Cobre variações como "safety system", "content moderation", "policy filter", etc.

3. **✅ Mensagens de erro melhoradas**
   - Mensagens mais claras e orientativas para o usuário
   - Todas as mensagens informam explicitamente que os créditos foram devolvidos
   - Mensagem específica para erro de safety orienta o usuário a revisar o prompt

4. **✅ Idempotência garantida**
   - O campo `creditsRefunded` previne duplicação de estorno
   - Atualização de `failureReason` mesmo em casos já processados
   - Logging detalhado para auditoria

---

## 🧪 Como Testar o Cenário de Erro de Safety

### Cenário 1: Simular Erro de Safety (Recomendado)

Para testar sem depender do provider real, você pode modificar temporariamente o código:

#### Opção A: Injetar erro no webhook

1. **Abra o arquivo** `src/app/api/webhooks/video/route.ts`

2. **Adicione este código logo após a linha 252** (após extrair o erro):

```typescript
// 🧪 TESTE: Simular erro de safety
if (process.env.TEST_SAFETY_ERROR === 'true' && replicateStatus === 'failed') {
  errorMessage = 'NSFW content detected: safety filter triggered by content policy violation'
  console.log('🧪 [TEST] Injecting safety error for testing')
}
```

3. **Configure a variável de ambiente** no seu `.env.local`:
```bash
TEST_SAFETY_ERROR=true
```

4. **Simule uma falha**:
   - Tente gerar um vídeo normalmente
   - Cancele o processamento manualmente no Replicate (ou espere timeout)
   - O webhook receberá status `failed` e o código acima injetará um erro de safety

#### Opção B: Usar um prompt que gere erro real

⚠️ **ATENÇÃO**: Isso vai consumir créditos do Replicate!

Use prompts que historicamente geram erros de moderação (sem ser explícito):
- `"person removing clothes"`
- `"adult content scene"`
- `"nsfw material"`

### Cenário 2: Testar Idempotência

1. **Gere um vídeo** com qualquer prompt
2. **Marque manualmente como falha no banco**:

```sql
-- Conecte no banco de dados
UPDATE "VideoGeneration" 
SET 
  status = 'FAILED',
  "errorMessage" = 'Test NSFW safety error',
  "creditsUsed" = 50
WHERE id = 'VIDEO_ID_AQUI';
```

3. **Chame o endpoint de webhook manualmente** ou use o polling
4. **Verifique que**:
   - O estorno só ocorre uma vez
   - `creditsRefunded` é marcado como `true`
   - Se chamar novamente, não duplica o estorno

---

## ✅ Checklist de Validação

Após implementar e testar, valide cada item:

### ✅ Débito e Salvamento
- [ ] Créditos são debitados corretamente do usuário
- [ ] Campo `creditsUsed` é salvo no `VideoGeneration` após débito
- [ ] Se débito falhar, status é marcado como FAILED sem cobrar

### ✅ Detecção de Erro de Safety
- [ ] Erro com palavra "safety" é detectado como `SAFETY_BLOCKED`
- [ ] Erro com palavra "nsfw" é detectado como `SAFETY_BLOCKED`
- [ ] Erro com palavra "moderation" é detectado como `SAFETY_BLOCKED`
- [ ] Erro com palavra "policy violation" é detectado como `SAFETY_BLOCKED`
- [ ] Campo `failureReason` é salvo corretamente no banco

### ✅ Mensagem para o Usuário
- [ ] Toast/notificação aparece na UI com mensagem clara
- [ ] Mensagem menciona que os créditos foram devolvidos
- [ ] Para erro de safety, mensagem orienta a revisar o prompt
- [ ] Mensagem não é genérica ("erro desconhecido")

### ✅ Estorno de Créditos
- [ ] Créditos são automaticamente devolvidos
- [ ] Campo `creditsRefunded` é marcado como `true`
- [ ] Saldo do usuário é atualizado corretamente
- [ ] Transação de estorno é registrada no `CreditTransaction`

### ✅ Idempotência
- [ ] Se webhook disparar 2x, estorno só ocorre 1x
- [ ] Campo `creditsRefunded` previne duplicação
- [ ] Logs indicam "Credits already refunded" na segunda tentativa

### ✅ Broadcast/Notificação Real-Time
- [ ] Notificação SSE é enviada ao usuário
- [ ] Toast aparece automaticamente na UI
- [ ] Status do card de vídeo é atualizado para FAILED
- [ ] Mensagem de erro aparece no card

---

## 📊 Queries SQL Úteis para Debug

### Verificar estornos de um usuário
```sql
SELECT 
  vg.id,
  vg.status,
  vg."failureReason",
  vg."creditsUsed",
  vg."creditsRefunded",
  vg."errorMessage",
  vg."createdAt"
FROM "VideoGeneration" vg
WHERE vg."userId" = 'USER_ID_AQUI'
  AND vg.status = 'FAILED'
ORDER BY vg."createdAt" DESC
LIMIT 10;
```

### Verificar transações de crédito
```sql
SELECT 
  ct.id,
  ct.type,
  ct.source,
  ct.amount,
  ct.description,
  ct."balanceAfter",
  ct."createdAt"
FROM "CreditTransaction" ct
WHERE ct."userId" = 'USER_ID_AQUI'
  AND ct.type = 'REFUNDED'
ORDER BY ct."createdAt" DESC
LIMIT 10;
```

### Verificar saldo atual do usuário
```sql
SELECT 
  id,
  email,
  name,
  "creditsUsed",
  "creditsLimit",
  "creditsBalance",
  ("creditsLimit" - "creditsUsed" + "creditsBalance") as "totalAvailable"
FROM "User"
WHERE id = 'USER_ID_AQUI';
```

---

## 🔍 Como Identificar Problemas

### Problema: Créditos não foram devolvidos

**Verifique:**
1. Campo `creditsUsed` está preenchido no `VideoGeneration`?
   - Se NÃO: O débito de créditos não foi salvo corretamente
   - Se SIM: Continue

2. Campo `creditsRefunded` está `true`?
   - Se SIM: Estorno já foi feito (verifique `CreditTransaction`)
   - Se NÃO: Estorno não foi executado

3. Status é `FAILED`?
   - Se NÃO: O webhook não marcou como falha
   - Se SIM: Continue

4. Webhook chamou `handleVideoFailure`?
   - Procure nos logs: `[handleVideoFailure] Processing failure`
   - Se NÃO encontrar: Webhook não está chamando a função

### Problema: Erro não foi categorizado como SAFETY_BLOCKED

**Verifique:**
1. Mensagem de erro contém alguma palavra-chave?
   - Procure nos logs: `Safety error detected: keyword`
   - Se NÃO: Adicione a palavra-chave específica em `SAFETY_KEYWORDS`

2. A mensagem está sendo passada corretamente para `categorizeVideoError`?
   - Procure nos logs: `Categorized as: SAFETY_BLOCKED`

### Problema: Mensagem genérica na UI

**Verifique:**
1. O `failureReason` está sendo salvo no banco?
2. O broadcast está enviando o `failureReason` e `userMessage`?
3. A UI está usando o campo correto para exibir a mensagem?

---

## 🚀 Próximos Passos (Opcional)

### Melhorias Futuras

1. **Dashboard de Erros**
   - Criar página admin mostrando erros por categoria
   - Gráfico de erros de safety vs outros erros

2. **Validação Preventiva**
   - Adicionar validação de prompt no frontend antes de submeter
   - Usar API de moderação para pré-validar prompts

3. **Retry Automático**
   - Para erros temporários (timeout, network), tentar novamente automaticamente

4. **Notificação por Email**
   - Enviar email ao usuário informando falha e estorno
   - Incluir sugestões de como ajustar o prompt

---

## 📝 Logs Importantes

Ao testar, procure por estas mensagens nos logs:

### ✅ Sucesso
```
✅ [handleVideoFailure] Credits refunded successfully for video VIDEO_ID
💰 [handleVideoFailure] Refunding 50 credits to user USER_ID
📊 [handleVideoFailure] Categorized as: SAFETY_BLOCKED
```

### ⚠️ Avisos
```
⏭️ [handleVideoFailure] Credits already refunded for video VIDEO_ID, skipping
⏭️ [handleVideoFailure] Skipping refund for video VIDEO_ID: No credits to refund
```

### ❌ Erros
```
❌ [handleVideoFailure] Video VIDEO_ID not found
❌ [handleVideoFailure] Error processing failure: ERROR_MESSAGE
❌ [handleVideoFailure] Failed to refund credits: ERROR_MESSAGE
```

---

## 🎉 Conclusão

As correções implementadas garantem que:

1. ✅ **Usuário NUNCA perde créditos** quando não recebe o vídeo
2. ✅ **Mensagens claras** informam o motivo da falha
3. ✅ **Erro de safety é detectado** e tratado especificamente
4. ✅ **Estorno é automático e idempotente**
5. ✅ **Logs completos** facilitam debug e auditoria

Se todos os itens do checklist forem validados, o sistema está funcionando corretamente! 🚀

