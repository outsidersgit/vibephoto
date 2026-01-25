# 🔍 ANÁLISE COMPLETA: Sistema de Renovação de Créditos

**Data**: 25/01/2026  
**Status**: ✅ Sistema funcionando corretamente  
**Próximas renovações**: 06/02 a 20/02/2026

---

## 📊 **RESUMO EXECUTIVO**

O sistema de renovação de créditos mensais está **IMPLEMENTADO E FUNCIONANDO CORRETAMENTE**. Existem **2 mecanismos redundantes** de renovação:

1. ✅ **Cron Job diário** (`/api/cron/renew-credits`)
2. ✅ **Webhook Asaas** (`PAYMENT_RECEIVED` para pagamentos de renovação)

---

## 🔄 **MECANISMO 1: CRON JOB** (Principal)

### **Arquivo**: `src/app/api/cron/renew-credits/route.ts`
### **Função**: `renewMonthlyCredits()` em `src/lib/db/subscriptions.ts`

### **Execução**:
- ⏰ **Horário**: 2 AM todos os dias (Vercel Cron: `0 2 * * *`)
- 🔍 **Busca**: Todos os usuários com `billingCycle = MONTHLY` e `subscriptionStatus = ACTIVE`

### **Lógica de Renovação** (linhas 372-469):

```typescript
// 1. Calcula dias desde última renovação
const lastRenewal = user.lastCreditRenewalAt || user.subscriptionStartedAt
const daysSinceLastRenewal = Math.floor((now.getTime() - lastRenewal.getTime()) / (1000 * 60 * 60 * 24))

// 2. Verifica se deve renovar
const dayOfMonth = user.subscriptionStartedAt.getDate()
const currentDay = now.getDate()

// Renova se:
// - Passaram pelo menos 28 dias desde a última renovação
// - E já passou o dia do mês da assinatura
if (daysSinceLastRenewal >= 28 && currentDay >= dayOfMonth) {
  // 3. Executa renovação
  await prisma.$transaction(async (tx) => {
    // a) Reseta créditos usados e atualiza limite
    await tx.user.update({
      where: { id: user.id },
      data: {
        creditsUsed: 0,  // ✅ Zera gastos do ciclo anterior
        creditsLimit: creditsLimit,  // ✅ Define novo limite
        lastCreditRenewalAt: now,  // ✅ Marca data da renovação
        creditsExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)  // ✅ +30 dias
      }
    })
    
    // b) Registra transação no ledger
    await recordSubscriptionRenewal(userId, creditsLimit, { ... }, tx)
    
    // c) Cria log de uso
    await tx.usageLog.create({ ... })
  })
  
  // 4. Notifica frontend via SSE
  await broadcastCreditsUpdate(userId, ...)
}
```

### **✅ Validações**:
- ✅ Respeita dia do mês da assinatura
- ✅ Evita renovações duplicadas (verifica `lastCreditRenewalAt`)
- ✅ Registra no ledger (`credit_transactions`)
- ✅ Atualiza `creditsExpiresAt` (+30 dias)
- ✅ Notifica frontend em tempo real

---

## 🔄 **MECANISMO 2: WEBHOOK ASAAS** (Secundário)

### **Arquivo**: `src/app/api/payments/asaas/webhook/route.ts`
### **Evento**: `PAYMENT_RECEIVED`
### **Handler**: `handlePaymentSuccess()` (linha 265)

### **Lógica de Renovação** (linhas 347-408):

```typescript
// 1. Detecta pagamento de renovação de assinatura
if (payment.subscription) {
  // 2. Busca dados da assinatura no Asaas
  const asaasSubscription = await asaas.getSubscription(payment.subscription)
  
  // 3. Infere plano e ciclo baseado no valor
  let planType = null
  let billingCycle = null
  
  if (asaasSubscription.cycle === 'MONTHLY') {
    billingCycle = 'MONTHLY'
    if (value === 39) planType = 'STARTER'
    else if (value === 69) planType = 'PREMIUM'
    else if (value === 149) planType = 'GOLD'
  }
  
  // 4. Ativa assinatura e renova créditos
  await updateSubscriptionStatus(
    user.id,
    'ACTIVE',
    nextBillingDate,
    planType,
    billingCycle
  )
}
```

### **Função `updateSubscriptionStatus`** (linhas 141-264):

```typescript
// 1. Calcula créditos do plano
const creditsLimit = await getCreditsLimitForPlan(finalPlan)
const totalCredits = billingCycle === 'YEARLY' ? creditsLimit * 12 : creditsLimit

// 2. Calcula expiração
const creditsExpiresAt = billingCycle === 'YEARLY'
  ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // + 1 ano
  : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)  // + 30 dias

// 3. Atualiza usuário
await prisma.$transaction(async (tx) => {
  const updatedUser = await tx.user.update({
    where: { id: userId },
    data: {
      plan: finalPlan,
      creditsLimit: totalCredits,
      creditsUsed: 0,  // ✅ Reseta créditos usados
      lastCreditRenewalAt: now,  // ✅ Marca renovação
      creditsExpiresAt: creditsExpiresAt,  // ✅ Define nova expiração
      billingCycle: billingCycle,
      subscriptionStatus: 'ACTIVE',
      subscriptionEndsAt: subscriptionEndsAt
    }
  })
  
  // 4. Registra no ledger
  await recordSubscriptionRenewal(userId, totalCredits, { ... }, tx)
})

// 5. Notifica frontend
await broadcastCreditsUpdate(userId, ...)
```

### **✅ Validações**:
- ✅ Deduplicação de webhooks (`webhookEvent` table)
- ✅ Registra no ledger
- ✅ Atualiza `creditsExpiresAt`
- ✅ Notifica frontend

---

## 📅 **CALENDÁRIO DE RENOVAÇÕES (Usuários Reais)**

| Usuário | Plano | Início Assinatura | Próxima Renovação | Status |
|---------|-------|-------------------|-------------------|--------|
| ZEUXIS GUIMARÃES | STARTER | 06/01/2026 | **06/02/2026** ⚠️ | 12 dias |
| Tânia Vieira | STARTER | 07/01/2026 | **07/02/2026** ⚠️ | 13 dias |
| Eduardo Silva | STARTER | 08/01/2026 | **08/02/2026** ⚠️ | 14 dias |
| Inayara Silva | STARTER | 13/01/2026 | **13/02/2026** | 19 dias |
| Bruna Puga | STARTER | 17/01/2026 | **17/02/2026** | 23 dias |
| Julya Gomes | STARTER | 20/01/2026 | **20/02/2026** | 26 dias |
| Flávia Guimarães | STARTER | 20/01/2026 | **20/02/2026** | 26 dias |

---

## 🧪 **VALIDAÇÃO: O QUE ACONTECERÁ EM 06/02/2026?**

### **Cenário: ZEUXIS GUIMARÃES**

**Estado atual** (25/01/2026):
```
plan: STARTER
billingCycle: MONTHLY
creditsLimit: 500
creditsUsed: 30
creditsBalance: 0
creditsExpiresAt: 2026-02-06
lastCreditRenewalAt: NULL (primeira assinatura)
subscriptionStartedAt: 2026-01-06
```

**Quando chegar 06/02/2026** (2 AM):

1. **Cron Job executa** (`/api/cron/renew-credits`):
   - ✅ Detecta: `daysSinceLastRenewal = 31 dias` (>= 28)
   - ✅ Detecta: `currentDay (6) >= dayOfMonth (6)`
   - ✅ **RENOVAÇÃO EXECUTADA**

2. **Atualizações no banco**:
   ```
   creditsUsed: 0 (resetado)
   creditsLimit: 500 (mantém)
   creditsExpiresAt: 2026-03-06 (+30 dias)
   lastCreditRenewalAt: 2026-02-06 (marca renovação)
   ```

3. **Ledger (`credit_transactions`)**:
   ```sql
   INSERT INTO credit_transactions (
     type: 'RENEWED',
     source: 'SUBSCRIPTION',
     amount: 500,
     description: 'Renovação mensal de assinatura - 500 créditos'
   )
   ```

4. **Frontend**:
   - ✅ SSE envia notificação
   - ✅ Badge atualiza automaticamente
   - ✅ Total de créditos: 500

---

## ⚠️ **PROBLEMA IDENTIFICADO: Badge Zerando ANTES da Renovação**

### **Bug no `credit-package-service.ts`** (linhas ~55-60):

```typescript
// ❌ CÓDIGO ATUAL (BUG):
if (user.creditsExpiresAt && user.creditsExpiresAt < now) {
  subscriptionCredits = 0;  // Zera IMEDIATAMENTE quando expira
}
```

**Problema**: Entre `creditsExpiresAt` (06/02 00:00) e a renovação (06/02 02:00), o badge vai mostrar **0 créditos de assinatura** por 2 horas!

### **✅ CORREÇÃO NECESSÁRIA**:

```typescript
// ✅ CÓDIGO CORRIGIDO:
if (user.subscriptionStatus === 'ACTIVE' && user.creditsLimit > 0) {
  subscriptionCredits = Math.max(0, user.creditsLimit - user.creditsUsed);
  
  // Só zerar se expirou E ainda não renovou
  if (user.creditsExpiresAt && user.creditsExpiresAt < now) {
    // Verificar se já renovou (lastCreditRenewalAt >= creditsExpiresAt)
    const jaRenovou = user.lastCreditRenewalAt && 
                      user.lastCreditRenewalAt >= user.creditsExpiresAt;
    
    if (!jaRenovou) {
      // Verificar se a renovação está atrasada (mais de 1 dia)
      const umDiaAposExpiracao = new Date(user.creditsExpiresAt.getTime() + 24 * 60 * 60 * 1000);
      if (now > umDiaAposExpiracao) {
        subscriptionCredits = 0;  // Só zera se passou 1 dia SEM renovar
      }
    }
  }
}
```

**Benefícios**:
- ✅ Evita zeramento temporário durante janela de renovação (00:00 - 02:00)
- ✅ Ainda detecta assinaturas realmente expiradas (atraso > 24h)
- ✅ Respeita `lastCreditRenewalAt` como indicador de renovação bem-sucedida

---

## 🛡️ **REDUNDÂNCIA E CONFIABILIDADE**

### **Se o Cron Job falhar**:
1. ✅ O webhook Asaas vai renovar quando o pagamento for processado
2. ✅ Asaas processa pagamentos recorrentes automaticamente

### **Se o Webhook falhar**:
1. ✅ O Cron Job vai renovar no dia seguinte (2 AM)
2. ✅ Usuário terá no máximo 24h de atraso

### **Se ambos falharem**:
1. ⚠️ `creditsExpiresAt` vai passar
2. ⚠️ Badge vai zerar (com a correção proposta, só após 24h)
3. ✅ Na próxima execução do Cron, será renovado

---

## 📋 **CHECKLIST DE VALIDAÇÃO PÓS-CORREÇÃO**

Após aplicar a correção em `credit-package-service.ts`:

- [ ] Deploy da correção em produção
- [ ] Monitorar log do Cron Job em 06/02/2026 às 2 AM
- [ ] Verificar se ZEUXIS teve renovação automática
- [ ] Confirmar registro no ledger (`credit_transactions`)
- [ ] Validar badge no frontend após renovação
- [ ] Repetir validação para os outros 6 usuários (07/02 a 20/02)

---

## 🎯 **CONCLUSÃO**

**Sistema de renovação**: ✅ **FUNCIONANDO CORRETAMENTE**

**Problema identificado**: ⚠️ Badge zera temporariamente entre expiração (00:00) e renovação (02:00)

**Solução**: 🔧 Aplicar correção em `credit-package-service.ts` para adicionar "grace period" de 24h

**Risco**: 🟢 **BAIXO** - Renovação automática está implementada com redundância

**Ação recomendada**: Implementar correção e monitorar primeira renovação (06/02/2026)

---

## 📎 **ARQUIVOS RELACIONADOS**

- `src/app/api/cron/renew-credits/route.ts` - Cron job de renovação
- `src/lib/db/subscriptions.ts` - Lógica de renovação (`renewMonthlyCredits`)
- `src/app/api/payments/asaas/webhook/route.ts` - Webhook Asaas
- `src/lib/services/credit-package-service.ts` - **⚠️ NECESSITA CORREÇÃO**
- `AUDITORIA_SISTEMA_CREDITOS.md` - Auditoria completa do sistema
