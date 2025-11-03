# Verificação: Fluxo de Checkout - Código vs Banco de Dados

## ✅ Fluxo Verificado

### 1. **Página `/billing/activate`**
**Arquivo:** `src/app/billing/activate/page.tsx`

**Chamada:**
```typescript
POST /api/checkout/subscription
Body: {
  planId: "STARTER" | "PREMIUM" | "GOLD",
  cycle: "MONTHLY" | "YEARLY"
}
```

---

### 2. **API `/api/checkout/subscription`**
**Arquivo:** `src/app/api/checkout/subscription/route.ts`

**Ação:**
- ✅ Recebe `planId` e `cycle`
- ✅ Valida parâmetros
- ✅ Chama `createSubscriptionCheckout(planId, cycle, userId)`

---

### 3. **Função `createSubscriptionCheckout`**
**Arquivo:** `src/lib/services/asaas-checkout-service.ts`

**Fluxo:**
```typescript
// 1. Busca plano via getPlanById(planId)
const plan = await getPlanById(planId)

// 2. Usa plan.monthlyPrice ou plan.annualPrice conforme cycle
const value = cycle === 'YEARLY' ? plan.annualPrice : plan.monthlyPrice

// 3. Monta checkout com dados do plano
```

**Logs adicionados:**
- 🔍 `[CHECKOUT] Buscando plano: {planId}`
- ✅ `[CHECKOUT] Plano encontrado: {dados}` + indicação se veio do BANCO ou FALLBACK
- ❌ `[CHECKOUT] Plano não encontrado: {planId}`

---

### 4. **Função `getPlanById`**
**Arquivo:** `src/config/pricing.ts`

**Fluxo:**
```typescript
// 1. Tenta buscar do BANCO primeiro
const dbPlan = await getSubscriptionPlanById(planId)

// 2. Se encontrou no banco, retorna
if (dbPlan) return { ...dbPlan }

// 3. Se não encontrou, usa FALLBACK (código hardcoded)
return PLANS_FALLBACK.find(p => p.id === planId)
```

**Logs adicionados:**
- 🔍 `[PRICING] getPlanById chamado para: {planId}`
- 📊 `[PRICING] Tentando buscar do banco de dados...`
- ✅ `[PRICING] Plano encontrado no BANCO DE DADOS: {dados}`
- ⚠️ `[PRICING] Plano não encontrado no banco de dados, usando fallback`
- 🔄 `[PRICING] Usando plano FALLBACK (código hardcoded): {dados}`
- ❌ `[PRICING] Erro ao buscar plano do banco: {erro}`

---

### 5. **Função `getSubscriptionPlanById`**
**Arquivo:** `src/lib/db/subscription-plans.ts`

**Fluxo:**
```typescript
// 1. Busca pelo planId (chave única)
const plan = await prisma.subscriptionPlan.findUnique({
  where: { planId }
})

// 2. Verifica se está deletado (soft delete)
if (!plan || plan.deletedAt) return null

// 3. Retorna plano encontrado
return { ...plan }
```

**Logs adicionados:**
- 🔍 `[DB] getSubscriptionPlanById chamado para: {planId}`
- ✅ `[DB] Plano encontrado no banco: {dados}`
- ⚠️ `[DB] Plano não encontrado no banco: {planId}`
- ⚠️ `[DB] Plano encontrado mas está deletado (soft delete): {planId}`
- ❌ `[DB] Erro ao buscar plano do banco: {erro}`

---

## 📊 Como Verificar

### **Logs no Console do Servidor**

Quando você tentar criar um checkout, verá uma sequência de logs:

```
🔍 [CHECKOUT] Buscando plano: STARTER
🔍 [PRICING] getPlanById chamado para: STARTER
📊 [PRICING] Tentando buscar do banco de dados...
🔍 [DB] getSubscriptionPlanById chamado para: STARTER
✅ [DB] Plano encontrado no banco: { planId: 'STARTER', name: '...', monthlyPrice: 89, ... }
✅ [PRICING] Plano encontrado no BANCO DE DADOS: { ... }
✅ [CHECKOUT] Plano encontrado: { id: 'STARTER', name: '...', source: 'BANCO DE DADOS' }
```

**OU se não encontrar no banco:**

```
🔍 [CHECKOUT] Buscando plano: STARTER
🔍 [PRICING] getPlanById chamado para: STARTER
📊 [PRICING] Tentando buscar do banco de dados...
🔍 [DB] getSubscriptionPlanById chamado para: STARTER
⚠️ [DB] Plano não encontrado no banco: STARTER
⚠️ [PRICING] Plano não encontrado no banco de dados, usando fallback
🔄 [PRICING] Usando plano FALLBACK (código hardcoded): { id: 'STARTER', monthlyPrice: 5, ... }
✅ [CHECKOUT] Plano encontrado: { id: 'STARTER', name: '...', source: 'FALLBACK (código)' }
```

---

## 🎯 Resultado

**O sistema está configurado para:**
1. ✅ **Tentar buscar do BANCO primeiro** (`getSubscriptionPlanById`)
2. ✅ **Se não encontrar, usar FALLBACK** (código hardcoded)
3. ✅ **Logs detalhados** para identificar qual fonte foi usada

**Para verificar se está funcionando:**
1. Teste criar um checkout
2. Observe os logs no console do servidor
3. Verifique se aparece `BANCO DE DADOS` ou `FALLBACK (código)`

---

## 🔧 Correções Aplicadas

1. ✅ Adicionados logs detalhados em todas as camadas
2. ✅ Indicação clara da origem dos dados (BANCO vs FALLBACK)
3. ✅ Correção em `getSubscriptionPlanById` para buscar corretamente do banco
4. ✅ Tratamento de erros melhorado com fallback

---

## 📝 Próximos Passos

**Teste agora e verifique os logs:**
- Se aparecer `BANCO DE DADOS` → ✅ Está funcionando corretamente
- Se aparecer `FALLBACK (código)` → ⚠️ Plano não está no banco ou há erro na busca

