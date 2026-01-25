# 📘 DOCUMENTAÇÃO COMPLETA: Sistema de Créditos VibePhoto

**Data**: 25/01/2026  
**Versão**: 2.0  
**Status**: Produção

---

## 📑 **ÍNDICE**

1. [Visão Geral](#visão-geral)
2. [Tipos de Créditos](#tipos-de-créditos)
3. [Fluxo 1: Assinatura Inicial](#fluxo-1-assinatura-inicial)
4. [Fluxo 2: Renovação Mensal Automática](#fluxo-2-renovação-mensal-automática)
5. [Fluxo 3: Renovação Anual Automática](#fluxo-3-renovação-anual-automática)
6. [Fluxo 4: Compra de Créditos Avulsos](#fluxo-4-compra-de-créditos-avulsos)
7. [Fluxo 5: Expiração de Créditos](#fluxo-5-expiração-de-créditos)
8. [Fluxo 6: Dedução de Créditos no Uso Diário](#fluxo-6-dedução-de-créditos-no-uso-diário)
9. [Fluxo 7: Reembolso de Créditos](#fluxo-7-reembolso-de-créditos)
10. [Fluxo 8: Cancelamento de Assinatura](#fluxo-8-cancelamento-de-assinatura)
11. [Tabelas e Campos](#tabelas-e-campos)
12. [Prioridades e Regras](#prioridades-e-regras)
13. [Casos de Uso](#casos-de-uso)

---

## 🌟 **VISÃO GERAL**

O sistema de créditos do VibePhoto é baseado em **créditos pré-pagos** que permitem aos usuários gerar imagens com IA. Existem dois tipos principais de créditos:

1. **Créditos de Assinatura** (plan credits): Renovam mensalmente/anualmente, não acumulam
2. **Créditos Comprados** (purchased credits): Válidos por 12 meses, acumulam

---

## 💳 **TIPOS DE CRÉDITOS**

### **1. Créditos de Assinatura (Plan Credits)**

**Características:**
- ✅ Inclusos nos planos STARTER, PREMIUM e GOLD
- ✅ Renovam automaticamente todo mês/ano
- ❌ **NÃO acumulam** (créditos não usados expiram na renovação)
- ✅ **Prioridade 1** na dedução (usados primeiro)
- ✅ Expiram baseado em `creditsExpiresAt`

**Limites por plano:**
| Plano | Mensal | Anual (12x) |
|-------|--------|-------------|
| STARTER | 500 | 6.000 |
| PREMIUM | 1.200 | 14.400 |
| GOLD | 2.500 | 30.000 |

**Campos no banco:**
```typescript
users {
  creditsLimit: number      // Total de créditos do plano
  creditsUsed: number       // Créditos já gastos no ciclo
  creditsExpiresAt: Date    // Data de expiração do ciclo
  lastCreditRenewalAt: Date // Última renovação
}
```

**Cálculo disponível:**
```typescript
subscriptionCredits = creditsLimit - creditsUsed
// Ex: 500 - 160 = 340 créditos disponíveis
```

---

### **2. Créditos Comprados (Purchased Credits)**

**Características:**
- ✅ Comprados via checkout (PIX, cartão, boleto)
- ✅ **Acumulam** (não expiram ao renovar)
- ✅ Válidos por **12 meses** após compra
- ✅ **Prioridade 2** na dedução (usados depois dos créditos do plano)
- ✅ Podem ser comprados por qualquer usuário (com ou sem assinatura)

**Pacotes disponíveis:**
| Pacote | Créditos | Preço | Validade |
|--------|----------|-------|----------|
| Essencial | 350 | R$ 89 | 12 meses |
| Avançado | 1.000 | R$ 179 | 12 meses |
| Pro | 2.200 | R$ 359 | 12 meses |
| Enterprise | 5.000 | R$ 899 | 12 meses |

**Campos no banco:**
```typescript
users {
  creditsBalance: number  // Saldo de créditos comprados
}

credit_purchases {
  creditAmount: number    // Total do pacote
  usedCredits: number     // Já utilizados
  validUntil: Date        // Data de expiração
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED'
}
```

**Cálculo disponível:**
```typescript
purchasedCredits = creditsBalance
// + Soma de (creditAmount - usedCredits) das purchases válidas
```

---

## 🚀 **FLUXO 1: ASSINATURA INICIAL**

### **Descrição:**
Usuário assina um plano pela primeira vez

### **Trigger:**
1. Usuário escolhe plano (STARTER/PREMIUM/GOLD)
2. Escolhe ciclo (MONTHLY/YEARLY)
3. Preenche dados e paga (PIX/Cartão/Boleto)

### **Processo:**

```mermaid
1. Usuário clica "Assinar STARTER Mensal"
2. Checkout Asaas criado (valor: R$ 39)
3. Usuário paga (ex: PIX)
4. ✅ Asaas confirma pagamento
5. 🔔 Webhook PAYMENT_RECEIVED chega
6. Sistema executa handlePaymentSuccess()
7. updateSubscriptionStatus() é chamado
8. ✅ Créditos concedidos
```

### **Código (simplificado):**

```typescript
// handlePaymentSuccess() - webhook/route.ts
async function handlePaymentSuccess(payment) {
  if (payment.subscription) {
    const asaasSubscription = await asaas.getSubscription(payment.subscription)
    
    await updateSubscriptionStatus(
      user.id,
      'ACTIVE',
      nextBillingDate,
      planType,  // STARTER
      billingCycle // MONTHLY
    )
  }
}

// updateSubscriptionStatus() - subscriptions.ts
async function updateSubscriptionStatus(...) {
  const creditsLimit = await getCreditsLimitForPlan(plan) // 500
  const totalCredits = billingCycle === 'YEARLY' ? creditsLimit * 12 : creditsLimit
  
  const creditsExpiresAt = billingCycle === 'YEARLY'
    ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // +1 ano
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)  // +30 dias
  
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      data: {
        plan: 'STARTER',
        billingCycle: 'MONTHLY',
        subscriptionStatus: 'ACTIVE',
        creditsLimit: 500,
        creditsUsed: 0,
        creditsExpiresAt: new Date('2026-02-06'), // +30 dias
        subscriptionStartedAt: now,
        lastCreditRenewalAt: now
      }
    })
    
    // Registrar no ledger
    await recordSubscriptionRenewal(userId, 500, { reason: 'INITIAL_SUBSCRIPTION' }, tx)
  })
}
```

### **Resultado no banco:**

```typescript
users {
  plan: 'STARTER',
  billingCycle: 'MONTHLY',
  subscriptionStatus: 'ACTIVE',
  creditsLimit: 500,
  creditsUsed: 0,
  creditsBalance: 0,
  creditsExpiresAt: '2026-02-06T00:00:00Z',
  subscriptionStartedAt: '2026-01-06T10:30:00Z',
  lastCreditRenewalAt: '2026-01-06T10:30:00Z'
}

credit_transactions {
  type: 'EARNED',
  source: 'SUBSCRIPTION',
  amount: 500,
  description: 'Renovação de assinatura - 500 créditos',
  balanceAfter: 0  // creditsBalance permanece 0 (são créditos do plano)
}
```

### **Badge exibe:**
- **Total**: 500 créditos

---

## 🔄 **FLUXO 2: RENOVAÇÃO MENSAL AUTOMÁTICA**

### **Descrição:**
Renovação automática de créditos para planos mensais

### **Trigger:**
1. ✅ **Principal**: Webhook `PAYMENT_RECEIVED` (quando Asaas cobra e confirma pagamento)
2. ✅ **Backup**: Cron Job diário às 2 AM (caso webhook falhe)

### **Processo (Webhook - Principal):**

```mermaid
1. Asaas cobra automaticamente no dia do mês (ex: dia 06)
2. Pagamento aprovado
3. ✅ Webhook PAYMENT_RECEIVED chega
4. handlePaymentSuccess() executa
5. updateSubscriptionStatus() renova créditos
6. ✅ creditsUsed = 0, creditsExpiresAt = +30 dias
```

### **Código (Webhook):**

```typescript
// Mesmo fluxo da assinatura inicial
// updateSubscriptionStatus() reseta:
- creditsUsed = 0
- creditsExpiresAt = now + 30 dias
- lastCreditRenewalAt = now

// Registra no ledger:
- type: 'RENEWED'
- amount: 500
```

### **Processo (Cron - Backup):**

```mermaid
1. Cron executa diariamente às 2 AM
2. Busca usuários com billingCycle = 'MONTHLY'
3. Para cada usuário:
   a) Verifica se passou 28+ dias desde última renovação
   b) Verifica se já passou o dia do mês
   c) ✅ NOVO: Verifica se webhook já renovou
   d) ✅ NOVO: Consulta Asaas para confirmar pagamento
4. Se todas validações OK → Renova
```

### **Código (Cron):**

```typescript
// renewMonthlyCredits() - subscriptions.ts
for (const user of users) {
  const daysSinceLastRenewal = calcularDias(user.lastCreditRenewalAt)
  
  // Validações
  if (daysSinceLastRenewal < 28) continue
  if (currentDay < dayOfMonth) continue
  
  // ✅ NOVO: Verificar se webhook já renovou
  if (user.creditsExpiresAt > now && diasAteExpiracao > 25) {
    console.log('Webhook já renovou, pular')
    continue
  }
  
  // ✅ NOVO: Consultar Asaas
  const payments = await asaas.getSubscriptionPayments(user.subscriptionId)
  const recentPayment = payments.find(p => p.status === 'RECEIVED' && diasAtras <= 5)
  
  if (!recentPayment) {
    console.log('Pagamento não confirmado, pular')
    continue
  }
  
  // RENOVAR
  await prisma.user.update({
    data: {
      creditsUsed: 0,
      lastCreditRenewalAt: now,
      creditsExpiresAt: now + 30 dias
    }
  })
  
  await recordSubscriptionRenewal(..., { reason: 'CRON_BACKUP_RENEWAL' })
}
```

### **Exemplo Real (ZEUXIS - 06/02/2026):**

**ANTES da renovação (05/02 23:59):**
```typescript
creditsLimit: 500
creditsUsed: 470
creditsBalance: 0
creditsExpiresAt: '2026-02-06T00:00:00Z'
→ Disponível: 30 créditos
```

**DURANTE (06/02 00:01 - 01:59):**
```typescript
// creditsExpiresAt passou!
// MAS grace period de 24h mantém créditos disponíveis
→ Disponível: 30 créditos (grace period ativo)
```

**Asaas cobra (06/02 ~10:00):**
```typescript
// Pagamento aprovado
// Webhook PAYMENT_RECEIVED chega
// Sistema renova IMEDIATAMENTE
```

**APÓS renovação (06/02 10:01):**
```typescript
creditsUsed: 0           // ✅ Resetado
creditsLimit: 500        // ✅ Mantém
creditsExpiresAt: '2026-03-06T00:00:00Z'  // ✅ +30 dias
lastCreditRenewalAt: '2026-02-06T10:00:00Z'
→ Disponível: 500 créditos 🎉
```

**Cron Job (06/02 02:00) - O QUE ACONTECE?**
```typescript
// Validações:
1. daysSinceLastRenewal = 31 dias ✅
2. currentDay (6) >= dayOfMonth (6) ✅
3. creditsExpiresAt (2026-02-06) < now (2026-02-06 02:00) ✅
4. Mas creditsExpiresAt foi atualizado? NÃO (webhook ainda não chegou)
5. lastCreditRenewalAt recente (< 5 dias)? NÃO (NULL ou antiga)
6. Consulta Asaas: Pagamento confirmado? Depende do horário que Asaas processou

// Se Asaas já processou às 02:00 → Cron renova
// Se Asaas ainda não processou → Cron pula, webhook renova depois
```

---

## 🗓️ **FLUXO 3: RENOVAÇÃO ANUAL AUTOMÁTICA**

### **Descrição:**
Similar ao mensal, mas com ciclo de 1 ano

### **Diferenças:**

| Aspecto | Mensal | Anual |
|---------|--------|-------|
| Créditos | 500/mês | 6.000 (500 × 12) de uma vez |
| Expiração | +30 dias | +365 dias |
| Renovação | Todo mês | Todo ano |
| Acumulam? | ❌ Não | ❌ Não |

### **Processo:**

```typescript
// Mesmo webhook PAYMENT_RECEIVED
// updateSubscriptionStatus() com billingCycle = 'YEARLY'

const totalCredits = creditsLimit * 12  // 500 × 12 = 6000
const creditsExpiresAt = now + 365 dias

await prisma.user.update({
  data: {
    creditsLimit: 6000,
    creditsUsed: 0,
    creditsExpiresAt: new Date('2027-01-06'),  // +1 ano
    lastCreditRenewalAt: now
  }
})
```

### **Exemplo:**

**Usuário assina STARTER Anual:**
```typescript
// Assinatura
creditsLimit: 6000
creditsUsed: 0
creditsExpiresAt: '2027-01-06'  // Expira em 1 ano

// Após 6 meses (usou 3000 créditos)
creditsUsed: 3000
→ Disponível: 3000 créditos

// Após 1 ano (chegou 2027-01-06)
// Asaas cobra renovação anual
// Webhook renova:
creditsUsed: 0  // ✅ Zera (3000 créditos não usados EXPIRAM!)
creditsLimit: 6000
creditsExpiresAt: '2028-01-06'  // +1 ano
→ Disponível: 6000 créditos novos
```

---

## 💰 **FLUXO 4: COMPRA DE CRÉDITOS AVULSOS**

### **Descrição:**
Usuário compra pacote de créditos adicional

### **Trigger:**
1. Usuário clica "Comprar Créditos"
2. Escolhe pacote (ex: 1.000 créditos por R$ 179)
3. Paga (PIX/Cartão/Boleto)

### **Processo:**

```mermaid
1. Usuário escolhe "Pacote Avançado" (1.000 créditos)
2. Checkout Asaas criado
3. ✅ Pagamento confirmado
4. 🔔 Webhook PAYMENT_RECEIVED chega
5. Sistema detecta: É compra de créditos (tem creditPurchase)
6. Adiciona créditos ao creditsBalance
7. Registra no ledger
```

### **Código:**

```typescript
// handlePaymentSuccess() - webhook/route.ts
const creditPurchase = await prisma.creditPurchase.findFirst({
  where: { asaasPaymentId: payment.id }
})

if (creditPurchase) {
  // 1. Atualizar status da compra
  await prisma.creditPurchase.update({
    where: { id: creditPurchase.id },
    data: {
      status: 'COMPLETED',
      confirmedAt: now
    }
  })
  
  // 2. Calcular novo saldo
  const currentBalance = user.creditsBalance || 0
  const newBalance = currentBalance + creditPurchase.creditAmount
  
  // 3. Adicionar ao creditsBalance
  await prisma.user.update({
    where: { id: user.id },
    data: {
      creditsBalance: { increment: creditPurchase.creditAmount }
    }
  })
  
  // 4. Registrar no ledger
  await prisma.creditTransaction.create({
    data: {
      userId: user.id,
      type: 'EARNED',
      source: 'PURCHASE',
      amount: creditPurchase.creditAmount,
      balanceAfter: newBalance,
      description: `Compra de ${creditPurchase.packageName} - ${creditPurchase.creditAmount} créditos`,
      creditPurchaseId: creditPurchase.id
    }
  })
}
```

### **Exemplo:**

**Usuário ZEUXIS (06/02/2026):**

**ANTES da compra:**
```typescript
// Assinatura
creditsLimit: 500
creditsUsed: 470
→ Créditos do plano: 30

// Comprados
creditsBalance: 0
→ Créditos comprados: 0

TOTAL: 30 créditos
```

**Compra 1.000 créditos:**
```typescript
// Pagamento confirmado
// Sistema adiciona:
creditsBalance: 0 + 1000 = 1000

// Ledger:
type: 'EARNED'
source: 'PURCHASE'
amount: 1000
balanceAfter: 1000
```

**APÓS compra:**
```typescript
creditsLimit: 500
creditsUsed: 470
creditsBalance: 1000

TOTAL: 30 (plano) + 1000 (comprados) = 1030 créditos 🎉
```

---

## ⏰ **FLUXO 5: EXPIRAÇÃO DE CRÉDITOS**

### **5.1. Expiração de Créditos do Plano**

**Regra:** Créditos não usados **EXPIRAM** na renovação (não acumulam)

**Exemplo:**

```typescript
// Ciclo 1 (06/01 - 05/02)
creditsLimit: 500
creditsUsed: 300
→ Disponível: 200 créditos
→ Não usou 200 créditos

// Renovação (06/02)
creditsUsed: 0  // ✅ Zera (200 créditos EXPIRAM!)
creditsLimit: 500  // Novos 500
→ Disponível: 500 créditos (não 700!)
```

**Registro no ledger:**

```typescript
// ❌ BUG ATUAL: Expiração NÃO é registrada no ledger!
// ✅ CORREÇÃO NECESSÁRIA: Registrar transação EXPIRED

await prisma.creditTransaction.create({
  data: {
    type: 'EXPIRED',
    source: 'SUBSCRIPTION',
    amount: -200,  // Negativo = perda
    description: 'Créditos não utilizados expiraram na renovação mensal'
  }
})
```

### **5.2. Expiração de Créditos Comprados**

**Regra:** Créditos comprados expiram após **12 meses** da compra

**Processo:**

```mermaid
1. Cron Job "expire-credits" executa diariamente
2. Busca credit_purchases com:
   - validUntil < hoje
   - status = 'COMPLETED'
   - isExpired = false
3. Para cada compra:
   a) Calcula créditos não usados
   b) Decrementa de creditsBalance
   c) Marca como isExpired = true
   d) Registra no ledger
```

**Código:**

```typescript
// expire-credits/route.ts
const expiringPurchases = await prisma.creditPurchase.findMany({
  where: {
    validUntil: { lt: now },
    status: 'COMPLETED',
    isExpired: false
  }
})

for (const purchase of expiringPurchases) {
  const remaining = purchase.creditAmount - purchase.usedCredits
  
  if (remaining > 0) {
    // Decrementar creditsBalance
    await prisma.user.update({
      where: { id: purchase.userId },
      data: {
        creditsBalance: { decrement: remaining }
      }
    })
    
    // Registrar no ledger
    await prisma.creditTransaction.create({
      data: {
        type: 'EXPIRED',
        source: 'PURCHASE',
        amount: -remaining,
        description: `Créditos comprados expiraram (${purchase.packageName})`
      }
    })
  }
  
  // Marcar como expirado
  await prisma.creditPurchase.update({
    where: { id: purchase.id },
    data: { isExpired: true }
  })
}
```

**Exemplo:**

```typescript
// Compra em 06/01/2026
creditAmount: 1000
usedCredits: 300
validUntil: '2027-01-06'

// Em 07/01/2027 (passou 1 ano)
// Cron detecta: validUntil < now
remaining = 1000 - 300 = 700 créditos

// Sistema:
creditsBalance -= 700
isExpired = true

// Ledger:
type: 'EXPIRED'
amount: -700
```

---

## 🎨 **FLUXO 6: DEDUÇÃO DE CRÉDITOS NO USO DIÁRIO**

### **Descrição:**
Quando usuário gera imagem, treina modelo, etc.

### **Prioridade de Dedução:**

```
1º → Créditos do Plano (creditsLimit - creditsUsed)
2º → Créditos Comprados (creditsBalance)
```

### **Processo:**

```mermaid
1. Usuário clica "Gerar Imagem"
2. Sistema calcula custo (ex: 15 créditos)
3. canUserAfford() verifica saldo
4. deductCredits() executa:
   a) Calcula disponível do plano
   b) Calcula disponível comprado
   c) Usa plano primeiro
   d) Se não suficiente, usa comprados
5. Atualiza banco
6. Registra no ledger
7. Notifica frontend (SSE)
```

### **Código:**

```typescript
// deductCredits() - manager.ts
async function deductCredits(userId, amount) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  
  // 1. Calcular disponíveis
  const planCreditsAvailable = Math.max(0, user.creditsLimit - user.creditsUsed)
  const purchasedCredits = user.creditsBalance || 0
  const totalAvailable = planCreditsAvailable + purchasedCredits
  
  // 2. Verificar se tem suficiente
  if (totalAvailable < amount) {
    return { success: false, error: 'Insufficient credits' }
  }
  
  // 3. Distribuir dedução
  if (planCreditsAvailable >= amount) {
    // Caso simples: só usar créditos do plano
    await prisma.user.update({
      data: {
        creditsUsed: { increment: amount }
      }
    })
  } else {
    // Caso complexo: usar plano + comprados
    const fromPlan = planCreditsAvailable
    const fromPurchased = amount - planCreditsAvailable
    
    await prisma.user.update({
      data: {
        creditsUsed: user.creditsLimit,  // Usar todos do plano
        creditsBalance: { decrement: fromPurchased }
      }
    })
  }
  
  // 4. Registrar no ledger
  await prisma.creditTransaction.create({
    data: {
      type: 'SPENT',
      source: 'GENERATION',
      amount: -amount,  // Negativo = gasto
      description: 'Geração de imagem - 15 créditos'
    }
  })
  
  // 5. Notificar frontend
  await broadcastCreditsUpdate(userId, ...)
}
```

### **Exemplo 1: Só créditos do plano**

```typescript
// Estado atual
creditsLimit: 500
creditsUsed: 160
creditsBalance: 0
→ Disponível: 340 (plano) + 0 (comprados) = 340

// Gera imagem (15 créditos)
creditsUsed: 160 + 15 = 175
→ Disponível: 325
```

### **Exemplo 2: Plano + comprados**

```typescript
// Estado atual
creditsLimit: 500
creditsUsed: 490  // Só tem 10 do plano!
creditsBalance: 1000
→ Disponível: 10 (plano) + 1000 (comprados) = 1010

// Gera imagem (15 créditos)
// Usa 10 do plano + 5 dos comprados
creditsUsed: 500  // Usou todos do plano
creditsBalance: 1000 - 5 = 995
→ Disponível: 995
```

### **Exemplo 3: Só comprados**

```typescript
// Estado atual
creditsLimit: 500
creditsUsed: 500  // Esgotou plano!
creditsBalance: 350
→ Disponível: 0 (plano) + 350 (comprados) = 350

// Gera imagem (15 créditos)
creditsUsed: 500  // Não muda
creditsBalance: 350 - 15 = 335
→ Disponível: 335
```

---

## 🔄 **FLUXO 7: REEMBOLSO DE CRÉDITOS**

### **Descrição:**
Quando geração falha ou usuário solicita reembolso

### **Processo:**

```typescript
// addCredits() - manager.ts
async function addCredits(userId, amount, description) {
  await prisma.user.update({
    data: {
      creditsUsed: { decrement: amount }  // Devolve ao plano
    }
  })
  
  await prisma.creditTransaction.create({
    data: {
      type: 'REFUNDED',
      source: 'REFUND',
      amount: amount,  // Positivo = devolução
      description: 'Reembolso: Geração falhou'
    }
  })
}
```

### **Exemplo:**

```typescript
// Antes
creditsUsed: 175
→ Disponível: 325

// Geração falha (15 créditos)
// Sistema devolve:
creditsUsed: 175 - 15 = 160
→ Disponível: 340

// Ledger:
type: 'REFUNDED'
amount: 15
```

---

## ❌ **FLUXO 8: CANCELAMENTO DE ASSINATURA**

### **Descrição:**
Usuário cancela assinatura (ainda tem acesso até o fim do ciclo)

### **Processo:**

```mermaid
1. Usuário clica "Cancelar Assinatura"
2. Sistema cancela no Asaas
3. Webhook SUBSCRIPTION_CANCELLED chega
4. Sistema marca:
   - subscriptionStatus = 'CANCELLED'
   - subscriptionCancelledAt = now
   - MAS mantém creditsLimit até subscriptionEndsAt
5. No dia subscriptionEndsAt:
   - Cron detecta assinatura expirada
   - creditsLimit = 0
   - creditsUsed = 0
   - plan = null
```

### **Código:**

```typescript
// handleSubscriptionCancelled() - webhook
async function handleSubscriptionCancelled(subscription) {
  await prisma.user.update({
    data: {
      subscriptionStatus: 'CANCELLED',
      subscriptionCancelledAt: now
      // NÃO zera creditsLimit! Usuário usa até o fim
    }
  })
}

// Cron "expire-yearly-credits"
const expiredUsers = await prisma.user.findMany({
  where: {
    subscriptionStatus: 'CANCELLED',
    subscriptionEndsAt: { lt: now }
  }
})

for (const user of expiredUsers) {
  await prisma.user.update({
    data: {
      creditsLimit: 0,
      creditsUsed: 0,
      plan: null,
      subscriptionStatus: 'EXPIRED'
    }
  })
  
  // Registrar no ledger
  await prisma.creditTransaction.create({
    data: {
      type: 'EXPIRED',
      source: 'SUBSCRIPTION',
      amount: -(user.creditsLimit - user.creditsUsed),
      description: 'Assinatura cancelada - créditos expirados'
    }
  })
}
```

---

## 📊 **TABELAS E CAMPOS**

### **users**

```typescript
{
  // Assinatura
  plan: 'STARTER' | 'PREMIUM' | 'GOLD' | null
  billingCycle: 'MONTHLY' | 'YEARLY' | null
  subscriptionStatus: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'OVERDUE'
  subscriptionStartedAt: Date
  subscriptionEndsAt: Date
  subscriptionCancelledAt: Date
  subscriptionId: string  // Asaas subscription ID
  
  // Créditos do plano
  creditsLimit: number          // Total do plano
  creditsUsed: number           // Já gastos no ciclo
  creditsExpiresAt: Date        // Quando expira
  lastCreditRenewalAt: Date     // Última renovação
  
  // Créditos comprados
  creditsBalance: number        // Saldo atual
}
```

### **credit_transactions** (Ledger)

```typescript
{
  id: string
  userId: string
  type: 'EARNED' | 'SPENT' | 'EXPIRED' | 'REFUNDED' | 'RENEWED'
  source: 'SUBSCRIPTION' | 'PURCHASE' | 'GENERATION' | 'TRAINING' | 'REFUND' | 'EXPIRATION'
  amount: number                // + EARNED/REFUNDED, - SPENT/EXPIRED
  balanceAfter: number          // Saldo de creditsBalance após transação
  description: string
  referenceId: string           // generationId, modelId, purchaseId, etc
  creditPurchaseId: string      // Se veio de compra
  metadata: JSON
  createdAt: Date
}
```

### **credit_purchases** (Compras)

```typescript
{
  id: string
  userId: string
  packageId: string
  packageName: string
  creditAmount: number          // Total de créditos
  usedCredits: number           // Já utilizados
  value: number                 // Preço pago
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED'
  validUntil: Date              // Expira em 12 meses
  isExpired: boolean
  asaasPaymentId: string
  confirmedAt: Date
  createdAt: Date
}
```

---

## 📏 **PRIORIDADES E REGRAS**

### **1. Ordem de Dedução:**

```
1º Créditos do Plano (creditsLimit - creditsUsed)
2º Créditos Comprados (creditsBalance)
```

### **2. Acumulação:**

| Tipo | Acumula na Renovação? |
|------|----------------------|
| Créditos do Plano | ❌ NÃO (expiram) |
| Créditos Comprados | ✅ SIM (até 12 meses) |

### **3. Expiração:**

| Tipo | Quando Expira? |
|------|---------------|
| Plano Mensal | Na renovação (todo mês) |
| Plano Anual | Na renovação (todo ano) |
| Créditos Comprados | 12 meses após compra |

### **4. Renovação:**

| Método | Quando? | Prioridade |
|--------|---------|-----------|
| Webhook Asaas | Quando pagamento confirmado | 1º |
| Cron Job | Diariamente às 2 AM | 2º (backup) |

### **5. Grace Period:**

- ✅ Se `creditsExpiresAt` passou MAS `lastCreditRenewalAt` indica renovação → Créditos válidos
- ✅ Se `creditsExpiresAt` passou E renovação não aconteceu → Grace period de 24h
- ❌ Após 24h sem renovação → Zerar créditos

---

## 💡 **CASOS DE USO**

### **Caso 1: Usuário STARTER Mensal**

```
Dia 06/01: Assina (500 créditos)
Dia 15/01: Usa 200 (resta 300)
Dia 20/01: Compra 1000 (total 1300)
Dia 30/01: Usa 350 (usa 300 do plano + 50 comprados) (total 950 comprados)
Dia 06/02: Renova (500 novos + 950 comprados = 1450)
```

### **Caso 2: Usuário PREMIUM Anual**

```
Dia 06/01/2026: Assina anual (6000 créditos de uma vez)
Mês 1-12: Usa 500/mês = 6000 total
Dia 06/01/2027: Renova (6000 novos, créditos anteriores expiraram)
```

### **Caso 3: Usuário sem Assinatura (Só Compra)**

```
Usuário nunca assinou, só compra créditos:
- creditsLimit = 0
- creditsUsed = 0
- creditsBalance = 1000 (comprou)
→ Usa só dos créditos comprados
```

---

## ✅ **RESUMO FINAL**

**Dois tipos de créditos:**
1. 🔄 **Plano**: Renovam, não acumulam, prioridade 1
2. 💰 **Comprados**: Acumulam, expiram em 12 meses, prioridade 2

**Renovação:**
1. 🔔 **Webhook** (principal): Quando pagamento confirmado
2. ⏰ **Cron** (backup): Diariamente às 2 AM com validações

**Expiração:**
- **Plano**: Na renovação (não acumulam)
- **Comprados**: 12 meses após compra

**Dedução:**
1. Usa plano primeiro
2. Depois usa comprados
3. Registra no ledger
4. Notifica frontend

---

**FIM DA DOCUMENTAÇÃO** 🎉
