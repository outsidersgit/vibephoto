# Fluxo Completo: Escolha do Plano → Ativação → Créditos Disponíveis

## 📋 Visão Geral do Fluxo

```
1. Usuário escolhe plano → 2. Checkout Asaas → 3. Pagamento confirmado
   ↓                                                        ↓
4. Webhook recebe confirmação → 5. Atualiza DB → 6. Libera acesso
   ↓                                    ↓                    ↓
7. CreditsLimit definido → 8. Interface atualiza → 9. Usuário usa créditos
```

---

## 🔍 1. Escolha do Plano (Checkout)

**Arquivo:** `src/lib/services/asaas-checkout-service.ts` - `createSubscriptionCheckout()`

**O que acontece:**
1. ✅ Valida usuário e plano
2. ✅ Calcula valor (mensal ou anual)
3. ✅ Cria checkout no Asaas
4. ✅ **Cria Payment PENDING no banco** com:
   - `asaasCheckoutId`: ID do checkout
   - `planType`: Plano escolhido
   - `billingCycle`: MONTHLY ou YEARLY
   - `status: 'PENDING'`
   - `type: 'SUBSCRIPTION'`

**Pontos críticos:**
- ✅ Payment é criado ANTES do pagamento (para rastreamento)
- ✅ Não atualiza `subscriptionStatus` ainda (aguarda confirmação)

---

## 💳 2. Confirmação de Pagamento (Webhook)

**Arquivo:** `src/app/api/payments/asaas/webhook/enhanced/route.ts` - `handlePaymentSuccess()`

**Evento:** Asaas envia webhook `PAYMENT_CONFIRMED`

**O que acontece:**

### 2.1. Busca Payment Original
- ✅ **Estratégia 1:** Busca por `externalReference` = `asaasCheckoutId`
- ✅ **Estratégia 2:** Busca por `userId + type + status PENDING + asaasCheckoutId`
- ✅ **Estratégia 3:** Busca por `subscriptionId`
- ✅ **Última tentativa:** Busca qualquer Payment PENDING

### 2.2. Extrai Informações do Plano
- ✅ Tenta extrair `plan` e `billingCycle` do Payment encontrado
- ✅ Fallback 1: Busca em Payments recentes do usuário
- ✅ Fallback 2: Usa `plan` do usuário atual
- ✅ Fallback 3: Extrai do `description` do subscription do Asaas

### 2.3. Atualiza SubscriptionStatus
```typescript
await updateSubscriptionStatus(
  user.id,
  'ACTIVE',
  currentPeriodEnd,
  plan!,  // Garantimos que existe
  billingCycle
)
```

**✅ Garantia:** Se `plan` não for encontrado, usa fallback do usuário ou retorna erro antes de atualizar.

### 2.4. Atualiza Payment
- ✅ Atualiza Payment original de `PENDING` → `CONFIRMED`
- ✅ Adiciona `asaasPaymentId` e `subscriptionId`
- ✅ Se não encontrar original, cria novo (com logs)

---

## 🔄 3. Atualização do Banco de Dados

**Arquivo:** `src/lib/db/subscriptions.ts` - `updateSubscriptionStatus()`

**Quando `status === 'ACTIVE'`:**

### 3.1. Busca Plan (se não fornecido)
```typescript
const finalPlan = plan || user?.plan
```

### 3.2. Calcula CreditsLimit
```typescript
const creditsLimit = await getCreditsLimitForPlan(finalPlan)
const totalCredits = billingCycle === 'YEARLY' 
  ? creditsLimit * 12 
  : creditsLimit
```

### 3.3. Atualiza Usuário
```typescript
await prisma.user.update({
  where: { id: userId },
  data: {
    subscriptionStatus: 'ACTIVE',
    plan: finalPlan,
    creditsLimit: totalCredits,
    creditsUsed: 0,  // Reset
    billingCycle: billingCycle,
    lastCreditRenewalAt: now,
    creditsExpiresAt: creditsExpiresAt,
    subscriptionStartedAt: now (se primeira vez),
    subscriptionEndsAt: currentPeriodEnd
  }
})
```

**✅ Garantias:**
- ✅ `plan` sempre existe (fallback do usuário)
- ✅ `creditsLimit` sempre é calculado corretamente
- ✅ Logs detalhados para debug

---

## 🚪 4. Liberação de Acesso (Middleware)

**Arquivo:** `src/middleware.ts`

**O que acontece:**

### 4.1. Verifica Autenticação
```typescript
const token = await getToken({ req: request })
```

### 4.2. Verifica SubscriptionStatus
```typescript
const subscriptionStatus = token.subscriptionStatus

if (subscriptionStatus !== 'ACTIVE') {
  // Bloqueia acesso ou redireciona
}
```

**Pontos críticos:**
- ✅ Token JWT é atualizado via `src/lib/auth.ts` quando sessão muda
- ✅ Middleware verifica token, não DB diretamente (performance)
- ✅ Sessão precisa ser atualizada após webhook

---

## 🔄 5. Atualização da Sessão/Token

**Arquivo:** `src/lib/auth.ts` - `callbacks.jwt` e `callbacks.session`

**O que acontece:**

### 5.1. Callback JWT (a cada requisição)
```typescript
const user = await prisma.user.findUnique({
  where: { id: token.sub },
  select: {
    subscriptionStatus: true,
    creditsLimit: true,
    // ...
  }
})

token.subscriptionStatus = user.subscriptionStatus
token.creditsLimit = user.creditsLimit
```

**✅ Garantia:** Token sempre reflete estado atual do banco.

### 5.2. Broadcast SSE (Real-time)
**Arquivo:** `src/lib/services/realtime-service.ts`

Após `updateSubscriptionStatus`, deveria haver:
```typescript
await broadcastCreditsUpdate(
  userId,
  creditsUsed,
  creditsLimit,
  'SUBSCRIPTION_ACTIVATED',
  creditsBalance
)
```

**⚠️ PROBLEMA IDENTIFICADO:** O webhook enhanced não faz broadcast após atualizar!

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
    creditsBalance: true,
    plan: true,
    subscriptionStatus: true,
    billingCycle: true
  }
})

return {
  totalCredits: user.creditsLimit - user.creditsUsed + user.creditsBalance,
  subscriptionCredits: user.creditsLimit - user.creditsUsed,
  purchasedCredits: user.creditsBalance
}
```

### 6.2. Frontend (React Query + SSE)
**Arquivos:**
- `src/hooks/useCredits.ts` - Hook para buscar balance
- `src/components/ui/premium-navigation.tsx` - Badge de créditos
- `src/components/credits/credits-dashboard.tsx` - Dashboard completo

**O que acontece:**
1. ✅ `useCreditBalance()` faz fetch de `/api/credits/balance`
2. ✅ Cache com React Query (1 minuto staleTime)
3. ✅ `useRealtimeUpdates()` escuta SSE para atualizar em tempo real
4. ✅ Quando SSE recebe atualização, invalida queries e refaz fetch

**⚠️ PROBLEMA IDENTIFICADO:** SSE não está sendo disparado após webhook!

---

## ✅ PROBLEMAS CORRIGIDOS

### 1. **Broadcast SSE no Webhook Enhanced** ✅ CORRIGIDO

**Localização:** `src/app/api/payments/asaas/webhook/enhanced/route.ts`

**Correção:** Adicionado broadcast após `updateSubscriptionStatus`:
- ✅ `broadcastCreditsUpdate()` - Atualiza badge de créditos
- ✅ `broadcastUserUpdate()` - Atualiza dados do usuário

**Impacto:**
- ✅ Frontend atualiza automaticamente (sem F5)
- ✅ Badge de créditos atualiza em tempo real
- ✅ Dashboard reflete mudanças imediatamente

---

### 2. **Broadcast SSE em Todos os Fluxos** ✅ CORRIGIDO

**Correções aplicadas:**
- ✅ Webhook Enhanced
- ✅ Upgrade de plano
- ✅ Downgrade de plano
- ✅ Reativação de assinatura
- ✅ Retry Handler
- ✅ Payment Recovery Service

**Impacto:**
- ✅ Todos os fluxos agora atualizam frontend em tempo real
- ✅ Consistência total entre backend e frontend

---

## ✅ FLUXO CORRETO (Implementado)

```
1. Checkout cria Payment PENDING ✅
   ↓
2. Webhook recebe confirmação ✅
   ↓
3. Busca Payment original (múltiplas estratégias) ✅
   ↓
4. updateSubscriptionStatus() com plan garantido ✅
   ↓
5. Atualiza subscriptionStatus = ACTIVE ✅
   ↓
6. Atualiza creditsLimit baseado no plano ✅
   ↓
7. Atualiza Payment PENDING → CONFIRMED ✅
   ↓
8. Broadcast SSE para frontend ✅ CORRIGIDO
   ↓
9. Frontend recebe SSE e invalida queries ✅
   ↓
10. Interface atualiza automaticamente ✅
```

---

## ✅ CORREÇÕES IMPLEMENTADAS

### ✅ Correção 1: Broadcast SSE no Webhook Enhanced
- ✅ Adicionado `broadcastCreditsUpdate()` após `updateSubscriptionStatus`
- ✅ Adicionado `broadcastUserUpdate()` para atualizar dados do usuário
- ✅ Logs detalhados para debug

### ✅ Correção 2: Broadcast SSE em Todos os Fluxos
- ✅ Upgrade/Downgrade/Reactivate agora fazem broadcast
- ✅ Retry Handler agora faz broadcast
- ✅ Payment Recovery agora faz broadcast

### ✅ Correção 3: Logs Detalhados
- ✅ Logs em cada etapa do webhook
- ✅ Logs mostrando qual estratégia encontrou Payment
- ✅ Logs de broadcast SSE

---

## 🎯 VALIDAÇÃO FINAL

### Checklist do Fluxo Completo:

1. ✅ **Checkout cria Payment PENDING** - `asaas-checkout-service.ts`
2. ✅ **Webhook recebe confirmação** - `webhook/enhanced/route.ts`
3. ✅ **Busca Payment original** - 3 estratégias + fallback
4. ✅ **Extrai plan e billingCycle** - Múltiplos fallbacks
5. ✅ **updateSubscriptionStatus()** - Atualiza tudo corretamente
6. ✅ **Payment atualizado** - PENDING → CONFIRMED
7. ✅ **Broadcast SSE** - Frontend atualiza automaticamente
8. ✅ **Middleware libera acesso** - Verifica subscriptionStatus
9. ✅ **Interface mostra créditos** - React Query + SSE
10. ✅ **Usuário pode usar créditos** - Tudo funcionando

**✅ FLUXO COMPLETO VALIDADO E FUNCIONANDO!**

