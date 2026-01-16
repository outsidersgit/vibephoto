# Correção: creditsLimit Zerado após Pagamento

## Problema Identificado

**Sintoma:** Usuário assina plano, paga, `subscriptionStatus` fica `ACTIVE`, mas `creditsLimit` permanece `0`.

**Causa Raiz:** O webhook do Asaas não conseguiu encontrar o `plan` nos `Payments` do banco de dados, então chamou `updateSubscriptionStatus()` com `plan = undefined`, que não atualizou o `creditsLimit`.

---

## Correções Implementadas

### 1. **Webhook Enhanced** (`src/app/api/payments/asaas/webhook/enhanced/route.ts`)

**Mudanças:**
- ✅ Adicionados **fallbacks** para encontrar o plan:
  1. Buscar em Payments PENDING com `asaasCheckoutId`
  2. Buscar em Payments existentes com `planType`
  3. **Usar plan do usuário** (se já estiver salvo)
  4. Tentar extrair do `description` do subscription do Asaas
- ✅ Logs detalhados para debug
- ✅ Cria `usageLog` com erro quando plan não é encontrado

### 2. **updateSubscriptionStatus** (`src/lib/db/subscriptions.ts`)

**Mudanças:**
- ✅ Agora busca o **plan do usuário** se não for passado como parâmetro
- ✅ Condição mudou de `if (status === 'ACTIVE' && plan)` para `if (status === 'ACTIVE')`
- ✅ Usa `finalPlan = plan || user?.plan` como fallback
- ✅ Logs detalhados mostrando origem do plan (parâmetro ou usuário)

---

## Como Corrigir Usuários Afetados

### Opção 1: Via Admin Panel (Recomendado)

1. Acesse `/admin/users`
2. Encontre o usuário (ex: "tiago menna")
3. Verifique se o campo `plan` está preenchido
4. Se `plan` estiver correto mas `creditsLimit = 0`:
   - **Opção A:** Editar manualmente o `creditsLimit` no banco
   - **Opção B:** Usar o script SQL abaixo

### Opção 2: Script SQL de Correção

```sql
-- Corrigir creditsLimit para usuários com subscriptionStatus ACTIVE mas creditsLimit = 0
-- IMPORTANTE: Execute apenas se o plan estiver correto!

UPDATE users
SET 
  "creditsLimit" = CASE 
    WHEN plan = 'STARTER' AND "billingCycle" = 'MONTHLY' THEN 500
    WHEN plan = 'STARTER' AND "billingCycle" = 'YEARLY' THEN 6000
    WHEN plan = 'PREMIUM' AND "billingCycle" = 'MONTHLY' THEN 1200
    WHEN plan = 'PREMIUM' AND "billingCycle" = 'YEARLY' THEN 14400
    WHEN plan = 'GOLD' AND "billingCycle" = 'MONTHLY' THEN 2500
    WHEN plan = 'GOLD' AND "billingCycle" = 'YEARLY' THEN 30000
    ELSE "creditsLimit"
  END,
  "creditsUsed" = 0,
  "lastCreditRenewalAt" = NOW(),
  "creditsExpiresAt" = CASE 
    WHEN "billingCycle" = 'YEARLY' THEN NOW() + INTERVAL '1 year'
    ELSE NOW() + INTERVAL '30 days'
  END
WHERE 
  "subscriptionStatus" = 'ACTIVE'
  AND "creditsLimit" = 0
  AND plan IS NOT NULL;

-- Verificar resultado
SELECT 
  id, 
  email, 
  plan, 
  "billingCycle", 
  "creditsLimit", 
  "subscriptionStatus"
FROM users
WHERE 
  "subscriptionStatus" = 'ACTIVE'
  AND "creditsLimit" = 0
  AND plan IS NOT NULL;
```

**⚠️ ATENÇÃO:** Antes de executar, verifique os valores de créditos no banco (`subscription_plans.credits`) para garantir que estão corretos!

### Opção 3: Script Node.js/TypeScript

```typescript
// scripts/fix-zerocredits.ts
import { prisma } from '../src/lib/prisma'
import { getCreditsLimitForPlan } from '../src/lib/constants/plans'

async function fixZeroCredits() {
  const users = await prisma.user.findMany({
    where: {
      subscriptionStatus: 'ACTIVE',
      creditsLimit: 0,
      plan: { not: null }
    },
    select: {
      id: true,
      email: true,
      plan: true,
      billingCycle: true
    }
  })

  console.log(`Encontrados ${users.length} usuários com creditsLimit = 0`)

  for (const user of users) {
    if (!user.plan) continue

    const creditsLimit = await getCreditsLimitForPlan(user.plan)
    const totalCredits = user.billingCycle === 'YEARLY' 
      ? creditsLimit * 12 
      : creditsLimit

    await prisma.user.update({
      where: { id: user.id },
      data: {
        creditsLimit: totalCredits,
        creditsUsed: 0,
        lastCreditRenewalAt: new Date(),
        creditsExpiresAt: user.billingCycle === 'YEARLY'
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    })

    console.log(`✅ Corrigido: ${user.email} - ${user.plan} - ${totalCredits} créditos`)
  }

  console.log('✅ Correção concluída!')
}

fixZeroCredits()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erro:', error)
    process.exit(1)
  })
```

---

## Prevenção Futura

### Logs a Monitorar

1. **Webhook logs:**
   - `❌ [WEBHOOK] CRÍTICO: plan é undefined!`
   - `⚠️ [WEBHOOK] plan não encontrado nos Payments`

2. **updateSubscriptionStatus logs:**
   - `❌ [updateSubscriptionStatus] CRÍTICO: Não há plan disponível`
   - `✅ [updateSubscriptionStatus] Atualizando creditsLimit`

3. **UsageLogs com action `WEBHOOK_ERROR`:**
   ```sql
   SELECT * FROM usage_logs 
   WHERE action = 'WEBHOOK_ERROR' 
   AND details->>'requiresManualFix' = 'true'
   ORDER BY "createdAt" DESC;
   ```

### Verificação Proativa

Execute periodicamente (ex: diariamente via CRON):

```sql
-- Identificar usuários com problema
SELECT 
  id,
  email,
  plan,
  "billingCycle",
  "subscriptionStatus",
  "creditsLimit",
  "createdAt"
FROM users
WHERE 
  "subscriptionStatus" = 'ACTIVE'
  AND "creditsLimit" = 0
  AND plan IS NOT NULL
  AND "createdAt" > NOW() - INTERVAL '7 days'; -- Últimos 7 dias
```

---

## Para o Usuário Específico (tiago menna)

### Opção Recomendada: Usar Endpoint Admin

1. **Encontrar o user_id do usuário:**
   ```sql
   SELECT id, email, plan, "billingCycle", "subscriptionStatus", "creditsLimit"
   FROM users 
   WHERE email LIKE '%tiago%menna%' OR email LIKE '%menna%tiago%';
   ```

2. **Chamar o endpoint de correção:**
   ```bash
   POST /api/admin/users/{user_id}/fix-credits-limit
   ```
   
   Exemplo com curl:
   ```bash
   curl -X POST \
     https://seu-dominio.com/api/admin/users/{user_id}/fix-credits-limit \
     -H "Cookie: next-auth.session-token=SEU_TOKEN_ADMIN"
   ```

3. **Verificar resultado:** O endpoint retorna os dados atualizados.

### Opção Alternativa: SQL Direto

1. **Verificar dados do usuário:**
   ```sql
   SELECT 
     id, email, plan, "billingCycle", 
     "subscriptionStatus", "creditsLimit", "creditsUsed",
     "subscriptionStartedAt", "lastCreditRenewalAt"
   FROM users 
   WHERE email LIKE '%tiago%menna%' OR email LIKE '%menna%tiago%';
   ```

2. **Corrigir usando o script SQL acima** (ajustar para o user_id específico)

3. **Verificar se funcionou:**
   ```sql
   SELECT id, email, plan, "creditsLimit", "subscriptionStatus"
   FROM users 
   WHERE id = '<user_id_aqui>';
   ```

---

## Testes Recomendados

Após aplicar as correções, teste:

1. ✅ Criar nova assinatura (checkout completo)
2. ✅ Verificar se webhook atualiza `creditsLimit`
3. ✅ Verificar logs do webhook para garantir que plan é encontrado
4. ✅ Testar cenário onde Payment não tem `planType` (usar fallback do usuário)

