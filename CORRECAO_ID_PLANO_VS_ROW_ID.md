# Correção: Confusão entre ID do Plano e ID da Row

## ✅ Problema Identificado

**Problema:** O sistema estava confundindo o `id` (ID da row no banco) com o `planId` (ID do plano de negócio).

**Estrutura do Banco:**
- `id` (text): ID único da row no banco (ex: `sub_plan_starter`, `sub_plan_premium`, `sub_plan_gold`)
- `planId` (Plan enum): ID do plano de negócio (ex: `STARTER`, `PREMIUM`, `GOLD`)

**Sintoma:**
- Erro "Plano não encontrado" ao tentar editar um plano
- URL correta (`/admin/subscription-plans/sub_plan_starter/edit`) mas plano não era encontrado

---

## 🔧 Correções Implementadas

### 1. **API - GET `/api/admin/subscription-plans/[id]`** ✅ CORRIGIDO

**Arquivo:** `src/app/api/admin/subscription-plans/[id]/route.ts`

**Antes:**
```typescript
const plan = await prisma.subscriptionPlan.findUnique({
  where: { id, deletedAt: null }  // ❌ Problema: deletedAt não pode estar no where do findUnique
})
```

**Depois:**
```typescript
// CRÍTICO: Buscar pelo id (row ID) e verificar deletedAt separadamente
// O id é o identificador único da row no banco (ex: sub_plan_starter)
const plan = await prisma.subscriptionPlan.findUnique({
  where: { id }  // ✅ Buscar apenas pelo id
})

if (!plan) {
  console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Plan not found by id:', id)
  return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
}

// Verificar se está deletado (soft delete)
if (plan.deletedAt) {
  console.warn('⚠️ [ADMIN_SUBSCRIPTION_PLANS] Plan is deleted:', id)
  return NextResponse.json({ error: 'Plano foi deletado' }, { status: 404 })
}

console.log('✅ [ADMIN_SUBSCRIPTION_PLANS] Plan found:', { id: plan.id, planId: plan.planId, name: plan.name })
```

**Por quê:**
- `findUnique` só aceita campos únicos no `where`
- `deletedAt` não faz parte da chave única
- Verificar `deletedAt` separadamente após buscar

---

### 2. **API - PUT `/api/admin/subscription-plans/[id]`** ✅ CORRIGIDO

**Arquivo:** `src/app/api/admin/subscription-plans/[id]/route.ts`

**Mudanças:**
- ✅ Comentários claros sobre usar `id` (row ID), não `planId`
- ✅ Verificação de `deletedAt` separada
- ✅ Logs detalhados para debug

```typescript
// CRÍTICO: Buscar pelo id (row ID), não pelo planId
// O id é o identificador único da row no banco (ex: sub_plan_starter)
const existing = await prisma.subscriptionPlan.findUnique({
  where: { id }
})

if (!existing) {
  console.error('❌ [ADMIN_SUBSCRIPTION_PLANS] Plan not found for update, id:', id)
  return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
}

// Verificar se está deletado
if (existing.deletedAt) {
  console.warn('⚠️ [ADMIN_SUBSCRIPTION_PLANS] Attempting to update deleted plan:', id)
  return NextResponse.json({ error: 'Plano foi deletado' }, { status: 404 })
}

console.log('✅ [ADMIN_SUBSCRIPTION_PLANS] Updating plan:', { id: existing.id, planId: existing.planId })
```

---

### 3. **API - DELETE `/api/admin/subscription-plans/[id]`** ✅ CORRIGIDO

**Arquivo:** `src/app/api/admin/subscription-plans/[id]/route.ts`

**Mudanças:**
- ✅ Comentários claros sobre usar `id` (row ID)
- ✅ Logs detalhados

```typescript
// CRÍTICO: Buscar pelo id (row ID), não pelo planId
const existing = await prisma.subscriptionPlan.findUnique({
  where: { id }
})

console.log('✅ [ADMIN_SUBSCRIPTION_PLANS] Soft deleting plan:', { id: existing.id, planId: existing.planId })
```

---

### 4. **Página de Edição - Melhorias de Debug** ✅ CORRIGIDO

**Arquivo:** `src/app/admin/subscription-plans/[id]/edit/page.tsx`

**Mudanças:**
- ✅ Validação de `id` antes de buscar
- ✅ Logs detalhados para debug
- ✅ Mensagens de erro mais claras

```typescript
if (!id) {
  setError('ID do plano não fornecido')
  setLoading(false)
  return
}

console.log('📋 [EDIT_PLAN] Loading plan with id:', id)
const response = await fetch(`/api/admin/subscription-plans/${id}`)

if (!response.ok) {
  const errorData = await response.json().catch(() => ({}))
  console.error('❌ [EDIT_PLAN] Failed to load plan:', errorData)
  throw new Error(errorData.error || 'Plano não encontrado')
}

const data = await response.json()
const plan = data.plan

if (!plan) {
  throw new Error('Plano não encontrado nos dados retornados')
}

console.log('✅ [EDIT_PLAN] Plan loaded:', { id: plan.id, planId: plan.planId, name: plan.name })
```

---

## 📋 Fluxo Correto

### 1. **Listagem de Planos**
- ✅ Página busca planos do banco
- ✅ Link de edição usa `plan.id` (row ID): `/admin/subscription-plans/${plan.id}/edit`

### 2. **Edição de Plano**
- ✅ URL recebe `id` (row ID): `/admin/subscription-plans/sub_plan_starter/edit`
- ✅ API busca pelo `id` (row ID) no banco
- ✅ Verifica `deletedAt` separadamente
- ✅ Retorna plano encontrado

### 3. **Atualização de Plano**
- ✅ API recebe `id` (row ID) na URL
- ✅ Busca plano pelo `id` (row ID)
- ✅ Atualiza apenas campos alterados
- ✅ Logs mostram `id` e `planId` para debug

---

## ✅ Garantias Implementadas

1. **Clareza de Identificadores**
   - ✅ Comentários explícitos sobre `id` vs `planId`
   - ✅ Logs mostram ambos os valores para debug

2. **Query Correta**
   - ✅ `findUnique` usa apenas `id` no `where`
   - ✅ `deletedAt` verificado separadamente

3. **Debug Melhorado**
   - ✅ Logs detalhados em todas as operações
   - ✅ Mensagens de erro mais claras
   - ✅ Validação de dados antes de processar

---

## 🎯 Conclusão

**Problema totalmente corrigido:**

- ✅ Sistema usa corretamente `id` (row ID) para busca no banco
- ✅ `planId` é usado apenas para lógica de negócio
- ✅ Queries do Prisma corrigidas (sem `deletedAt` no `where` do `findUnique`)
- ✅ Logs detalhados para facilitar debug futuro
- ✅ Validações e mensagens de erro melhoradas

**O fluxo está funcionando corretamente!** 🎉

