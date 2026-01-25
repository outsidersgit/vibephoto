# 🐛 Bug Crítico: creditsExpiresAt em Planos Mensais

**Data da Análise**: 25/01/2026  
**Usuário Afetado**: `cmhktfezk0000lb04ergjfykk` (Lucas Aragao)  
**Impacto**: Badge de créditos mostrando valor incorreto (1845 ao invés de 3185)

---

## 📊 Situação Atual

### Dados do Usuário
```
plan: PREMIUM
billingCycle: MONTHLY
subscriptionStatus: ACTIVE
creditsUsed: 160
creditsLimit: 1500 (créditos mensais do plano)
creditsBalance: 1845 (créditos comprados)
creditsExpiresAt: 2026-01-07 ❌ (EXPIROU há 18 dias!)
lastCreditRenewalAt: 2025-12-08 (não renovou desde então)
```

### Cálculo do Badge (API `/api/credits/balance`)
```javascript
// Resposta atual:
{
  "subscriptionCredits": 0,      // ❌ ERRADO! Deveria ser 1340
  "purchasedCredits": 1845,      // ✅ correto
  "totalCredits": 1845           // ❌ ERRADO! Deveria ser 3185
}

// Cálculo esperado:
subscriptionCredits = creditsLimit - creditsUsed = 1500 - 160 = 1340
totalCredits = 1340 + 1845 = 3185
```

---

## 🚨 Causa Raiz: 3 Bugs Interconectados

### Bug #1: `creditsExpiresAt` preenchido para plano MENSAL

**Regra de negócio atual:**
- `creditsExpiresAt` deveria ser usado **APENAS** para planos **ANUAIS** (expiram após 1 ano)
- Planos **MENSAIS** NÃO têm expiração fixa - créditos resetam no ciclo mensal

**Problema:**
O campo `creditsExpiresAt` foi preenchido com `2026-01-07` para um plano **MONTHLY**, causando expiração prematura.

**Arquivo**: `src/lib/db/subscriptions.ts`

Possível origem: Função `updateSubscriptionStatus` ou `activateSubscription` preencheu `creditsExpiresAt` incorretamente.

---

### Bug #2: Lógica de expiração não considera `billingCycle`

**Arquivo**: `src/lib/services/credit-package-service.ts`  
**Linhas**: ~50-60

**Código atual:**
```typescript
let subscriptionCredits = 0;
const now = new Date();

if (user.subscriptionStatus === 'ACTIVE' && user.creditsLimit > 0) {
  subscriptionCredits = Math.max(0, user.creditsLimit - user.creditsUsed);
  
  // ❌ BUG: aplica expiração para TODOS os planos, sem verificar billingCycle
  if (user.creditsExpiresAt && user.creditsExpiresAt < now) {
    subscriptionCredits = 0;
  }
}
```

**Correção necessária:**
```typescript
let subscriptionCredits = 0;
const now = new Date();

if (user.subscriptionStatus === 'ACTIVE' && user.creditsLimit > 0) {
  subscriptionCredits = Math.max(0, user.creditsLimit - user.creditsUsed);
  
  // ✅ CORREÇÃO: só aplicar expiração em planos ANUAIS
  if (user.billingCycle === 'YEARLY' && user.creditsExpiresAt && user.creditsExpiresAt < now) {
    subscriptionCredits = 0;
  }
  
  // Para planos mensais, a expiração é tratada pela renovação mensal (resetar creditsUsed)
}
```

---

### Bug #3: Renovação mensal não executada

**Última renovação**: `2025-12-08`  
**Próxima renovação esperada**: `2026-01-08` (30 dias depois)  
**Hoje**: `2026-01-25` → **Atrasado há 17 dias!**

**Arquivo**: `src/lib/db/subscriptions.ts`  
**Função**: `renewMonthlyCredits()`

**Possíveis causas:**
1. Webhook de renovação não foi disparado pelo Asaas
2. Cron job de renovação não executou
3. Lógica de `shouldRenewMonthlyCredits()` não detectou necessidade de renovação

**Verificar:**
- Logs de webhook em `WebhookEvent` (tipo `SUBSCRIPTION_PAYMENT_SUCCESS`)
- Execução do cron job (se houver)
- Lógica de detecção de ciclo mensal

---

## 🔧 Plano de Correção

### 1. Correção Emergencial (Usuário Específico)

**Arquivo**: `CORRECAO_USUARIO_cmhktfezk0000lb04ergjfykk.sql`

Ações:
- ✅ Setar `creditsExpiresAt = NULL` (não deve ser usado em planos mensais)
- ✅ Atualizar `lastCreditRenewalAt = 2026-01-08` (simular renovação)
- ⚠️ **NÃO** resetar `creditsUsed` (usuário já usou 160 créditos no ciclo)

---

### 2. Correção Sistêmica (Código)

#### 2.1. Atualizar `credit-package-service.ts`

**Arquivo**: `src/lib/services/credit-package-service.ts`

```typescript
// Linha ~55-60 (ajustar conforme necessário)
if (user.subscriptionStatus === 'ACTIVE' && user.creditsLimit > 0) {
  subscriptionCredits = Math.max(0, user.creditsLimit - user.creditsUsed);
  
  // ✅ Aplicar expiração apenas em planos anuais
  if (user.billingCycle === 'YEARLY' && user.creditsExpiresAt && user.creditsExpiresAt < now) {
    subscriptionCredits = 0;
  }
}
```

---

#### 2.2. Corrigir `updateSubscriptionStatus` em `subscriptions.ts`

**Arquivo**: `src/lib/db/subscriptions.ts`  
**Função**: `updateSubscriptionStatus` (linhas ~141-264)

**Garantir que:**
```typescript
// Para planos MENSAIS:
creditsExpiresAt: null  // ❌ NUNCA preencher para mensais

// Para planos ANUAIS:
creditsExpiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)  // +1 ano
```

**Trecho a localizar e corrigir:**
```typescript
// ❌ ANTES (provável código atual):
creditsExpiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)  // +30 dias para MONTHLY (ERRADO!)

// ✅ DEPOIS:
creditsExpiresAt: billingCycle === 'YEARLY' 
  ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) 
  : null  // null para MONTHLY
```

---

#### 2.3. Validar renovação mensal

**Arquivo**: `src/lib/db/subscriptions.ts`  
**Função**: `renewMonthlyCredits()`

Verificar se a lógica está:
1. ✅ Detectando corretamente quando um ciclo mensal expirou
2. ✅ Resetando `creditsUsed = 0`
3. ✅ Atualizando `lastCreditRenewalAt = now`
4. ✅ Registrando transações no ledger (`EXPIRED` + `RENEWED`)

---

### 3. Migração em Massa (Outros Usuários Afetados)

Criar script SQL para corrigir **todos** os usuários com:
- `billingCycle = 'MONTHLY'` 
- `creditsExpiresAt IS NOT NULL`

```sql
UPDATE users
SET "creditsExpiresAt" = NULL
WHERE "billingCycle" = 'MONTHLY' 
  AND "creditsExpiresAt" IS NOT NULL;
```

⚠️ **Executar APÓS validar a correção no usuário de teste!**

---

## 🧪 Validação Pós-Correção

### Testes no Usuário `cmhktfezk0000lb04ergjfykk`

1. **Executar SQL de correção** → `CORRECAO_USUARIO_cmhktfezk0000lb04ergjfykk.sql`

2. **Testar API no console do browser:**
```javascript
// Teste 1: Verificar saldo atualizado
fetch('/api/credits/balance', { credentials: 'include' })
  .then(r => r.json())
  .then(d => console.log('Badge:', d));

// Resultado esperado:
// { subscriptionCredits: 1340, purchasedCredits: 1845, totalCredits: 3185 }
```

3. **Hard refresh** → Badge deve mostrar **3185 créditos**

4. **Verificar no SQL:**
```sql
SELECT 
  "creditsUsed", 
  "creditsLimit", 
  "creditsBalance",
  "creditsExpiresAt",
  (("creditsLimit" - "creditsUsed") + "creditsBalance") as total_calculado
FROM users
WHERE id = 'cmhktfezk0000lb04ergjfykk';

-- Resultado esperado:
-- creditsUsed: 160
-- creditsLimit: 1500
-- creditsBalance: 1845
-- creditsExpiresAt: NULL ✅
-- total_calculado: 3185 ✅
```

---

## 📋 Checklist de Deploy

- [ ] Executar `CORRECAO_USUARIO_cmhktfezk0000lb04ergjfykk.sql` no Supabase
- [ ] Validar saldo no frontend (badge = 3185)
- [ ] Aplicar correção em `src/lib/services/credit-package-service.ts`
- [ ] Aplicar correção em `src/lib/db/subscriptions.ts` (`updateSubscriptionStatus`)
- [ ] Testar criação de nova assinatura MONTHLY → `creditsExpiresAt` deve ser `NULL`
- [ ] Testar criação de nova assinatura YEARLY → `creditsExpiresAt` deve ser `+1 ano`
- [ ] Executar migração em massa para outros usuários mensais afetados
- [ ] Adicionar testes automatizados para prevenir regressão

---

## 🔗 Arquivos Relacionados

- `AUDITORIA_SISTEMA_CREDITOS.md` → Análise completa do sistema
- `CORRECAO_USUARIO_cmhktfezk0000lb04ergjfykk.sql` → Correção SQL específica
- `src/lib/services/credit-package-service.ts` → Cálculo do badge
- `src/lib/db/subscriptions.ts` → Lógica de assinatura e renovação
