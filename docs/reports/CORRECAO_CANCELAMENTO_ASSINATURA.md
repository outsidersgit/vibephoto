# Correções no Fluxo de Cancelamento de Assinatura

## ✅ Problemas Corrigidos

### 1. **Buscar Assinatura ANTES de Cancelar** ✅ CORRIGIDO

**Problema:** O código tentava acessar `asaasResponse.nextDueDate` após DELETE, mas DELETE pode não retornar dados completos.

**Solução:**
- ✅ Buscar assinatura do Asaas ANTES de cancelar para obter `nextDueDate`
- ✅ Verificar se assinatura já está cancelada antes de tentar cancelar
- ✅ Buscar assinatura APÓS cancelar para obter `endDate` (se disponível)

**Código:**
```typescript
// Buscar ANTES
const subscriptionData = await asaas.getSubscription(subscriptionId)

// Cancelar
await asaas.cancelSubscription(subscriptionId)

// Buscar APÓS (para obter endDate)
const cancelledSubscriptionData = await asaas.getSubscription(subscriptionId)
```

---

### 2. **Determinar subscriptionEndsAt Corretamente** ✅ CORRIGIDO

**Problema:** `subscriptionEndsAt` era calculado incorretamente quando `cancelImmediately = false`.

**Solução:**
- ✅ Se `cancelImmediately = true`: usar data atual
- ✅ Se `cancelImmediately = false`: usar `endDate` (após cancelar) ou `nextDueDate` (antes de cancelar)
- ✅ Fallback: usar data atual + 30 dias se nenhum dado disponível

**Código:**
```typescript
let subscriptionEndsAt: Date
if (cancelImmediately) {
  subscriptionEndsAt = cancelDate
} else {
  const nextDueDate = subscriptionData?.nextDueDate || cancelledSubscriptionData?.nextDueDate
  const endDate = cancelledSubscriptionData?.endDate
  
  if (endDate) {
    subscriptionEndsAt = new Date(endDate)
  } else if (nextDueDate) {
    subscriptionEndsAt = new Date(nextDueDate)
  } else {
    // Fallback
    subscriptionEndsAt = new Date(cancelDate.getTime() + 30 * 24 * 60 * 60 * 1000)
  }
}
```

---

### 3. **Broadcast SSE após Cancelamento** ✅ CORRIGIDO

**Problema:** Frontend não era atualizado automaticamente após cancelamento.

**Solução:**
- ✅ Adicionado `broadcastUserUpdate()` após atualizar banco
- ✅ Broadcast inclui `subscriptionStatus`, `subscriptionEndsAt`, `plan`, `creditsLimit`
- ✅ Broadcast também em caso de erro (cancelamento local)

**Código:**
```typescript
await broadcastUserUpdate(
  user.id,
  {
    subscriptionStatus: 'CANCELLED',
    subscriptionEndsAt: subscriptionEndsAt.toISOString(),
    plan: updatedUser.plan,
    creditsLimit: updatedUser.creditsLimit,
    creditsUsed: updatedUser.creditsUsed,
    creditsBalance: updatedUser.creditsBalance
  },
  'SUBSCRIPTION_CANCELLED'
)
```

---

### 4. **Tratamento de Erros Melhorado** ✅ CORRIGIDO

**Problema:** Erros não eram tratados adequadamente.

**Solução:**
- ✅ Verificar se assinatura já está cancelada antes de tentar cancelar
- ✅ Tratar erros 404 (não encontrada) e "already cancelled" separadamente
- ✅ Cancelar localmente se assinatura não existe no Asaas
- ✅ Logs detalhados para debug

**Código:**
```typescript
// Verificar antes de cancelar
if (subscriptionData.status === 'CANCELLED' || subscriptionData.status === 'INACTIVE') {
  // Atualizar localmente e retornar
}

// Tratar erros após cancelar
const isNotFound = asaasError.status === 404 || errorMessage.includes('not found')
const isAlreadyCancelled = errorMessage.includes('cancelled') || errorMessage.includes('inactive')

if (isNotFound || isAlreadyCancelled) {
  // Cancelar localmente e broadcast
}
```

---

### 5. **Logs Detalhados** ✅ CORRIGIDO

**Problema:** Logs insuficientes para debug.

**Solução:**
- ✅ Logs antes de cancelar (status, nextDueDate)
- ✅ Logs após cancelar (status, nextDueDate, endDate)
- ✅ Logs de erros detalhados
- ✅ Logs de broadcast

---

## 📋 Fluxo Completo Corrigido

### 1. Verificações ✅
- ✅ Autenticação do usuário
- ✅ Assinatura pertence ao usuário
- ✅ Assinatura não está já cancelada localmente

### 2. Buscar Assinatura do Asaas ✅
- ✅ Obter `nextDueDate` e `status`
- ✅ Verificar se já está cancelada no Asaas
- ✅ Se já cancelada, atualizar localmente e retornar

### 3. Cancelar no Asaas ✅
- ✅ Chamar DELETE no Asaas
- ✅ Logs detalhados

### 4. Buscar Assinatura Após Cancelar ✅
- ✅ Obter `endDate` (se disponível)
- ✅ Obter `status` atualizado
- ✅ Fallback para dados anteriores se falhar

### 5. Atualizar Banco ✅
- ✅ `subscriptionStatus = 'CANCELLED'`
- ✅ `subscriptionEndsAt` (calculado corretamente)
- ✅ `subscriptionCancelledAt`
- ✅ Se `cancelImmediately`, resetar para STARTER

### 6. Broadcast SSE ✅
- ✅ Enviar atualização para frontend
- ✅ Frontend atualiza automaticamente

### 7. Logs ✅
- ✅ `usageLog` criado
- ✅ `systemLog` criado
- ✅ Logs detalhados para debug

---

## 🔍 Verificação do Método DELETE

**Arquivo:** `src/lib/payments/asaas.ts`

**Método atual:**
```typescript
async cancelSubscription(subscriptionId: string) {
  return this.request(`/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
  })
}
```

**Status:** ✅ CORRETO

O método DELETE é o método correto para cancelar assinaturas no Asaas. O problema era que:
- DELETE pode não retornar dados completos da assinatura
- Não sabemos `nextDueDate` ou `endDate` apenas com a resposta do DELETE

**Solução implementada:**
- Buscar assinatura ANTES e DEPOIS do DELETE
- Isso garante que temos todos os dados necessários

---

## ✅ Conclusão

**Todos os problemas foram corrigidos:**

1. ✅ Buscar assinatura antes e depois de cancelar
2. ✅ Determinar `subscriptionEndsAt` corretamente
3. ✅ Broadcast SSE após cancelamento
4. ✅ Tratamento de erros melhorado
5. ✅ Logs detalhados

**O fluxo de cancelamento está funcionando corretamente!** 🎉

