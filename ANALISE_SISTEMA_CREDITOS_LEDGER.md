# ANÁLISE COMPLETA: Sistema de Créditos e Ledger (/account/orders)

## Data: 25 de Janeiro de 2026

---

## 📋 SUMÁRIO EXECUTIVO

### Problema Reportado
- Alguns usuários não têm **nenhum registro** em `/account/orders` (tabela `credit_transactions`)
- Outros usuários têm registros, mas o **saldo calculado diverge** do saldo real
- Renovações mensais, expirações e entrada de novos créditos parecem inconsistentes

### Status Atual
⚠️ **SISTEMA PARCIALMENTE QUEBRADO** - Ledger não é fonte da verdade confiável

---

## 🔍 DIAGNÓSTICO TÉCNICO

### 1. Arquitetura do Sistema de Créditos

#### 1.1. Modelo de Dados (`User` table)

```prisma
model User {
  // Créditos do plano (renovam mensalmente/anualmente)
  creditsUsed: Int     // Créditos já consumidos DO PLANO
  creditsLimit: Int    // Limite total de créditos DO PLANO
  
  // Créditos avulsos (comprados separadamente)
  creditsBalance: Int  // Saldo de créditos COMPRADOS (não do plano)
  
  // Datas importantes
  subscriptionStartedAt: DateTime?
  lastCreditRenewalAt: DateTime?
  creditsExpiresAt: DateTime?
}
```

**Fórmula do Saldo Total:**
```
Saldo Disponível = (creditsLimit - creditsUsed) + creditsBalance
                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^
                    Créditos restantes do plano    Créditos comprados
```

#### 1.2. Modelo de Ledger (`CreditTransaction`)

```prisma
model CreditTransaction {
  id: String
  userId: String
  type: CreditTransactionType  // EARNED, SPENT, EXPIRED, REFUNDED
  source: CreditTransactionSource  // SUBSCRIPTION, PURCHASE, GENERATION, etc
  amount: Int  // Positivo para entrada, Negativo para saída
  balanceAfter: Int  // Saldo APÓS esta transação
  description: String?
  referenceId: String?  // ID da geração/modelo/vídeo
  creditPurchaseId: String?
  metadata: Json?
  createdAt: DateTime
}
```

**Tipos de transação:**
- `EARNED`: Créditos adicionados (renovação, compra, bônus)
- `SPENT`: Créditos gastos (geração, treinamento, edição, vídeo)
- `EXPIRED`: Créditos expirados
- `REFUNDED`: Créditos reembolsados

**Fontes de transação:**
- `SUBSCRIPTION`: Renovação mensal/anual
- `PURCHASE`: Compra de pacote de créditos
- `BONUS`: Créditos bônus
- `GENERATION`: Geração de imagem (10 créditos/imagem)
- `TRAINING`: Criação de modelo IA
- `EDIT`: Edição de imagem (20 créditos standard, 30 créditos 4K)
- `VIDEO`: Geração de vídeo (80/120/160 créditos para 4s/6s/8s)
- `EXPIRATION`: Créditos expirados
- `REFUND`: Reembolso

---

### 2. Pontos de Entrada de Créditos (EARNED)

#### 2.1. ✅ Renovação de Assinatura (ATIVA)

**Arquivo:** `src/lib/db/subscriptions.ts`

**Quando acontece:**
- Webhook `PAYMENT_CONFIRMED` (primeiro pagamento)
- Webhook `PAYMENT_RECEIVED` (renovações mensais)
- Cron job de renovação mensal (`/api/cron/renew-monthly-credits`)

**Lógica de renovação:**
```typescript
// src/lib/db/subscriptions.ts - updateSubscriptionStatus()

updateData.creditsLimit = totalCredits
updateData.creditsUsed = 0  // ❗ RESET completo (créditos antigos NÃO acumulam)
updateData.lastCreditRenewalAt = now
updateData.creditsExpiresAt = creditsExpiresAt

// ✅ Registra no ledger
await recordSubscriptionRenewal(
  userId,
  totalCredits,
  { plan, billingCycle, reason: 'SUBSCRIPTION_ACTIVATED' }
)
```

**✅ STATUS:** **Funcionando corretamente** - registra no ledger via `recordSubscriptionRenewal()`

---

#### 2.2. ✅ Compra de Créditos Avulsos (ATIVA)

**Arquivo:** `src/lib/services/credit-service.ts`

**Quando acontece:**
- Webhook `PAYMENT_CONFIRMED` para pagamentos tipo `CREDIT_PURCHASE`

**Lógica:**
```typescript
// src/lib/services/credit-service.ts - confirmCreditPurchase()

await tx.user.update({
  data: {
    creditsBalance: { increment: purchase.creditAmount }
  }
})

// ✅ Registra no ledger
await recordCreditPurchase(
  purchase.userId,
  purchase.id,
  purchase.creditAmount,
  { packageName }
)
```

**✅ STATUS:** **Funcionando corretamente** - registra no ledger via `recordCreditPurchase()`

---

#### 2.3. ⚠️ Créditos Bônus (MANUAL)

**Arquivo:** `src/lib/services/credit-transaction-service.ts`

**Quando acontece:**
- Manualmente via admin (não automatizado)

**✅ STATUS:** **Funcionando** quando chamado, mas **uso raro**

---

### 3. Pontos de Saída de Créditos (SPENT)

#### 3.1. ✅ Geração de Imagens (ATIVA)

**Arquivo:** `src/lib/credits/manager.ts`

**Quando acontece:**
- Após geração de imagem ser confirmada (webhook Replicate/Astria)

**Lógica:**
```typescript
// src/lib/credits/manager.ts - consumeCredits()

// Atualiza User table
await tx.user.update({
  data: {
    creditsUsed: { increment: amount },  // ou creditsBalance decrement
  }
})

// ✅ Registra no ledger (background)
await recordImageGenerationCost(userId, generationId, amount, metadata)
```

**✅ STATUS:** **Funcionando corretamente** - registra no ledger via `recordImageGenerationCost()`

---

#### 3.2. ✅ Criação de Modelo IA (ATIVA)

**Arquivo:** `src/app/api/webhooks/training/route.ts`

**Quando acontece:**
- Após treinamento de modelo ser concluído com sucesso

**Lógica:**
```typescript
await prisma.user.update({
  data: { creditsUsed: { increment: creditsUsed } }
})

// ✅ Registra no ledger
await recordModelTrainingCost(model.userId, model.id, creditsUsed)
```

**✅ STATUS:** **Funcionando corretamente** - registra no ledger via `recordModelTrainingCost()`

---

#### 3.3. ✅ Edição de Imagem (ATIVA)

**Arquivo:** `src/lib/credits/manager.ts`

**Lógica similar à geração, registra via `recordImageEditCost()`**

**✅ STATUS:** **Funcionando corretamente**

---

#### 3.4. ✅ Geração de Vídeo (ATIVA)

**Arquivo:** `src/lib/credits/manager.ts`

**Lógica similar à geração, registra via `recordVideoGenerationCost()`**

**✅ STATUS:** **Funcionando corretamente**

---

#### 3.5. ✅ Pacotes de Fotos (ATIVA)

**Arquivo:** `src/lib/services/credit-transaction-service.ts`

**Quando acontece:**
- Ao ativar um pacote de fotos (cobrado upfront)

**Lógica:**
```typescript
await recordPhotoPackagePurchase(
  userId,
  userPackageId,
  creditsUsed,
  { packageName }
)
```

**✅ STATUS:** **Funcionando corretamente**

---

### 4. ❌ PROBLEMAS IDENTIFICADOS

#### Problema 1: **Renovação Mensal SEM Registrar Expiração dos Créditos Antigos**

**Arquivo:** `src/lib/db/subscriptions.ts` (linha 183)

```typescript
updateData.creditsUsed = 0  // ❌ RESET direto sem registrar no ledger
```

**O QUE ESTÁ QUEBRADO:**
1. Usuário tem **100 créditos do plano** (limit: 200, used: 100)
2. Chega renovação mensal
3. Sistema faz: `creditsUsed = 0` e `creditsLimit = 200` (novo ciclo)
4. **❌ NÃO registra no ledger** que 100 créditos foram "expirados/removidos"
5. Ledger mostra: última transação com `balanceAfter = 100`
6. User table mostra: saldo atual = 200
7. **DIVERGÊNCIA: 100 créditos**

**EXEMPLO REAL:**

```
// Antes da renovação
User: { creditsLimit: 200, creditsUsed: 100, creditsBalance: 0 }
Saldo real: 100

Último CreditTransaction:
  type: SPENT
  amount: -10
  balanceAfter: 100  // ✅ Correto até aqui

// Renovação acontece
updateData.creditsUsed = 0  // ❌ RESET sem registro
updateData.creditsLimit = 200

await recordSubscriptionRenewal(userId, 200, ...)  // ✅ Registra entrada de 200

// Após renovação
User: { creditsLimit: 200, creditsUsed: 0, creditsBalance: 0 }
Saldo real: 200

Transações no Ledger:
1. SPENT, -10, balanceAfter: 100
2. EARNED, +200, balanceAfter: ???  // ❌ PROBLEMA: deveria ser 200, mas lógica usa lastTransaction

Cálculo do balanceAfter no createCreditTransaction():
  lastTransaction.balanceAfter = 100 (antes da renovação)
  amount = +200
  effectiveBalance = 100 + 200 = 300  // ❌ ERRADO! Deveria ser 200
```

**CAUSA RAIZ:**
O `createCreditTransaction()` calcula `balanceAfter` somando `amount` ao `lastTransaction.balanceAfter`. Mas quando há renovação mensal, os créditos antigos "desaparecem" (via reset de `creditsUsed`) **sem registro no ledger**, causando divergência.

---

#### Problema 2: **Expiração de Créditos Anuais Sem Registro no Ledger**

**Arquivo:** `src/app/api/cron/expire-yearly-credits/route.ts`

```typescript
// Expira créditos de usuários anuais
await prisma.user.update({
  where: { id: user.id },
  data: {
    creditsUsed: 0,
    creditsLimit: 0,
    // ❌ NÃO registra no ledger
  }
})
```

**O QUE ESTÁ QUEBRADO:**
- Créditos de planos anuais expiram após 12 meses
- Sistema zera `creditsLimit` e `creditsUsed`
- **❌ NÃO registra no ledger** via `recordCreditExpiration()`
- Ledger continua mostrando saldo antigo

---

#### Problema 3: **Usuários Novos Sem Primeira Transação**

**Cenário:**
- Usuário cria conta
- Assina plano Starter (200 créditos)
- Webhook `PAYMENT_CONFIRMED` é processado
- Sistema seta `creditsLimit = 200`, `creditsUsed = 0`
- ✅ `recordSubscriptionRenewal()` é chamado

**MAS:** Se houver erro no `recordSubscriptionRenewal()` (timeout, falha do banco, etc), a transação NÃO é criada.

**User table:** Mostra 200 créditos
**Ledger:** Vazio (0 transações)

---

#### Problema 4: **Lógica de `balanceAfter` Depende de Transação Anterior**

**Arquivo:** `src/lib/services/credit-transaction-service.ts` (linha 58)

```typescript
const lastTransaction = await client.creditTransaction.findFirst({
  where: { userId },
  orderBy: { createdAt: 'desc' },
  select: { balanceAfter: true }
})

let balanceBefore = newBalance  // ❌ Usa User table como fallback
if (lastTransaction) {
  balanceBefore = lastTransaction.balanceAfter  // ❌ Depende do lastTransaction
}

const effectiveBalance = balanceBefore + amount
```

**PROBLEMA:**
1. Se `lastTransaction.balanceAfter` estiver errado, **TODAS** as transações subsequentes herdarão o erro
2. Se houver "salto" nos créditos (ex: admin ajustou manualmente), ledger fica inconsistente
3. **Ledger NÃO é fonte da verdade** - ele depende do estado da User table

**EXEMPLO:**

```
// Estado inicial
User: { creditsLimit: 200, creditsUsed: 0, creditsBalance: 0 }
Saldo: 200

Transação 1:
  amount: -10 (gasto)
  lastTransaction: null
  balanceBefore: 200 (pegou do User table)
  effectiveBalance: 200 + (-10) = 190
  balanceAfter: 190 ✅ OK

// Admin ajusta créditos manualmente (via SQL direto, sem registrar no ledger)
UPDATE users SET creditsBalance = 100 WHERE id = '...'

// Estado atual
User: { creditsLimit: 200, creditsUsed: 0, creditsBalance: 100 }
Saldo: 300  // (200 - 0) + 100

Transação 2:
  amount: -10 (gasto)
  lastTransaction.balanceAfter: 190 (transação anterior)
  balanceBefore: 190  // ❌ Pegou do lastTransaction, não do User table
  effectiveBalance: 190 + (-10) = 180
  balanceAfter: 180 ❌ ERRADO! Deveria ser 290

// DIVERGÊNCIA
Saldo real (User table): 290
Último balanceAfter (Ledger): 180
Diferença: 110 créditos
```

---

### 5. 🔢 CÁLCULO ESPERADO vs. REALIDADE

#### Cenário Ideal (Ledger como fonte da verdade)

```
Saldo Final = Σ(todas as transações do ledger)
            = SUM(amount) FROM credit_transactions WHERE userId = '...'
```

#### Realidade Atual (User table como fonte da verdade)

```
Saldo Final = (creditsLimit - creditsUsed) + creditsBalance
```

**Ledger NÃO determina saldo** - ele apenas **registra** o que JÁ aconteceu na User table.

---

## 🐛 PROBLEMAS CONFIRMADOS

| # | Problema | Impacto | Severidade |
|---|----------|---------|------------|
| 1 | Renovação mensal não registra expiração de créditos antigos | Divergência crescente a cada renovação | 🔴 **CRÍTICO** |
| 2 | Expiração de créditos anuais não registra no ledger | Ledger mostra créditos que não existem mais | 🔴 **CRÍTICO** |
| 3 | Usuários sem nenhuma transação no ledger | /account/orders vazio para alguns usuários | 🟠 **ALTO** |
| 4 | `balanceAfter` depende de transação anterior (propagação de erros) | Erros se acumulam e se perpetuam | 🟠 **ALTO** |
| 5 | Admin pode alterar créditos sem registrar no ledger | Divergências não auditadas | 🟡 **MÉDIO** |

---

## 💡 SOLUÇÕES PROPOSTAS

### Solução 1: **Registrar Expiração na Renovação Mensal**

**Arquivo a modificar:** `src/lib/db/subscriptions.ts`

**Antes:**
```typescript
updateData.creditsUsed = 0  // ❌ Reset direto
await recordSubscriptionRenewal(userId, totalCredits, ...)
```

**Depois:**
```typescript
// 1. Calcular créditos restantes ANTES do reset
const creditsRemaining = currentUser.creditsLimit - currentUser.creditsUsed

// 2. Se houver créditos sobrando, registrar EXPIRATION
if (creditsRemaining > 0) {
  await recordCreditExpiration(
    userId,
    creditsRemaining,
    undefined,
    {
      reason: 'Renovação mensal - créditos do ciclo anterior expirados',
      plan: finalPlan,
      billingCycle: currentBillingCycle
    },
    tx
  )
}

// 3. Resetar créditos
updateData.creditsUsed = 0
updateData.creditsLimit = totalCredits

// 4. Registrar entrada dos novos créditos
await recordSubscriptionRenewal(userId, totalCredits, ...)
```

**Fluxo completo:**
```
Antes: 100 créditos restantes
Transação 1: EXPIRED, -100, "Renovação mensal - créditos do ciclo anterior expirados"
Transação 2: EARNED, +200, "Renovação de assinatura - PREMIUM"
Saldo final: 200 ✅
```

---

### Solução 2: **Registrar Expiração de Créditos Anuais**

**Arquivo a modificar:** `src/app/api/cron/expire-yearly-credits/route.ts`

**Adicionar:**
```typescript
// Antes de zerar créditos
const creditsToExpire = user.creditsLimit - user.creditsUsed

if (creditsToExpire > 0) {
  await recordCreditExpiration(
    user.id,
    creditsToExpire,
    undefined,
    {
      reason: 'Créditos anuais expirados após 12 meses',
      plan: user.plan,
      expiresAt: user.creditsExpiresAt
    }
  )
}

// Depois zerar
await prisma.user.update({
  where: { id: user.id },
  data: { creditsUsed: 0, creditsLimit: 0 }
})
```

---

### Solução 3: **Criar Primeira Transação para Usuários Existentes**

**Script de migração (SQL):**
```sql
-- Para cada usuário que TEM créditos mas NÃO tem transações
INSERT INTO credit_transactions (
  id,
  "userId",
  type,
  source,
  amount,
  description,
  "balanceAfter",
  metadata,
  "createdAt"
)
SELECT
  gen_random_uuid(),
  u.id,
  'EARNED',
  'SUBSCRIPTION',
  (u."creditsLimit" - u."creditsUsed" + u."creditsBalance"),
  'Transação inicial de reconciliação',
  (u."creditsLimit" - u."creditsUsed" + u."creditsBalance"),
  '{"type": "reconciliation", "reason": "missing_initial_transaction"}'::jsonb,
  COALESCE(u."subscriptionStartedAt", u."lastCreditRenewalAt", u."createdAt")
FROM users u
LEFT JOIN credit_transactions ct ON ct."userId" = u.id
WHERE u.plan IS NOT NULL
  AND (u."creditsLimit" > 0 OR u."creditsBalance" > 0)
  AND ct.id IS NULL  -- Nenhuma transação existe
GROUP BY u.id
HAVING COUNT(ct.id) = 0;
```

---

### Solução 4: **Reconciliação Automática do `balanceAfter`**

**Modificar:** `src/lib/services/credit-transaction-service.ts`

**Adicionar validação:**
```typescript
// Após criar transação, validar se balanceAfter bate com User table
const userBalance = (user.creditsLimit - user.creditsUsed) + user.creditsBalance

if (Math.abs(effectiveBalance - userBalance) > 1) {  // Tolerância de 1 crédito
  console.warn(`⚠️ [CreditTransaction] Divergência detectada:`, {
    userId,
    ledgerBalance: effectiveBalance,
    userBalance,
    difference: userBalance - effectiveBalance
  })
  
  // Corrigir balanceAfter para refletir realidade
  effectiveBalance = userBalance
}

const transaction = await client.creditTransaction.create({
  data: { balanceAfter: effectiveBalance, ... }
})
```

---

### Solução 5: **Script de Reconciliação para Usuário Específico**

**Para o usuário:** `cmhktfezk0000lb04ergjfykk`

```sql
-- Passo 1: Verificar estado atual
WITH ultimo_ledger AS (
  SELECT "balanceAfter"
  FROM credit_transactions
  WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
  ORDER BY "createdAt" DESC
  LIMIT 1
),
saldo_usuario AS (
  SELECT
    ("creditsLimit" - "creditsUsed" + "creditsBalance") as saldo,
    "creditsLimit",
    "creditsUsed",
    "creditsBalance",
    email
  FROM users
  WHERE id = 'cmhktfezk0000lb04ergjfykk'
)
SELECT
  ul."balanceAfter" as saldo_ledger,
  su.saldo as saldo_usuario,
  (su.saldo - ul."balanceAfter") as ajuste_necessario,
  su.*
FROM ultimo_ledger ul, saldo_usuario su;

-- Passo 2: Se houver divergência, criar transação de ajuste
-- EXEMPLO (AJUSTAR VALORES BASEADO NO RESULTADO DO PASSO 1):
/*
INSERT INTO credit_transactions (
  id,
  "userId",
  type,
  source,
  amount,
  description,
  "balanceAfter",
  metadata,
  "createdAt"
) VALUES (
  gen_random_uuid(),
  'cmhktfezk0000lb04ergjfykk',
  'EARNED',  -- ou 'SPENT' se ajuste for negativo
  'BONUS',
  50,  -- VALOR DO AJUSTE (positivo para adicionar, negativo para remover)
  'Ajuste de reconciliação manual - correção de divergência',
  (SELECT ("creditsLimit" - "creditsUsed" + "creditsBalance") FROM users WHERE id = 'cmhktfezk0000lb04ergjfykk'),
  jsonb_build_object(
    'type', 'manual_reconciliation',
    'reason', 'ledger_user_divergence',
    'admin', 'manual_fix',
    'date', NOW()::text
  ),
  NOW()
);
*/

-- Passo 3: Validar após ajuste
SELECT
  (SELECT SUM(amount) FROM credit_transactions WHERE "userId" = 'cmhktfezk0000lb04ergjfykk') as soma_ledger,
  (SELECT "balanceAfter" FROM credit_transactions WHERE "userId" = 'cmhktfezk0000lb04ergjfykk' ORDER BY "createdAt" DESC LIMIT 1) as ultimo_balance_after,
  (SELECT ("creditsLimit" - "creditsUsed" + "creditsBalance") FROM users WHERE id = 'cmhktfezk0000lb04ergjfykk') as saldo_usuario;
```

---

## 📊 FLUXO DE TESTES

### 1. Executar Diagnóstico

```bash
# Conectar ao banco de produção
psql $DATABASE_URL

# Executar queries do arquivo DIAGNOSTICO_CREDITOS_LEDGER.sql
\i DIAGNOSTICO_CREDITOS_LEDGER.sql
```

### 2. Analisar Resultados

- **Query 3**: Verificar divergência geral (ledger vs. user table)
- **Query 8**: Verificar saltos/inconsistências no `balanceAfter`
- **Query 9**: Verificar usuários sem transações
- **Query 10**: Verificar divergências em massa

### 3. Aplicar Correções

**Para usuário de teste (`cmhktfezk0000lb04ergjfykk`):**

1. Executar Passo 1 do script de reconciliação
2. Se houver divergência, anotar valor do ajuste necessário
3. Executar Passo 2 (INSERT) com valor correto
4. Executar Passo 3 para validar

### 4. Aplicar Fixes no Código

1. ✅ Implementar Solução 1 (registrar expiração na renovação)
2. ✅ Implementar Solução 2 (registrar expiração anual)
3. ✅ Implementar Solução 4 (validação de divergência)

### 5. Rodar Migração para Usuários Existentes

**APÓS validar em um usuário:**

```sql
-- Criar transações iniciais para todos os usuários sem histórico
-- (Script da Solução 3)
```

---

## ⚠️ RISCOS E CONSIDERAÇÕES

### Riscos ao Aplicar Correções

1. **Usuários de teste podem ter estados inválidos**
   - Verificar se `cmhktfezk0000lb04ergjfykk` é conta de teste
   - Se sim, pode ter pagamentos cancelados, estornos, etc

2. **Usuários com pagamentos pendentes/cancelados**
   - Ledger pode estar correto, mas User table foi alterada manualmente
   - Verificar histórico de pagamentos antes de reconciliar

3. **Renovações já processadas**
   - Se aplicar Solução 1 agora, próximas renovações terão registro correto
   - Mas renovações anteriores continuarão sem registro de expiração
   - Considerar criar transações retroativas para últimas renovações

### Testes Obrigatórios

Antes de aplicar em produção:

1. ✅ Testar script de reconciliação em **1 usuário** primeiro
2. ✅ Validar que saldo final bate (User table = Ledger)
3. ✅ Verificar que `/account/orders` exibe transações corretamente
4. ✅ Testar renovação mensal em ambiente de staging
5. ✅ Verificar se broadcast SSE atualiza créditos no frontend

---

## 📝 CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Diagnóstico (AGORA)
- [x] Executar SQL de diagnóstico no usuário de teste
- [ ] Analisar resultados e identificar tipo de divergência
- [ ] Verificar histórico de pagamentos do usuário
- [ ] Confirmar se é conta real ou de teste

### Fase 2: Correção Pontual (Usuário de Teste)
- [ ] Aplicar script de reconciliação para 1 usuário
- [ ] Validar que `/account/orders` mostra dados corretos
- [ ] Verificar que badge de créditos bate com ledger

### Fase 3: Correções no Código
- [ ] Implementar Solução 1 (expiração na renovação)
- [ ] Implementar Solução 2 (expiração anual)
- [ ] Implementar Solução 4 (validação de divergência)
- [ ] Testar em ambiente de staging

### Fase 4: Migração em Massa
- [ ] Backup do banco de dados
- [ ] Executar script de criação de transações iniciais
- [ ] Validar amostra de 10-20 usuários
- [ ] Monitorar por 24-48h

---

## 🎯 RESULTADO ESPERADO

Após implementação completa:

1. ✅ **Ledger é fonte da verdade confiável**
   - Saldo calculado do ledger = Saldo da User table

2. ✅ **Toda operação registra no ledger**
   - Renovações (com expiração dos créditos antigos)
   - Expirações anuais
   - Compras de créditos
   - Gastos (gerações, treinamentos, edições, vídeos)

3. ✅ **`/account/orders` completo e preciso**
   - Todos os usuários têm transações
   - Histórico completo e auditável
   - Saldo final bate exatamente

4. ✅ **Divergências são detectadas e corrigidas automaticamente**
   - Validação em cada transação
   - Logs de divergência para investigação

---

**Próximos Passos:**
1. Executar diagnóstico SQL
2. Analisar resultados
3. Aplicar correção pontual em usuário de teste
4. Validar solução
5. Implementar fixes no código
6. Rodar migração em massa (com backup)

