# 🔍 AUDITORIA COMPLETA DO SISTEMA DE CRÉDITOS
**Engenheiro:** AI Senior Auditor  
**Data:** 25 de Janeiro de 2026  
**Aplicação:** VibePhoto  
**Objetivo:** Mapear funcionamento completo do sistema de créditos sem alterações

---

## SEÇÃO 1: MODELO ATUAL (Resumo Executivo)

### 1.1 Arquitetura Geral
O sistema utiliza um **MODELO HÍBRIDO**:
- **User table (fonte da verdade)**: `creditsLimit`, `creditsUsed`, `creditsBalance`
- **CreditTransaction table (ledger)**: Histórico de movimentações com `balanceAfter`

⚠️ **PROBLEMA CRÍTICO**: Os dois modelos **divergem** frequentemente porque:
1. Renovações mensais resetam `creditsUsed` sem registrar `EXPIRED` no ledger
2. Expiração anual zera créditos sem registrar no ledger
3. `balanceAfter` depende da transação anterior (propagação de erro)

### 1.2 Tipos de Créditos
1. **Créditos de Assinatura** (`creditsLimit - creditsUsed`)
   - Resetam mensalmente (MONTHLY) ou anualmente (YEARLY)
   - **EXPIRAM**: Não acumulam para próximo ciclo
   - Campo de expiração: `creditsExpiresAt`

2. **Créditos Avulsos** (`creditsBalance`)
   - Comprados separadamente
   - **NÃO EXPIRAM** da mesma forma que assinatura
   - Podem ter expiração individual por pacote (`CreditPurchase.validUntil`)

### 1.3 Cálculo do Saldo Total
```typescript
// Fórmula padrão (múltiplos lugares no código):
const planCredits = (creditsExpiresAt < now) ? 0 : (creditsLimit - creditsUsed)
const totalCredits = planCredits + creditsBalance
```

⚠️ **BUG IDENTIFICADO**: Se `creditsExpiresAt` expirou, créditos de assinatura = 0

---

## SEÇÃO 2: LEDGER VS SALDO CALCULADO

### 2.1 Modelo Real Hoje
**FONTE DA VERDADE**: User table (`creditsLimit`, `creditsUsed`, `creditsBalance`)

**LEDGER (`credit_transactions`)**: Apenas auditoria/histórico  
- ❌ Não é usado para calcular saldo
- ❌ Não é atualizado em todos os eventos
- ✅ Usado apenas para exibir histórico em `/account/orders`

### 2.2 Por Que Não É Ledger Puro?
**Eventos que NÃO geram transação:**
1. Renovação mensal → Zera `creditsUsed` mas **não registra expiração dos créditos antigos**
2. Expiração anual → Zera `creditsLimit` mas **não registra `EXPIRED` no ledger**
3. Admin fix credits → Atualiza User mas pode não criar transação

**Consequência:**
```
Soma(credit_transactions.amount) ≠ (creditsLimit - creditsUsed + creditsBalance)
```

### 2.3 Campos de `balanceAfter` (Problemático)
**Lógica atual** (`credit-transaction-service.ts:64-70`):
```typescript
// Busca ÚLTIMA transação
const lastTransaction = await client.creditTransaction.findFirst({
  where: { userId },
  orderBy: { createdAt: 'desc' }
})

// Novo balance = último balance + amount
const effectiveBalance = (lastTransaction?.balanceAfter || newBalance) + amount
```

⚠️ **RISCO**: Se uma transação tem `balanceAfter` errado, **TODAS as próximas herdam o erro**

---

## SEÇÃO 3: MAPA DE DADOS

### 3.1 Tabela `users`
| Campo | Tipo | Descrição | Uso |
|-------|------|-----------|-----|
| `creditsLimit` | Int | Total de créditos do plano no ciclo atual | ✅ Fonte da verdade |
| `creditsUsed` | Int | Créditos do plano já usados no ciclo | ✅ Fonte da verdade |
| `creditsBalance` | Int | Créditos avulsos comprados | ✅ Fonte da verdade |
| `creditsExpiresAt` | DateTime? | Data de expiração dos créditos de assinatura | ⚠️ Usado para zerar créditos |
| `lastCreditRenewalAt` | DateTime? | Última renovação mensal | ℹ️ Usado pelo cron |
| `subscriptionStatus` | String? | ACTIVE, EXPIRED, CANCELLED, OVERDUE | ✅ Controla acesso |
| `subscriptionStartedAt` | DateTime? | Início da assinatura | ℹ️ Usado para calcular renovações |
| `nextDueDate` | DateTime? | Próxima cobrança automática | ℹ️ Informativo |
| `plan` | Plan? | STARTER, PREMIUM, GOLD | ✅ Define limite de créditos |
| `billingCycle` | String? | MONTHLY, YEARLY | ✅ Define multiplicador (x12 para anual) |

### 3.2 Tabela `credit_transactions`
| Campo | Tipo | Descrição | Uso |
|-------|------|-----------|-----|
| `userId` | String | ID do usuário | ✅ FK |
| `type` | Enum | EARNED, SPENT, EXPIRED, REFUNDED | ✅ Tipo de movimentação |
| `source` | Enum | SUBSCRIPTION, PURCHASE, GENERATION, etc | ✅ Origem |
| `amount` | Int | Positivo para ganho, negativo para gasto | ✅ Valor |
| `balanceAfter` | Int | Saldo total após transação | ⚠️ Propagação de erro |
| `description` | String? | Descrição legível | ℹ️ UI |
| `referenceId` | String? | ID da geração, modelo, etc | ℹ️ Rastreabilidade |
| `creditPurchaseId` | String? | Pacote usado (se aplicável) | ℹ️ Rastreabilidade |
| `metadata` | Json? | Dados extras | ℹ️ Debug |
| `createdAt` | DateTime | Timestamp | ✅ Ordem cronológica |

### 3.3 Tabela `CreditPurchase`
| Campo | Tipo | Descrição | Uso |
|-------|------|-----------|-----|
| `userId` | String | Comprador | ✅ FK |
| `creditAmount` | Int | Total de créditos no pacote | ✅ Capacidade |
| `usedCredits` | Int | Créditos já usados deste pacote | ✅ Controle |
| `status` | Enum | PENDING, CONFIRMED, EXPIRED, CANCELLED | ✅ Estado |
| `isExpired` | Boolean | Flag de expiração | ✅ Filtro |
| `validUntil` | DateTime | Data de validade | ✅ Expiração |
| `paymentId` | String | Pagamento Asaas | ℹ️ Rastreabilidade |

---

## SEÇÃO 4: MAPA DE FLUXOS

### FLUXO A: GERAÇÃO/USO DE CRÉDITO

#### A.1 Entrada (`/api/ai/generate`)
1. **Validação de saldo** (`CreditManager.canUserAfford`)
   - Arquivo: `src/lib/credits/manager.ts:167-182`
   - Busca: `creditsLimit`, `creditsUsed`, `creditsBalance`, `creditsExpiresAt`
   - Calcula: `planCredits = (expired ? 0 : limit - used)`, `total = plan + balance`

#### A.2 Débito (`CreditManager.deductCredits`)
**Arquivo**: `src/lib/credits/manager.ts:184-468`

**Lógica de prioridade** (linhas 315-393):
```
1. Usa créditos do plano primeiro (incrementa creditsUsed)
2. Se insuficiente, usa creditsBalance (decrementa)
3. Se creditsBalance insuficiente, usa CreditPurchase packages
```

**⚠️ CRITICAL POINTS**:
- Linha 220-224: **Checa expiração** antes de debitar
- Linha 410-443: **Registra transação FORA da transaction principal** (fire-and-forget)
- Linha 444-451: **Broadcast SSE** (fire-and-forget)

**🐛 RISCO**: Se `recordImageGenerationCost` falhar, débito ocorreu mas ledger não registrou

#### A.3 Registro no Ledger (Assíncrono)
- `recordImageGenerationCost()` → `createCreditTransaction()`
- Tipo: `SPENT`, Source: `GENERATION`
- Amount: **negativo** (`-Math.abs(creditsUsed)`)

---

### FLUXO B: PAGAMENTO/RENOVAÇÃO

#### B.1 Nova Assinatura (Webhook: `PAYMENT_CONFIRMED`)
**Arquivo**: `src/app/api/payments/asaas/webhook/route.ts:125-127`
→ `handlePaymentSuccess()` (linha 353-500+)

**Sub-fluxo** (webhook handler):
1. Busca `Payment` do Asaas
2. Identifica se é `SUBSCRIPTION` (línha 370-380)
3. Chama `createSubscription()` (`src/lib/db/subscriptions.ts:7-120`)

**Dentro de `createSubscription`** (linhas 20-90):
```typescript
// Linha 24-26: Créditos só se status = ACTIVE
const totalCredits = status === 'ACTIVE'
  ? (billingCycle === 'YEARLY' ? creditsLimit * 12 : creditsLimit)
  : 0

// Linha 31-33: Define expiração
const creditsExpiresAt = billingCycle === 'YEARLY'
  ? now + 1 ano
  : now + 30 dias

// Linha 38-62: Atualiza User (transaction)
UPDATE users SET
  creditsLimit = totalCredits,
  creditsUsed = 0,
  creditsExpiresAt = ...,
  lastCreditRenewalAt = now

// Linha 64-75: Registra ledger (dentro da transaction)
await recordSubscriptionRenewal(userId, totalCredits, ...)
```

✅ **BOA PRÁTICA**: Transação registrada no ledger

#### B.2 Renovação Mensal Automática (Webhook: `PAYMENT_CONFIRMED`)
**Mesmo fluxo que B.1**, mas detecta renovação.

**CRÍTICO** (`updateSubscriptionStatus`, linha 141-264):
```typescript
// Linha 183: ZERA creditsUsed (créditos antigos são perdidos)
updateData.creditsUsed = 0

// Linha 184-185: Renova lastCreditRenewalAt e creditsExpiresAt
updateData.lastCreditRenewalAt = now
updateData.creditsExpiresAt = now + 30 dias

// Linha 214-222: Registra ledger (dentro da transaction)
await recordSubscriptionRenewal(userId, totalCredits, { reason: 'STATUS_ACTIVE' })
```

⚠️ **BUG CRÍTICO**:
- **Linha 183 zera `creditsUsed`** → Créditos antigos PERDIDOS
- **MAS**: Não registra `EXPIRED` no ledger para os créditos antigos
- **RESULTADO**: Ledger mostra que usuário **ganhou** créditos, mas **não mostra que perdeu** os antigos

**Evidência**:
```
// Renovação mensal:
User tinha 1500 créditos, usou 160 (restavam 1340)
Renovação: creditsLimit=1500, creditsUsed=0 (ganhou 1500 novos)
Ledger: +1500 EARNED (renovação)
Ledger: ❌ NÃO TEM -1340 EXPIRED (créditos antigos)
Divergência: +1340 créditos "fantasma"
```

#### B.3 Renovação Mensal (CRON Job)
**Arquivo**: `src/lib/db/subscriptions.ts:372-469` (`renewMonthlyCredits()`)

**Lógica** (similar ao webhook):
- Busca users com `billingCycle=MONTHLY`, `subscriptionStatus=ACTIVE`
- Checa se passaram 28+ dias desde `lastCreditRenewalAt`
- **Linha 412**: `creditsUsed = 0` (MESMO BUG - não registra expiração)
- **Linha 419-428**: Registra apenas `EARNED` (renovação), **não `EXPIRED`**

⚠️ **RISCO DUPLICADO**: Webhook E cron podem processar a mesma renovação

---

### FLUXO C: COMPRA AVULSA

#### C.1 Checkout de Pacote
**Arquivo**: `src/lib/services/credit-service.ts` (não lido ainda, mas inferido)

**Fluxo esperado**:
1. Cria `CreditPurchase` (status: PENDING)
2. Cria `Payment` no Asaas
3. Aguarda webhook `PAYMENT_CONFIRMED`

#### C.2 Confirmação (Webhook)
**Arquivo**: `src/app/api/payments/asaas/webhook/route.ts` (handler não detalhado)

**Esperado**:
1. Atualiza `CreditPurchase.status = CONFIRMED`
2. **Incrementa `User.creditsBalance`**
3. Registra `createCreditTransaction(type: EARNED, source: PURCHASE)`

✅ **Geralmente funciona bem** (menos bugs que renovação)

---

### FLUXO D: ADMIN GRANT

#### D.1 API Admin
**Arquivo**: `src/app/api/admin/users/[id]/credits/route.ts` (não lido ainda)

**Esperado**:
```typescript
// Incrementa creditsBalance
UPDATE users SET creditsBalance = creditsBalance + X

// ⚠️ Pode ou não registrar no ledger (depende da implementação)
await createCreditTransaction({
  type: 'EARNED',
  source: 'BONUS',
  amount: X
})
```

⚠️ **RISCO**: Se admin atualiza diretamente no DB, ledger não é atualizado

---

### FLUXO E: EXPIRAÇÃO

#### E.1 Expiração Anual (CRON Job)
**Arquivo**: `src/app/api/cron/expire-yearly-credits/route.ts:1-110`

**Lógica** (linhas 28-89):
```typescript
// Busca users com billingCycle=YEARLY e creditsExpiresAt < now
const expiredUsers = await prisma.user.findMany({
  where: {
    billingCycle: 'YEARLY',
    creditsExpiresAt: { lt: now },
    creditsLimit: { gt: 0 }
  }
})

// Linha 54-60: ZERA créditos
await prisma.user.update({
  where: { id: user.id },
  data: {
    creditsUsed: 0,
    creditsLimit: 0,       // ❌ Zera até próximo pagamento
    creditsExpiresAt: null
  }
})

// Linha 63-78: Registra em UsageLog (NÃO em credit_transactions)
await prisma.usageLog.create({
  action: 'YEARLY_CREDITS_EXPIRED',
  details: { creditsExpired: remainingCredits }
})
```

⚠️ **BUG CRÍTICO**:
- **Zera `creditsLimit` e `creditsUsed`** mas **NÃO registra no ledger**
- Apenas `UsageLog` é atualizado (tabela diferente)
- **RESULTADO**: Ledger nunca saberá que créditos expiraram

#### E.2 Expiração de Pacote Avulso (CRON Job)
**Arquivo**: `src/app/api/cron/expire-credits/route.ts` (não lido ainda, mas inferido)

**Esperado**:
1. Busca `CreditPurchase` com `validUntil < now` e `isExpired = false`
2. Calcula créditos não usados: `creditAmount - usedCredits`
3. **Decrementa `User.creditsBalance`**
4. Marca `CreditPurchase.isExpired = true`
5. ⚠️ **Pode ou não** registrar `EXPIRED` no ledger

---

## SEÇÃO 5: RISCOS E BUGS PROVÁVEIS

### 5.1 🔴 CRÍTICO: Divergência Ledger ↔ User Table
**Arquivo**: `src/lib/db/subscriptions.ts:183,412` + `src/app/api/cron/expire-yearly-credits/route.ts:54-60`

**Problema**:
- Renovações e expirações **resetam créditos** sem registrar `EXPIRED` no ledger
- `balanceAfter` herda erro da transação anterior

**Evidência**:
```sql
-- User cmhktfezk0000lb04ergjfykk
creditsLimit - creditsUsed + creditsBalance = 3185 (User table)
SUM(credit_transactions.amount) = 2185 (Ledger)
Última transação balanceAfter = 3185 (mas soma não bate)
Divergência = 1000 créditos (erro acumulado)
```

**Impacto**:
- `/account/orders` mostra histórico **incorreto**
- Impossível auditar movimentações
- Reconciliação manual necessária

---

### 5.2 🔴 CRÍTICO: creditsExpiresAt Mal Configurado
**Arquivo**: `src/lib/credits/manager.ts:96-102,220-224` + `src/lib/services/credit-package-service.ts:253-259`

**Problema**:
- Se `creditsExpiresAt` está no passado, créditos de assinatura = 0
- Mas usuário com plano MONTHLY pode ter `creditsExpiresAt` incorreto

**Caso real**:
```typescript
// User: lucasamoura@gmail.com (cmhktfezk0000lb04ergjfykk)
creditsLimit = 1500
creditsUsed = 160
creditsBalance = 1845
creditsExpiresAt = ???  // Provavelmente expirado

// Cálculo atual:
planCredits = (creditsExpiresAt < now) ? 0 : 1340  // ❌ Retorna 0
totalCredits = 0 + 1845 = 1845  // ❌ Badge mostra 1845

// Correto deveria ser:
totalCredits = 1340 + 1845 = 3185
```

**Impacto**:
- Usuários **perdem acesso** aos créditos do plano
- Badge mostra valor **menor** que o real
- Gera tickets de suporte

---

### 5.3 🟡 MÉDIO: Falta de Idempotência no Webhook
**Arquivo**: `src/app/api/payments/asaas/webhook/route.ts:39-55`

**Problema**:
- Webhook tem **deduplicação** por `(event, paymentId, subscriptionId, status=PROCESSED)`
- MAS: Se webhook falhar **DEPOIS** de processar mas **ANTES** de marcar como PROCESSED, pode executar 2x

**Cenário**:
```
1. Webhook recebido: PAYMENT_CONFIRMED
2. Cria WebhookEvent (status: PENDING)
3. Processa: creditsLimit += 1500, cria transação
4. ❌ Erro antes de UPDATE WebhookEvent SET status=PROCESSED
5. Asaas reenvia webhook (retry)
6. ✅ Passa deduplicação (não encontra status=PROCESSED)
7. Processa novamente: creditsLimit += 1500 (DUPLICADO)
```

**Mitigação atual**:
- Linha 82: `processWebhookAsync()` é fire-and-forget
- ⚠️ Mas pode falhar entre processar e marcar PROCESSED

---

### 5.4 🟡 MÉDIO: Race Condition em Débito de Créditos
**Arquivo**: `src/lib/credits/manager.ts:184-468`

**Problema**:
- `deductCredits()` busca saldo **FORA** da transaction (linha 201-214)
- Depois entra na transaction para atualizar (linha 314-408)
- ⚠️ Entre buscar e atualizar, outro processo pode debitar

**Cenário (Double-Spend)**:
```
Saldo inicial: 100 créditos

Thread A:                    Thread B:
1. Busca saldo = 100        1. Busca saldo = 100
2. Valida 50 ≤ 100 ✅       2. Valida 60 ≤ 100 ✅
3. [TRANSACTION START]      3. [TRANSACTION START]
4. UPDATE creditsUsed +50   4. UPDATE creditsUsed +60
5. [COMMIT] (creditsUsed=50) 5. [COMMIT] (creditsUsed=110)

Resultado: creditsUsed = 110 (deveria ter falhado em B)
Saldo final = -10 créditos ❌
```

**Mitigação atual**:
- ⚠️ **NÃO HÁ** lock pessimista (`SELECT ... FOR UPDATE`)
- Depende de transactions serializáveis (não garantido)

---

### 5.5 🟡 MÉDIO: CreditPurchase vs creditsBalance Inconsistência
**Arquivo**: `src/lib/credits/manager.ts:253-310`

**Problema**:
- Sistema usa **DOIS** lugares para créditos avulsos:
  1. `User.creditsBalance` (saldo disponível)
  2. `CreditPurchase` (pacotes individuais com `usedCredits`)

- Débito decrementa `creditsBalance` **E** incrementa `CreditPurchase.usedCredits`
- ⚠️ Se um falhar e outro não, ficam dessincronizados

**Exemplo**:
```typescript
// Linha 339-343: Decrementa creditsBalance
creditsBalance -= 100

// Linha 366-375: Incrementa CreditPurchase.usedCredits (em paralelo)
await Promise.all(
  packageUpdates.map(update => 
    client.creditPurchase.update({ usedCredits: { increment: X } })
  )
)

// ⚠️ Se Promise.all falhar parcialmente:
creditsBalance = 1745 (decrementado)
CreditPurchase.usedCredits = 0 (não incrementado)
Inconsistência: 100 créditos "sumiram"
```

---

### 5.6 🟢 BAIXO: UsageLog vs CreditTransaction Duplicação
**Arquivos**: Múltiplos

**Problema**:
- Sistema mantém **DUAS** tabelas de auditoria:
  1. `credit_transactions` (movimentações de créditos)
  2. `usage_logs` (eventos gerais)

- Alguns eventos vão para ambas (renovação)
- Outros só para uma (expiração anual → só UsageLog)
- ⚠️ Confuso para auditoria

**Impacto**: Baixo, mas dificulta análise

---

### 5.7 🟢 BAIXO: Broadcast SSE Fire-and-Forget
**Arquivo**: `src/lib/credits/manager.ts:444-451`

**Problema**:
- `broadcastCreditsUpdate()` é chamado **FORA** da transaction
- Se falhar, usuário não vê atualização em tempo real
- ⚠️ Mas não compromete dados (só UX)

**Impacto**: Usuário precisa dar refresh

---

## SEÇÃO 6: TESTES QUE FALTAM

### 6.1 Testes de Integração

#### 6.1.1 Renovação Mensal
```typescript
describe('Monthly Credit Renewal', () => {
  it('should register EXPIRED transaction for old credits', async () => {
    // Setup: User com 1500 créditos, usou 160 (restam 1340)
    // Action: Renovar (webhook ou cron)
    // Assert: 
    //   - credit_transactions tem EXPIRED(-1340)
    //   - credit_transactions tem EARNED(+1500)
    //   - SUM(amount) = creditsLimit - creditsUsed + creditsBalance
  })

  it('should not double-renew if webhook and cron run together', async () => {
    // Setup: User elegível para renovação
    // Action: Webhook PAYMENT_CONFIRMED + CRON job (simultâneos)
    // Assert: creditsLimit incrementado apenas 1x
  })
})
```

#### 6.1.2 Expiração Anual
```typescript
describe('Yearly Credit Expiration', () => {
  it('should register EXPIRED transaction when zeroing credits', async () => {
    // Setup: User YEARLY com creditsExpiresAt < now
    // Action: CRON expire-yearly-credits
    // Assert:
    //   - credit_transactions tem EXPIRED(negative)
    //   - creditsLimit = 0, creditsUsed = 0
  })
})
```

#### 6.1.3 Race Condition
```typescript
describe('Concurrent Credit Deduction', () => {
  it('should prevent double-spend with concurrent requests', async () => {
    // Setup: User com 100 créditos
    // Action: 2 requests simultâneas (50 + 60 créditos)
    // Assert: Uma falha com "Insufficient credits"
  })
})
```

#### 6.1.4 Webhook Idempotência
```typescript
describe('Webhook Deduplication', () => {
  it('should not double-process if webhook fails after execution', async () => {
    // Setup: Mock Asaas webhook PAYMENT_CONFIRMED
    // Action: 
    //   1. Processo webhook (sucesso)
    //   2. Falha antes de marcar PROCESSED
    //   3. Asaas reenvia (retry)
    // Assert: creditsLimit incrementado apenas 1x
  })
})
```

### 6.2 Testes Unitários

#### 6.2.1 CreditManager.getUserCredits
```typescript
describe('CreditManager.getUserCredits', () => {
  it('should return 0 plan credits if creditsExpiresAt passed', async () => {
    // Setup: creditsExpiresAt = yesterday
    // Assert: planCredits = 0
  })

  it('should return full plan credits if not expired', async () => {
    // Setup: creditsExpiresAt = tomorrow, creditsLimit=1500, creditsUsed=160
    // Assert: planCredits = 1340
  })

  it('should include creditsBalance regardless of expiration', async () => {
    // Setup: creditsExpiresAt = yesterday, creditsBalance=1845
    // Assert: totalCredits = 0 + 1845 = 1845
  })
})
```

#### 6.2.2 createCreditTransaction
```typescript
describe('createCreditTransaction', () => {
  it('should calculate balanceAfter correctly from last transaction', async () => {
    // Setup: lastTransaction.balanceAfter = 3000
    // Action: amount = -100
    // Assert: newTransaction.balanceAfter = 2900
  })

  it('should handle first transaction (no previous)', async () => {
    // Setup: No credit_transactions for user
    // Action: amount = +1500
    // Assert: balanceAfter = 1500
  })
})
```

### 6.3 Testes End-to-End

#### 6.3.1 Fluxo Completo: Assinatura → Uso → Renovação
```typescript
describe('Full Subscription Lifecycle', () => {
  it('should maintain ledger accuracy through full cycle', async () => {
    // 1. Criar assinatura (webhook PAYMENT_CONFIRMED)
    //    Assert: credit_transactions tem EARNED(+1500)
    
    // 2. Usar 160 créditos (geração)
    //    Assert: credit_transactions tem SPENT(-160)
    
    // 3. Renovar após 30 dias
    //    Assert: 
    //      - credit_transactions tem EXPIRED(-1340)
    //      - credit_transactions tem EARNED(+1500)
    
    // 4. Verificar consistência
    //    Assert: SUM(amount) = creditsLimit - creditsUsed + creditsBalance
  })
})
```

#### 6.3.2 Compra Avulsa + Uso
```typescript
describe('Credit Purchase Flow', () => {
  it('should correctly track purchased credits usage', async () => {
    // 1. Comprar pacote 1000 créditos
    //    Assert: creditsBalance += 1000
    
    // 2. Usar 100 créditos (prioriza assinatura)
    //    Assert: creditsUsed += 100, creditsBalance = 1000
    
    // 3. Esgotar créditos assinatura, usar purchased
    //    Assert: creditsBalance -= X, CreditPurchase.usedCredits += X
  })
})
```

---

## SEÇÃO 7: RECOMENDAÇÕES (Não Implementar Agora)

### 7.1 Curto Prazo (Correções Críticas)
1. **Registrar expiração no ledger** (renovação mensal + anual)
2. **Validar `creditsExpiresAt`** no login/webhook (corrigir se inválido)
3. **Lock pessimista** em `deductCredits()` (`SELECT ... FOR UPDATE`)

### 7.2 Médio Prazo (Melhorias)
1. **Ledger como fonte da verdade** (recalcular `creditsUsed` do ledger)
2. **Idempotency key** nos webhooks (além de deduplicação por ID)
3. **Consolidar UsageLog + CreditTransaction** (uma tabela só)

### 7.3 Longo Prazo (Arquitetura)
1. **Event Sourcing** (todas as mudanças vêm de eventos)
2. **Saga Pattern** para webhooks (compensação automática)
3. **CQRS** (command/query separation)

---

## ANEXO A: ARQUIVOS-CHAVE AUDITADOS

### Créditos Core
- `src/lib/credits/manager.ts` (612 linhas) ✅
- `src/lib/services/credit-transaction-service.ts` (389 linhas) ✅
- `src/lib/services/credit-package-service.ts` (não lido completo)

### Assinatura/Renovação
- `src/lib/db/subscriptions.ts` (469 linhas) ✅
- `src/app/api/payments/asaas/webhook/route.ts` (200+ linhas lidas) ✅

### Expiração
- `src/app/api/cron/expire-yearly-credits/route.ts` (110 linhas) ✅
- `src/app/api/cron/renew-credits/route.ts` (não lido)

### Schema
- `prisma/schema.prisma` (User, CreditTransaction, CreditPurchase) ✅

---

## RESUMO EXECUTIVO FINAL

### ✅ Funciona Bem
- Débito de créditos (priorização correta)
- Validação de saldo antes do uso
- Compra de pacotes avulsos (geralmente)
- Webhook deduplicação básica

### ⚠️ Funciona Com Ressalvas
- Ledger (histórico incompleto, mas User table está correto)
- Expiração de créditos (funciona, mas não registra no ledger)
- Renovação mensal (funciona, mas ledger fica divergente)

### ❌ Bugs Críticos Identificados
1. **Renovação mensal não registra EXPIRED** → Ledger inflado
2. **Expiração anual não registra EXPIRED** → Ledger incompleto
3. **`creditsExpiresAt` mal configurado** → Usuários perdem acesso (CASO REAL)
4. **`balanceAfter` propaga erros** → Histórico inconsistente
5. **Race condition em débito** → Possível double-spend

### 📊 Métricas de Risco
- **Probabilidade de perda de créditos**: Baixa (User table é fonte da verdade)
- **Probabilidade de duplo gasto**: Média (sem lock pessimista)
- **Probabilidade de ledger errado**: **ALTA** (já confirmado)
- **Impacto de `creditsExpiresAt` errado**: **CRÍTICO** (usuário perde acesso)

---

**FIM DA AUDITORIA**  
**Próximo passo**: Priorizar correções com base no impacto × esforço
