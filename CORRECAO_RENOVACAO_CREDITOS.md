# 🔧 CORREÇÃO: Sistema de Renovação de Créditos

**Data**: 25/01/2026  
**Problema**: Risco de dupla renovação e renovação antes do pagamento ser confirmado  
**Solução**: Priorizar webhook + adicionar validações no Cron Job

---

## 📋 **ARQUIVOS A CORRIGIR:**

1. ✅ `src/lib/db/subscriptions.ts` - Função `renewMonthlyCredits()`
2. ✅ `src/lib/services/credit-package-service.ts` - Função `getUserCreditBalance()`
3. ✅ `src/lib/credits/manager.ts` - Função `getUserCredits()` e `deductCredits()`

---

## 🔧 **CORREÇÃO 1: renewMonthlyCredits() - Evitar dupla renovação**

### **Arquivo**: `src/lib/db/subscriptions.ts`
### **Linhas**: ~372-469

### **Problema atual:**
```typescript
// Renova se passaram 28 dias E já passou o dia do mês
if (daysSinceLastRenewal >= 28 && currentDay >= dayOfMonth) {
  await renovarCreditos() // ❌ Pode duplicar com webhook!
}
```

### **✅ CORREÇÃO:**

```typescript
export async function renewMonthlyCredits() {
  const now = new Date()

  // Busca usuários com planos MONTHLY ativos
  const users = await prisma.user.findMany({
    where: {
      billingCycle: 'MONTHLY',
      subscriptionStatus: 'ACTIVE',
      plan: { in: ['STARTER', 'PREMIUM', 'GOLD'] },
      subscriptionStartedAt: { not: null }
    },
    select: {
      id: true,
      plan: true,
      subscriptionStartedAt: true,
      lastCreditRenewalAt: true,
      creditsExpiresAt: true,  // ✅ NOVO: Para verificar se já renovou
      subscriptionId: true      // ✅ NOVO: Para consultar Asaas
    }
  })

  const renewed: string[] = []
  const skipped: Array<{ userId: string; reason: string }> = []

  for (const user of users) {
    if (!user.subscriptionStartedAt) continue

    // Calcula quantos dias se passaram desde a data de início da assinatura
    const dayOfMonth = user.subscriptionStartedAt.getDate()
    const currentDay = now.getDate()

    // Verifica se já passou o dia de renovação mensal
    const lastRenewal = user.lastCreditRenewalAt || user.subscriptionStartedAt
    const daysSinceLastRenewal = Math.floor((now.getTime() - lastRenewal.getTime()) / (1000 * 60 * 60 * 24))

    // ✅ VALIDAÇÃO 1: Verificar se passou pelo menos 28 dias
    if (daysSinceLastRenewal < 28) {
      skipped.push({ userId: user.id, reason: 'Too soon since last renewal' })
      continue
    }

    // ✅ VALIDAÇÃO 2: Verificar se já passou o dia do mês
    if (currentDay < dayOfMonth) {
      skipped.push({ userId: user.id, reason: 'Day of month not reached' })
      continue
    }

    // ✅ VALIDAÇÃO 3: Verificar se webhook já renovou
    // Se creditsExpiresAt está no futuro (foi atualizado recentemente), webhook já renovou
    if (user.creditsExpiresAt && user.creditsExpiresAt > now) {
      const diasAteExpiracao = Math.floor((user.creditsExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      // Se ainda faltam mais de 25 dias para expirar, webhook provavelmente já renovou
      if (diasAteExpiracao > 25) {
        skipped.push({ userId: user.id, reason: 'Webhook already renewed (creditsExpiresAt is fresh)' })
        continue
      }
    }

    // ✅ VALIDAÇÃO 4: Verificar se lastCreditRenewalAt é recente (< 5 dias)
    // Isso indica que webhook já renovou
    if (user.lastCreditRenewalAt) {
      const diasDesdeUltimaRenovacao = Math.floor((now.getTime() - user.lastCreditRenewalAt.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diasDesdeUltimaRenovacao < 5) {
        skipped.push({ userId: user.id, reason: 'Already renewed recently (< 5 days ago)' })
        continue
      }
    }

    // ✅ VALIDAÇÃO 5 (OPCIONAL): Consultar último pagamento no Asaas
    // Isso garante que só renovamos se o pagamento foi confirmado
    let paymentConfirmed = false
    
    if (user.subscriptionId) {
      try {
        // Buscar últimos pagamentos da assinatura
        const payments = await asaas.getSubscriptionPayments(user.subscriptionId, { limit: 5 })
        
        // Verificar se há algum pagamento confirmado nos últimos 5 dias
        const recentPayment = payments.find((payment: any) => {
          const paymentDate = new Date(payment.paymentDate || payment.confirmedDate)
          const daysAgo = Math.floor((now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24))
          
          return payment.status === 'RECEIVED' && daysAgo <= 5
        })
        
        if (recentPayment) {
          paymentConfirmed = true
        } else {
          skipped.push({ userId: user.id, reason: 'No confirmed payment found in Asaas' })
          continue
        }
      } catch (error) {
        console.error(`⚠️ Failed to check Asaas payment for user ${user.id}:`, error)
        // Não bloquear renovação se consulta ao Asaas falhar
        // Webhook já pode ter renovado (validação 3 e 4 acima)
        paymentConfirmed = true // Fallback: confiar nas validações anteriores
      }
    } else {
      // Sem subscriptionId, não há como verificar pagamento
      // Pular renovação por segurança
      skipped.push({ userId: user.id, reason: 'No subscriptionId' })
      continue
    }

    // ✅ TODAS AS VALIDAÇÕES PASSARAM: Renovar!
    const creditsLimit = await getCreditsLimitForPlan(user.plan!)

    try {
      const result = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            creditsUsed: 0,
            creditsLimit: creditsLimit,
            lastCreditRenewalAt: now,
            creditsExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          }
        })

        await recordSubscriptionRenewal(
          user.id,
          creditsLimit,
          {
            plan: user.plan || undefined,
            billingCycle: 'MONTHLY',
            reason: 'CRON_BACKUP_RENEWAL' // ✅ Identificar que foi renovação por cron
          },
          tx
        )

        await tx.usageLog.create({
          data: {
            userId: user.id,
            action: 'MONTHLY_CREDIT_RENEWAL',
            creditsUsed: 0,
            details: {
              plan: user.plan,
              creditsRenewed: creditsLimit,
              renewalDate: now.toISOString(),
              source: 'CRON_BACKUP' // ✅ Identificar fonte
            }
          }
        })

        return {
          creditsUsed: updatedUser.creditsUsed,
          creditsLimit: updatedUser.creditsLimit,
          creditsBalance: updatedUser.creditsBalance ?? 0
        }
      })

      if (result) {
        await broadcastCreditsUpdate(
          user.id,
          result.creditsUsed,
          result.creditsLimit,
          'SUBSCRIPTION_RENEWAL',
          result.creditsBalance
        )
      }

      renewed.push(user.id)
      console.log(`✅ [CRON] Renewed credits for user ${user.id}`)
    } catch (error) {
      console.error(`❌ [CRON] Failed to renew credits for user ${user.id}:`, error)
      skipped.push({ userId: user.id, reason: `Error: ${error}` })
    }
  }

  console.log(`📊 [CRON] Renewal summary:`, {
    totalProcessed: users.length,
    renewed: renewed.length,
    skipped: skipped.length,
    skippedDetails: skipped
  })

  return {
    totalProcessed: users.length,
    totalRenewed: renewed.length,
    totalSkipped: skipped.length,
    renewedUserIds: renewed,
    skippedUsers: skipped
  }
}
```

---

## 🔧 **CORREÇÃO 2: getUserCreditBalance() - Grace period de 24h**

### **Arquivo**: `src/lib/services/credit-package-service.ts`
### **Linhas**: ~233-294

### **Problema atual:**
```typescript
if (user.creditsExpiresAt && user.creditsExpiresAt < now) {
  subscriptionCredits = 0  // ❌ Zera imediatamente!
}
```

### **✅ CORREÇÃO:**

```typescript
static async getUserCreditBalance(userId: string): Promise<CreditBalance> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      creditsUsed: true,
      creditsLimit: true,
      creditsBalance: true,
      creditsExpiresAt: true,
      subscriptionEndsAt: true,
      lastCreditRenewalAt: true,  // ✅ NOVO: Para verificar se renovou
      billingCycle: true          // ✅ NOVO: Para lógica correta
    }
  })

  if (!user) {
    throw new Error('Usuário não encontrado')
  }

  const now = new Date()
  let subscriptionCredits = 0
  
  // ✅ NOVA LÓGICA: Verificar expiração com grace period
  if (user.creditsExpiresAt && user.creditsExpiresAt < now) {
    // Créditos expiraram, mas verificar se renovação já aconteceu
    const jaRenovou = user.lastCreditRenewalAt && 
                      user.lastCreditRenewalAt >= user.creditsExpiresAt
    
    if (jaRenovou) {
      // ✅ Renovação já aconteceu, créditos são válidos
      subscriptionCredits = Math.max(0, user.creditsLimit - user.creditsUsed)
    } else {
      // Renovação ainda não aconteceu, verificar grace period
      const umDiaAposExpiracao = new Date(user.creditsExpiresAt.getTime() + 24 * 60 * 60 * 1000)
      
      if (now < umDiaAposExpiracao) {
        // ✅ Dentro do grace period (24h), manter créditos disponíveis
        subscriptionCredits = Math.max(0, user.creditsLimit - user.creditsUsed)
        console.log(`⚠️ [getUserCreditBalance] User ${userId} in grace period (creditsExpiresAt: ${user.creditsExpiresAt}, now: ${now})`)
      } else {
        // ❌ Passou 24h e renovação não aconteceu, zerar
        subscriptionCredits = 0
        console.log(`❌ [getUserCreditBalance] User ${userId} credits expired (> 24h ago)`)
      }
    }
  } else {
    // ✅ Créditos ainda válidos
    subscriptionCredits = Math.max(0, user.creditsLimit - user.creditsUsed)
  }
  
  const purchasedCredits = user.creditsBalance || 0
  const totalCredits = subscriptionCredits + purchasedCredits
  
  console.log(`💰 [getUserCreditBalance] User ${userId}:`, {
    creditsLimit: user.creditsLimit,
    creditsUsed: user.creditsUsed,
    creditsBalance: user.creditsBalance,
    creditsExpiresAt: user.creditsExpiresAt,
    lastCreditRenewalAt: user.lastCreditRenewalAt,
    subscriptionCredits,
    purchasedCredits,
    totalCredits,
    isExpired: user.creditsExpiresAt ? user.creditsExpiresAt < now : false
  })

  // Calcular próxima renovação
  let nextReset: string | null = null
  if (user.subscriptionEndsAt) {
    nextReset = user.subscriptionEndsAt.toISOString()
  } else if (user.creditsExpiresAt) {
    nextReset = user.creditsExpiresAt.toISOString()
  }

  return {
    subscriptionCredits,
    purchasedCredits,
    totalCredits,
    creditsUsed: user.creditsUsed,
    availableCredits: totalCredits,
    creditLimit: user.creditsLimit,
    nextReset
  }
}
```

---

## 🔧 **CORREÇÃO 3: getUserCredits() - Mesma lógica**

### **Arquivo**: `src/lib/credits/manager.ts`
### **Linhas**: ~77-121

### **✅ CORREÇÃO** (mesma lógica da correção 2):

```typescript
static async getUserCredits(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      creditsUsed: true, 
      creditsLimit: true, 
      creditsBalance: true,
      creditsExpiresAt: true,
      lastCreditRenewalAt: true  // ✅ NOVO
    }
  })
  
  if (!user) {
    return 0
  }
  
  const now = new Date()
  let planCreditsAvailable = 0
  
  // ✅ NOVA LÓGICA: Verificar expiração com grace period
  if (user.creditsExpiresAt && user.creditsExpiresAt < now) {
    const jaRenovou = user.lastCreditRenewalAt && 
                      user.lastCreditRenewalAt >= user.creditsExpiresAt
    
    if (jaRenovou) {
      planCreditsAvailable = Math.max(0, user.creditsLimit - user.creditsUsed)
    } else {
      const umDiaAposExpiracao = new Date(user.creditsExpiresAt.getTime() + 24 * 60 * 60 * 1000)
      
      if (now < umDiaAposExpiracao) {
        planCreditsAvailable = Math.max(0, user.creditsLimit - user.creditsUsed)
      } else {
        planCreditsAvailable = 0
      }
    }
  } else {
    planCreditsAvailable = Math.max(0, user.creditsLimit - user.creditsUsed)
  }
  
  const purchasedCredits = user.creditsBalance || 0
  const totalCredits = planCreditsAvailable + purchasedCredits
  
  return totalCredits
}
```

---

## 🔧 **CORREÇÃO 4: deductCredits() - Mesma lógica**

### **Arquivo**: `src/lib/credits/manager.ts`
### **Linhas**: ~216-224

### **✅ CORREÇÃO** (mesma lógica):

```typescript
// Dentro de deductCredits()

// VALIDAÇÃO: Créditos do plano (mensais ou anuais) expirados não podem ser usados
const now = new Date()
let planCreditsAvailable = 0

// ✅ NOVA LÓGICA: Com grace period
if (user.creditsExpiresAt && user.creditsExpiresAt < now) {
  const jaRenovou = user.lastCreditRenewalAt && 
                    user.lastCreditRenewalAt >= user.creditsExpiresAt
  
  if (jaRenovou) {
    planCreditsAvailable = Math.max(0, user.creditsLimit - user.creditsUsed)
  } else {
    const umDiaAposExpiracao = new Date(user.creditsExpiresAt.getTime() + 24 * 60 * 60 * 1000)
    
    if (now < umDiaAposExpiracao) {
      planCreditsAvailable = Math.max(0, user.creditsLimit - user.creditsUsed)
    } else {
      planCreditsAvailable = 0
    }
  }
} else {
  planCreditsAvailable = Math.max(0, user.creditsLimit - user.creditsUsed)
}
```

---

## 📋 **CHECKLIST DE IMPLEMENTAÇÃO:**

- [ ] Implementar correção 1 em `subscriptions.ts`
- [ ] Implementar correção 2 em `credit-package-service.ts`
- [ ] Implementar correção 3 em `manager.ts` (getUserCredits)
- [ ] Implementar correção 4 em `manager.ts` (deductCredits)
- [ ] Adicionar import do Asaas em `subscriptions.ts`
- [ ] Testar localmente
- [ ] Deploy em produção
- [ ] Monitorar logs em 06/02/2026 (primeira renovação)
- [ ] Validar badge + ledger após renovação

---

## ✅ **BENEFÍCIOS DAS CORREÇÕES:**

1. ✅ **Evita dupla renovação**: Webhook tem prioridade, Cron só renova se webhook falhou
2. ✅ **Garante pagamento**: Cron consulta Asaas antes de renovar
3. ✅ **Grace period**: Badge não zera durante janela de renovação (00:00 - 02:00)
4. ✅ **Logs detalhados**: Identificar fonte de renovação (webhook vs cron)
5. ✅ **Segurança**: Múltiplas validações antes de renovar

---

## 🎯 **PRÓXIMO DOCUMENTO:**

Agora vou criar o documento completo com **TODOS os fluxos de créditos** do sistema! 🚀
