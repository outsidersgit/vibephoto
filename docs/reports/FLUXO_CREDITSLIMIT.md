# Fluxo de Inserção/Atualização de `creditsLimit` na Tabela `users`

## Resumo Executivo

O campo `creditsLimit` da tabela `users` armazena o **limite de créditos da assinatura** do usuário. Este campo é atualizado em diferentes momentos do ciclo de vida da assinatura, sempre baseado no plano escolhido e no ciclo de cobrança (MONTHLY ou YEARLY).

---

## 📋 Função Base: `getCreditsLimitForPlan()`

**Localização:** `src/lib/constants/plans.ts`

Esta função busca o limite de créditos do plano no banco de dados (`subscription_plans.credits`) ou usa valores fallback hardcoded.

```typescript
export async function getCreditsLimitForPlan(plan: Plan): Promise<number> {
  // Busca do banco de dados primeiro
  const dbPlan = await getSubscriptionPlanById(plan)
  if (dbPlan) return dbPlan.credits
  // Fallback hardcoded
  return PLAN_CONFIGS_FALLBACK[plan].credits
}
```

**Valores Fallback:**
- STARTER: 500 créditos
- PREMIUM: 1200 créditos  
- GOLD: 2500 créditos

---

## 🔄 Fluxos que Atualizam `creditsLimit`

### 1. **Criação de Novo Usuário** 

**Arquivo:** `src/lib/db/users.ts` - função `createUser()`

**Quando acontece:**
- Usuário se cadastra via signup
- Novo usuário OAuth (Google, etc.)

**Fluxo:**
```typescript
const creditsLimit = data.plan 
  ? await getCreditsLimitForPlan(data.plan) 
  : 0  // Sem plano = 0 créditos

await prisma.user.create({
  data: {
    ...data,
    creditsLimit // 0 se sem plano, ou valor do plano
  }
})
```

**Valor definido:**
- Se usuário tem plano: `creditsLimit = valor do plano`
- Se usuário não tem plano: `creditsLimit = 0`

---

### 2. **Criação de Nova Assinatura (Checkout)**

**Arquivo:** `src/lib/db/subscriptions.ts` - função `createSubscription()`

**Chamado por:**
- `/api/payments/asaas/create-subscription/route.ts` (quando usuário cria assinatura no checkout)

**Fluxo:**
```typescript
const creditsLimit = await getCreditsLimitForPlan(data.plan)
const totalCredits = data.status === 'ACTIVE'
  ? (data.billingCycle === 'YEARLY' ? creditsLimit * 12 : creditsLimit)
  : 0  // Se pagamento não confirmado = 0

await prisma.user.update({
  where: { id: data.userId },
  data: {
    creditsLimit: totalCredits,  // YEARLY recebe 12x, MONTHLY recebe 1x
    creditsUsed: 0,  // Reseta créditos usados
    // ... outros campos
  }
})
```

**Valor definido:**
- **MONTHLY**: `creditsLimit = valor do plano` (ex: STARTER = 500)
- **YEARLY**: `creditsLimit = valor do plano * 12` (ex: STARTER = 6000)
- **Status não ACTIVE**: `creditsLimit = 0`

---

### 3. **Ativação de Assinatura (Webhook de Pagamento Confirmado)**

**Arquivo:** `src/lib/db/subscriptions.ts` - função `updateSubscriptionStatus()`

**Chamado por:**
- `/api/payments/asaas/webhook/enhanced/route.ts` (quando Asaas confirma pagamento)
- `/api/payments/asaas/webhook/route.ts` (webhook legado)

**Fluxo:**
```typescript
if (status === 'ACTIVE' && plan) {
  const creditsLimit = await getCreditsLimitForPlan(plan)
  const currentBillingCycle = billingCycle || user?.billingCycle
  
  // Planos ANUAIS recebem créditos multiplicados por 12
  const totalCredits = currentBillingCycle === 'YEARLY' 
    ? creditsLimit * 12 
    : creditsLimit

  await prisma.user.update({
    where: { id: userId },
    data: {
      creditsLimit: totalCredits,  // Define limite baseado no plano e ciclo
      creditsUsed: 0,  // Reseta créditos usados
      // ... outros campos
    }
  })
}
```

**Valor definido:**
- **MONTHLY**: `creditsLimit = valor do plano`
- **YEARLY**: `creditsLimit = valor do plano * 12`
- **Apenas quando `status === 'ACTIVE'` e `plan` está presente**

**Importante:** Este é o fluxo principal que define `creditsLimit` quando o pagamento é confirmado pelo webhook do Asaas.

---

### 4. **Renovação Mensal de Créditos (CRON Job)**

**Arquivo:** `src/lib/db/subscriptions.ts` - função `renewMonthlyCredits()`

**Chamado por:**
- `/api/cron/renew-credits/route.ts` (CRON job executado diariamente)

**Quando acontece:**
- Usuário com plano MONTHLY ativo
- Passaram pelo menos 28 dias desde última renovação
- Dia do mês >= dia de início da assinatura

**Fluxo:**
```typescript
const creditsLimit = await getCreditsLimitForPlan(user.plan!)

await prisma.user.update({
  where: { id: user.id },
  data: {
    creditsUsed: 0,  // Reseta créditos usados
    creditsLimit: creditsLimit,  // Renova limite (mantém mesmo valor)
    lastCreditRenewalAt: now,
    creditsExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  }
})
```

**Valor definido:**
- `creditsLimit = valor do plano` (não multiplica por 12, pois é renovação mensal)
- **Apenas para planos MONTHLY**
- Planos YEARLY não usam esta função (recebem tudo de uma vez)

---

### 5. **Upgrade/Downgrade Imediato de Plano**

**Arquivo:** 
- `/api/asaas/subscriptions/[id]/upgrade/route.ts`
- `/api/asaas/subscriptions/[id]/downgrade/route.ts` (quando `immediate: true`)

**Fluxo:**
```typescript
// Atualiza apenas o plan, NÃO atualiza creditsLimit
await prisma.user.update({
  where: { id: user.id },
  data: {
    plan: newPlan,
    subscriptionCycle: cycle
    // creditsLimit NÃO é atualizado aqui
  }
})

// Chama updateSubscriptionStatus SEM passar plan
await updateSubscriptionStatus(user.id, 'ACTIVE')
// Isso NÃO atualiza creditsLimit porque não passa plan como parâmetro
```

**Valor definido:**
- **NÃO atualiza `creditsLimit` imediatamente**
- Mantém `creditsLimit` do plano antigo até próximo pagamento
- `creditsLimit` será atualizado apenas no próximo webhook de pagamento

---

### 6. **Atualização Manual pelo Admin**

**Arquivo:** `/api/admin/users/route.ts` - método `PUT`

**Quando acontece:**
- Admin atualiza plano do usuário manualmente

**Fluxo:**
```typescript
if (updateData.plan) {
  updateData.creditsLimit = getCreditsLimitForPlan(updateData.plan as any)
  
  // Se plano mudou e status é ACTIVE, resetar créditos usados
  if (currentUser?.subscriptionStatus === 'ACTIVE') {
    updateData.creditsUsed = 0
  }
}

await prisma.user.update({ where: { id }, data: updateData })
```

**Valor definido:**
- `creditsLimit = valor do novo plano`
- **Apenas para plano MONTHLY** (não multiplica por 12 mesmo se for YEARLY neste endpoint)

---

### 7. **Expiração de Créditos Anuais (CRON Job)**

**Arquivo:** `/api/cron/expire-yearly-credits/route.ts`

**Quando acontece:**
- Planos YEARLY que expiraram (`creditsExpiresAt < agora`)
- CRON job executado diariamente

**Fluxo:**
```typescript
await prisma.user.update({
  where: { id: user.id },
  data: {
    creditsLimit: 0,  // Zera até próximo pagamento
    creditsExpiresAt: null
  }
})
```

**Valor definido:**
- `creditsLimit = 0` (até próximo pagamento renovar)

---

## 📊 Resumo dos Valores Definidos

| Fluxo | MONTHLY | YEARLY | Quando |
|-------|---------|--------|--------|
| **Criação de usuário** | Valor do plano | Valor do plano | No signup |
| **Criação de assinatura** | Valor do plano | Valor * 12 | No checkout |
| **Ativação (webhook)** | Valor do plano | Valor * 12 | Pagamento confirmado |
| **Renovação mensal** | Valor do plano | - | CRON diário |
| **Upgrade/Downgrade** | Não muda | Não muda | Mantém até próximo pagamento |
| **Admin manual** | Valor do plano | Valor do plano* | Admin atualiza |
| **Expiração anual** | - | 0 | Após expirar |

\* Nota: Admin manual não diferencia MONTHLY/YEARLY, sempre usa valor mensal

---

## 🔑 Pontos Importantes

1. **`creditsLimit` representa o limite do ciclo atual:**
   - MONTHLY: limite mensal (ex: 500)
   - YEARLY: limite anual (ex: 6000 = 500 * 12)

2. **`creditsLimit` não é incrementado, apenas substituído:**
   - Quando renova, reseta para o valor do plano
   - Não acumula créditos não utilizados

3. **Troca de plano no meio do mês:**
   - `creditsLimit` permanece do plano antigo
   - Só atualiza no próximo pagamento

4. **`creditsLimit` vs `creditsBalance`:**
   - `creditsLimit`: limite da assinatura (renova mensalmente/anualmente)
   - `creditsBalance`: créditos comprados em pacotes avulsos (não expiram no fim do ciclo)

---

## 🔍 Funções Relacionadas

- `getCreditsLimitForPlan(plan)`: Busca limite do plano (banco ou fallback)
- `createSubscription()`: Cria assinatura inicial
- `updateSubscriptionStatus()`: Atualiza status e `creditsLimit` quando ativa
- `renewMonthlyCredits()`: Renova `creditsLimit` para planos mensais

