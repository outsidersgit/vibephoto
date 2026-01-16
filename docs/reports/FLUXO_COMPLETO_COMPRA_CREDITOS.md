# Fluxo Completo: Compra de Pacotes de Créditos

## 📋 Visão Geral do Fluxo

```
1. Usuário escolhe pacote → 2. Checkout Asaas → 3. Pagamento confirmado
   ↓                                                        ↓
4. Webhook recebe confirmação → 5. Atualiza DB → 6. Adiciona créditos
   ↓                                    ↓                    ↓
7. CreditsBalance incrementado → 8. Interface atualiza → 9. Usuário usa créditos
```

---

## 🔍 1. Escolha do Pacote (Checkout)

**Arquivo:** `src/lib/services/asaas-checkout-service.ts` - `createCreditPackageCheckout()`

**O que acontece:**
1. ✅ Valida usuário e pacote
2. ✅ Cria checkout no Asaas
3. ✅ **Cria CreditPurchase PENDING no banco** com:
   - `asaasCheckoutId`: ID do checkout
   - `packageName`: Nome do pacote
   - `creditAmount`: Quantidade de créditos
   - `value`: Valor do pacote
   - `status: 'PENDING'`
4. ✅ Verifica se há checkout PENDING recente (últimas 2 horas) e reutiliza se existir

**Pontos críticos:**
- ✅ CreditPurchase é criado ANTES do pagamento (para rastreamento)
- ✅ Não adiciona créditos ainda (aguarda confirmação)

---

## 💳 2. Confirmação de Pagamento (Webhook)

**Arquivo:** `src/app/api/payments/asaas/webhook/enhanced/route.ts` - `handlePaymentSuccess()`

**Evento:** Asaas envia webhook `PAYMENT_CONFIRMED` (sem `subscription`)

**O que acontece:**

### 2.1. Busca CreditPurchase Original
- ✅ Busca por `userId + asaasCheckoutId = payment.externalReference + status PENDING`
- ✅ Fallback: Extrai `creditAmount` do `externalReference` ou `description`

### 2.2. Atualiza CreditPurchase
- ✅ Atualiza `status: 'PENDING'` → `'CONFIRMED'`
- ✅ Adiciona `asaasPaymentId`
- ✅ Salva `confirmedAt`

### 2.3. Adiciona Créditos
- ✅ Verifica se `status` era `PENDING` antes do update (evita duplicação)
- ✅ Incrementa `creditsBalance` do usuário
- ✅ Cria `CreditTransaction` (EARNED, source: PURCHASE)
- ✅ Atualiza `balanceAfter` na transaction

### 2.4. Atualiza Payment
- ✅ Busca Payment PENDING por `userId + type: 'CREDIT_PURCHASE' + asaasCheckoutId`
- ✅ Atualiza para `CONFIRMED` ou cria novo se não existir

### 2.5. Broadcast SSE ✅ CORRIGIDO
- ✅ `broadcastCreditsUpdate()` - Atualiza badge de créditos
- ✅ `broadcastUserUpdate()` - Atualiza dados do usuário
- ✅ Frontend recebe atualização em tempo real

---

## 🔄 3. Atualização do Banco de Dados

**O que acontece:**

### 3.1. CreditPurchase
```typescript
await prisma.creditPurchase.update({
  where: { id: creditPurchase.id },
  data: {
    asaasPaymentId: payment.id,
    status: 'CONFIRMED',
    confirmedAt: new Date()
  }
})
```

### 3.2. User CreditsBalance
```typescript
await prisma.user.update({
  where: { id: user.id },
  data: {
    creditsBalance: { increment: creditPurchase.creditAmount }
  }
})
```

### 3.3. CreditTransaction
```typescript
await prisma.creditTransaction.create({
  data: {
    userId: user.id,
    type: 'EARNED',
    source: 'PURCHASE',
    amount: creditPurchase.creditAmount,
    description: `Compra de ${creditPurchase.packageName} - ${creditPurchase.creditAmount} créditos`,
    referenceId: payment.id,
    creditPurchaseId: creditPurchase.id,
    balanceAfter: userAfterUpdate.creditsBalance,
    metadata: {
      packageName: creditPurchase.packageName,
      packageId: creditPurchase.packageId,
      value: creditPurchase.value,
      asaasPaymentId: payment.id,
      billingType: payment.billingType
    }
  }
})
```

### 3.4. Payment
```typescript
await prisma.payment.update({
  where: { id: existingPayment.id },
  data: {
    asaasPaymentId: payment.id,
    status: 'CONFIRMED',
    confirmedDate: new Date()
  }
})
```

---

## 🚪 4. Liberação de Acesso

**Arquivo:** `src/middleware.ts`

**O que acontece:**
- ✅ Middleware verifica `subscriptionStatus` (não afeta compras de créditos)
- ✅ Usuário pode usar créditos comprados mesmo sem assinatura ativa
- ✅ `creditsBalance` é independente de `subscriptionStatus`

---

## 🔄 5. Atualização da Sessão/Token

**Arquivo:** `src/lib/auth.ts` - `callbacks.jwt`

**O que acontece:**
- ✅ Token JWT é atualizado via callback (a cada requisição)
- ✅ `creditsBalance` é refletido no token

---

## 📊 6. Disponibilização dos Créditos (Interface)

**Arquivo:** `src/app/api/credits/balance/route.ts`

**O que acontece:**

### 6.1. API de Balance
```typescript
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    creditsLimit: true,
    creditsUsed: true,
    creditsBalance: true, // Créditos comprados
    plan: true
  }
})

return {
  totalCredits: user.creditsLimit - user.creditsUsed + user.creditsBalance,
  subscriptionCredits: user.creditsLimit - user.creditsUsed,
  purchasedCredits: user.creditsBalance // Créditos comprados
}
```

### 6.2. Frontend (React Query + SSE)
- ✅ `useCreditBalance()` faz fetch de `/api/credits/balance`
- ✅ `useRealtimeUpdates()` escuta SSE para atualizar em tempo real
- ✅ Quando SSE recebe atualização, invalida queries e refaz fetch
- ✅ Interface atualiza automaticamente (sem F5)

---

## ✅ FLUXO COMPLETO VALIDADO

### Etapa 1: Escolha do Pacote
- ✅ Usuário escolhe pacote em `/credits`
- ✅ Checkout criado no Asaas
- ✅ CreditPurchase PENDING criado no banco

### Etapa 2: Confirmação de Pagamento
- ✅ Webhook recebe `PAYMENT_CONFIRMED`
- ✅ Busca CreditPurchase original
- ✅ Garante que créditos não sejam adicionados duplicados

### Etapa 3: Atualização do Banco
- ✅ CreditPurchase atualizado: `PENDING` → `CONFIRMED`
- ✅ `creditsBalance` incrementado
- ✅ CreditTransaction criada
- ✅ Payment atualizado: `PENDING` → `CONFIRMED`

### Etapa 4: Broadcast SSE
- ✅ `broadcastCreditsUpdate()` enviado ✅ CORRIGIDO
- ✅ `broadcastUserUpdate()` enviado ✅ CORRIGIDO
- ✅ Frontend recebe atualização em tempo real

### Etapa 5: Interface do Usuário
- ✅ Frontend recebe SSE
- ✅ React Query invalida queries
- ✅ `useCreditBalance()` refaz fetch
- ✅ Interface atualiza automaticamente (sem F5)
- ✅ Badge mostra créditos corretos

### Etapa 6: Funcionalidade
- ✅ Usuário pode usar créditos comprados
- ✅ `creditsBalance` é debitado ao usar
- ✅ `creditsLimit` (do plano) não é afetado

---

## 🛡️ Garantias Implementadas

### 1. Prevenção de Duplicação
- ✅ Verifica se `status` era `PENDING` antes de adicionar créditos
- ✅ Se já estava `CONFIRMED`, não adiciona novamente

### 2. CreditPurchase Sempre Encontrado
- ✅ Busca por `asaasCheckoutId`
- ✅ Fallback: Extrai `creditAmount` e cria novo registro

### 3. Payment Sempre Atualizado
- ✅ Busca Payment PENDING por `asaasCheckoutId`
- ✅ Se não encontrar, cria novo

### 4. Frontend Sempre Atualizado
- ✅ Broadcast SSE após adicionar créditos ✅ CORRIGIDO
- ✅ React Query invalida queries automaticamente
- ✅ Interface atualiza sem F5

---

## 📊 Resumo dos Fluxos Validados

| Fluxo | CreditPurchase → CONFIRMED | creditsBalance Incrementado | Payment Atualizado | Broadcast SSE |
|-------|----------------------------|----------------------------|-------------------|---------------|
| **Webhook Enhanced** | ✅ | ✅ | ✅ | ✅ **CORRIGIDO** |
| **Fallback (sem CreditPurchase)** | ✅ Criado | ✅ | ✅ | ✅ **CORRIGIDO** |

---

## 🎯 Conclusão

**Fluxo completo de compra de créditos está funcionando sem quebrar em nenhum ponto:**

- ✅ Escolha do pacote → Checkout criado
- ✅ Confirmação de pagamento → Webhook processado
- ✅ Atualização do banco → creditsBalance incrementado
- ✅ Broadcast SSE → Frontend atualiza automaticamente
- ✅ Interface mostra créditos → Usuário pode usar

**Todos os pontos críticos foram corrigidos e validados!** 🎉

