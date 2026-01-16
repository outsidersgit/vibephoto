# Análise: Checkout de Assinatura Não Carrega

## 🔍 Problema Identificado

**Sintoma:** Página de checkout não está carregando após migração dos planos do código para o banco de dados.

**Suspeita:** A requisição pode estar tentando buscar planos do código hardcoded ao invés do banco.

---

## 📋 Fluxo Atual

### 1. **Página `/billing/activate`** 
**Arquivo:** `src/app/billing/activate/page.tsx`

**Estado:**
- ✅ Tem estado `plans` e `loadingPlans`
- ❌ **NÃO está carregando planos** - falta `useEffect` para buscar
- ❌ `planDetails` está vazio porque `plans` está vazio
- ✅ Chama `/api/checkout/subscription` com:
  ```json
  {
    "planId": "STARTER" | "PREMIUM" | "GOLD",
    "cycle": "MONTHLY" | "YEARLY"
  }
  ```

---

### 2. **API `/api/checkout/subscription`**
**Arquivo:** `src/app/api/checkout/subscription/route.ts`

**Parâmetros Recebidos:**
```typescript
{
  planId: 'STARTER' | 'PREMIUM' | 'GOLD',  // ✅ Correto
  cycle: 'MONTHLY' | 'YEARLY'              // ✅ Correto
}
```

**Validação:**
- ✅ Valida `planId` contra `['STARTER', 'PREMIUM', 'GOLD']`
- ✅ Valida `cycle` contra `['MONTHLY', 'YEARLY']`

**Chamada:**
- ✅ Chama `createSubscriptionCheckout(planId, cycle, userId)`

---

### 3. **Função `createSubscriptionCheckout`**
**Arquivo:** `src/lib/services/asaas-checkout-service.ts`

**Busca do Plano:**
```typescript
const plan = await getPlanById(planId)  // ✅ Busca do banco primeiro
```

**Função `getPlanById`:**
**Arquivo:** `src/config/pricing.ts`

**Fluxo:**
1. ✅ Tenta buscar do banco: `getSubscriptionPlanById(planId)`
2. ✅ Se não encontrar, usa fallback: `PLANS_FALLBACK.find(p => p.id === planId)`

**Problema Potencial:**
- ❌ `getSubscriptionPlanById` está usando `findUnique` com `deletedAt: null` no `where`
- ❌ Isso pode causar erro se `deletedAt` não faz parte da chave única

---

### 4. **Função `getSubscriptionPlanById`**
**Arquivo:** `src/lib/db/subscription-plans.ts`

**Código Atual:**
```typescript
const plan = await prisma.subscriptionPlan.findUnique({
  where: {
    planId,
    deletedAt: null  // ❌ PROBLEMA: findUnique não aceita múltiplos campos
  }
})
```

**Correção Necessária:**
```typescript
const plan = await prisma.subscriptionPlan.findUnique({
  where: { planId }  // ✅ Buscar apenas pelo planId
})

if (!plan || plan.deletedAt) return null  // ✅ Verificar deletedAt separadamente
```

---

## ✅ Parâmetros Confirmados

### **API `/api/checkout/subscription`**
**Método:** `POST`

**Body:**
```json
{
  "planId": "STARTER" | "PREMIUM" | "GOLD",
  "cycle": "MONTHLY" | "YEARLY"
}
```

**Resposta Esperada:**
```json
{
  "success": true,
  "checkoutId": "string",
  "checkoutUrl": "string"
}
```

**Resposta de Erro:**
```json
{
  "success": false,
  "error": "string"
}
```

---

## 🔧 Correções Necessárias

### 1. **Corrigir `getSubscriptionPlanById`** ✅ (já corrigido)
- Remover `deletedAt: null` do `where`
- Verificar `deletedAt` separadamente

### 2. **Adicionar carregamento de planos em `/billing/activate`** ❌ (pendente)
- Adicionar `useEffect` para buscar planos de `/api/subscription-plans`
- Usar fallback se API falhar

### 3. **Verificar se `getPlanById` está funcionando corretamente**
- Confirmar que busca do banco está retornando dados
- Verificar logs de erro

---

## 📝 Checklist de Validação

- [ ] `getSubscriptionPlanById` corrigido (verificar `deletedAt` separadamente)
- [ ] Página `/billing/activate` carrega planos do banco
- [ ] API `/api/checkout/subscription` recebe `planId` e `cycle` corretos
- [ ] `createSubscriptionCheckout` busca plano do banco via `getPlanById`
- [ ] `getPlanById` retorna plano do banco ou fallback
- [ ] Logs mostram erros específicos (se houver)

---

## 🎯 Próximos Passos

1. ✅ Corrigir `getSubscriptionPlanById` (já feito)
2. ⏳ Adicionar carregamento de planos em `/billing/activate`
3. ⏳ Testar fluxo completo e verificar logs

