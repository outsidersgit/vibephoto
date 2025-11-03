# Correção: Payments Permanecendo como PENDING

## Problema Identificado

**Sintoma:** Todos os status na tabela `payments` estão como `PENDING`, mesmo quando pagamentos foram confirmados.

**Causa Raiz:** O webhook não estava encontrando o Payment original criado no checkout para atualizar o status para `CONFIRMED`. Isso acontecia porque:

1. A busca era muito restritiva (exigia múltiplos critérios simultâneos)
2. Quando não encontrava, criava um NOVO Payment com status `CONFIRMED`, deixando o original `PENDING`
3. Não havia fallback para buscar Payments já parcialmente atualizados

---

## Correções Implementadas

### 1. **Webhook Enhanced - Múltiplas Estratégias de Busca**

**Arquivo:** `src/app/api/payments/asaas/webhook/enhanced/route.ts`

**Mudanças:**
- ✅ **Estratégia 1:** Buscar pelo `externalReference` = `asaasCheckoutId`
- ✅ **Estratégia 2:** Buscar por critérios gerais (PENDING + checkoutId + sem asaasPaymentId)
- ✅ **Estratégia 3:** Buscar pelo `subscriptionId` (se já foi atualizado antes)
- ✅ **Última tentativa:** Buscar qualquer Payment PENDING antes de criar novo
- ✅ Logs detalhados para debug

### 2. **Melhorias na Atualização**

- ✅ Verifica se Payment já existe antes de criar novo
- ✅ Atualiza Payment PENDING encontrado na última tentativa
- ✅ Logs mostram qual estratégia encontrou o Payment

---

## Como Corrigir Payments PENDING Existentes

### Opção 1: Script SQL (Recomendado para correção em massa)

```sql
-- Identificar Payments PENDING que provavelmente foram confirmados
-- (têm subscriptionId mas status ainda é PENDING)
SELECT 
  id,
  "userId",
  "asaasPaymentId",
  "asaasCheckoutId",
  "subscriptionId",
  status,
  type,
  "planType",
  "billingCycle",
  value,
  "createdAt",
  "dueDate"
FROM payments
WHERE 
  status = 'PENDING'
  AND type = 'SUBSCRIPTION'
  AND "subscriptionId" IS NOT NULL
ORDER BY "createdAt" DESC;

-- Atualizar Payments que têm subscriptionId mas estão PENDING
-- (indica que foram processados mas não atualizados)
UPDATE payments
SET 
  status = 'CONFIRMED',
  "confirmedDate" = COALESCE("confirmedDate", "dueDate", NOW())
WHERE 
  status = 'PENDING'
  AND type = 'SUBSCRIPTION'
  AND "subscriptionId" IS NOT NULL
  AND "confirmedDate" IS NULL;

-- Verificar resultado
SELECT 
  status,
  COUNT(*) as total
FROM payments
WHERE type = 'SUBSCRIPTION'
GROUP BY status;
```

### Opção 2: Script TypeScript (Mais seguro - valida com Asaas)

```typescript
// scripts/fix-pending-payments.ts
import { prisma } from '../src/lib/prisma'
import { asaas } from '../src/lib/payments/asaas'

async function fixPendingPayments() {
  // Buscar Payments PENDING com subscriptionId (já foram processados)
  const pendingPayments = await prisma.payment.findMany({
    where: {
      status: 'PENDING',
      type: 'SUBSCRIPTION',
      subscriptionId: { not: null },
      asaasPaymentId: { not: null } // Tem asaasPaymentId = foi processado pelo Asaas
    },
    select: {
      id: true,
      asaasPaymentId: true,
      subscriptionId: true,
      userId: true,
      value: true,
      dueDate: true,
      planType: true,
      billingCycle: true
    }
  })

  console.log(`Encontrados ${pendingPayments.length} Payments PENDING com subscriptionId`)

  let updated = 0
  let errors = 0

  for (const payment of pendingPayments) {
    try {
      if (!payment.asaasPaymentId) continue

      // Verificar status no Asaas
      const asaasPayment = await asaas.getPayment(payment.asaasPaymentId)
      
      if (asaasPayment?.status === 'CONFIRMED' || asaasPayment?.status === 'RECEIVED') {
        // Atualizar no banco
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'CONFIRMED',
            confirmedDate: asaasPayment.confirmedDate 
              ? new Date(asaasPayment.confirmedDate)
              : payment.dueDate
          }
        })

        console.log(`✅ Atualizado: Payment ${payment.id} - ${payment.asaasPaymentId}`)
        updated++
      } else {
        console.log(`⏸️  Mantido PENDING: Payment ${payment.id} - Status Asaas: ${asaasPayment?.status}`)
      }
    } catch (error: any) {
      console.error(`❌ Erro ao processar Payment ${payment.id}:`, error.message)
      errors++
    }
  }

  console.log(`\n✅ Correção concluída:`)
  console.log(`   - Atualizados: ${updated}`)
  console.log(`   - Erros: ${errors}`)
  console.log(`   - Total processados: ${pendingPayments.length}`)
}

fixPendingPayments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erro fatal:', error)
    process.exit(1)
  })
```

### Opção 3: Endpoint Admin (Correção individual)

Criar endpoint `/api/admin/payments/[id]/fix-status` para corrigir um Payment específico.

---

## Prevenção Futura

### Logs a Monitorar

1. **Webhook logs:**
   - `✅ [WEBHOOK] Payment encontrado pelo externalReference`
   - `✅ [WEBHOOK] Payment encontrado por critérios gerais`
   - `✅ [WEBHOOK] Payment encontrado pelo subscriptionId`
   - `✅ [WEBHOOK] Payment PENDING encontrado e atualizado`
   - `⚠️ [WEBHOOK] Novo Payment criado (original não encontrado)` ← Indica problema

2. **Verificação periódica:**
   ```sql
   -- Verificar Payments PENDING com subscriptionId (já processados mas não atualizados)
   SELECT COUNT(*) 
   FROM payments 
   WHERE status = 'PENDING' 
     AND type = 'SUBSCRIPTION'
     AND "subscriptionId" IS NOT NULL
     AND "createdAt" < NOW() - INTERVAL '1 day'; -- Mais de 1 dia
   ```

### CRON Job Recomendado

Criar um CRON job diário para:
1. Identificar Payments PENDING com mais de 24h e subscriptionId
2. Verificar status no Asaas
3. Atualizar automaticamente se confirmado

---

## Verificação Rápida

```sql
-- Ver distribuição de status
SELECT 
  status,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM payments
WHERE type = 'SUBSCRIPTION'
GROUP BY status
ORDER BY total DESC;

-- Ver Payments PENDING antigos (suspeitos)
SELECT 
  COUNT(*) as total,
  MIN("createdAt") as oldest,
  MAX("createdAt") as newest
FROM payments
WHERE 
  status = 'PENDING'
  AND type = 'SUBSCRIPTION'
  AND "subscriptionId" IS NOT NULL;
```

---

## Testes Recomendados

Após aplicar as correções, teste:

1. ✅ Criar nova assinatura (checkout completo)
2. ✅ Verificar se Payment é criado com status PENDING
3. ✅ Confirmar pagamento no Asaas
4. ✅ Verificar se webhook atualiza Payment para CONFIRMED
5. ✅ Verificar logs para garantir que encontrou o Payment original
6. ✅ Verificar que não criou Payment duplicado

