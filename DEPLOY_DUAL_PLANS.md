# 📋 Guia de Deploy - Sistema Dual de Planos (Formato A + B)

## 🎯 Objetivo

Este documento descreve o processo de deploy do **sistema dual de planos** no VibePhoto, que permite alternar entre dois formatos de planos sem necessidade de redeploy.

---

## ✅ **O que foi implementado**

### **1. DATABASE**
- ✅ Enum `PlanFormat` (TRADITIONAL | MEMBERSHIP)
- ✅ Tabela `subscription_plans` expandida com colunas opcionais
- ✅ Tabela `users` expandida para rastrear formato
- ✅ Seed para criar 3 planos Membership (Formato B)
- ✅ SystemConfig reutilizada para armazenar formato ativo

### **2. BACKEND**
- ✅ `system-config-service.ts` - Gerencia formato ativo
- ✅ `/api/subscription-plans` - Retorna planos baseados no formato
- ✅ `/api/checkout/subscription` - Valida ambos formatos
- ✅ `asaas-checkout-service.ts` - Lógica condicional
- ✅ Webhook `handlePaymentSuccess` - Lógica condicional

### **3. FRONTEND**
- ✅ **Pricing page** (`/pricing`) com renderização condicional completa
  - Toggle de ciclo oculto no Formato B
  - Cards adaptam preços e ciclos ao formato
  - FAQ dinâmico baseado no formato ativo
  - Mensagens explicativas sobre créditos por ciclo
- ✅ **Billing page** (`/billing`) com suporte total ao Formato B
  - Tab "plans": Toggle oculto, alert informativo, cards adaptados
  - Tab "overview": Detalhes de assinatura específicos por formato
  - Informações de ciclo (trimestral/semestral/anual) para Membership
  - Valores e próxima renovação corretos por formato

### **4. ADMIN**
- ✅ `/admin/plan-format` - Alterna formato sem deploy
- ✅ `/api/admin/plan-format` - API de configuração
- ✅ Filtros em `/admin/subscription-plans`
- ✅ Badges de formato nos cards de planos

---

## 🚀 **Passos para Deploy**

### **PASSO 1: Aplicar Migrations no Banco de Dados**

#### **1.1. Conectar ao banco Supabase**

```bash
# Se necessário, configure DATABASE_URL no .env
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
```

#### **1.2. Gerar e aplicar migration**

**Opção A: Usar Prisma Migrate (Recomendado para produção)**

```bash
# Gerar migration
npx prisma migrate dev --name add_dual_plan_format

# Aplicar em produção
npx prisma migrate deploy
```

**Opção B: Aplicar schema diretamente (Desenvolvimento)**

```bash
# Push schema para banco (não cria migrations)
npx prisma db push
```

#### **1.3. Verificar se as colunas foram criadas**

Conecte ao Supabase SQL Editor e verifique:

```sql
-- Verificar subscription_plans
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'subscription_plans'
  AND column_name IN ('plan_format', 'billing_cycle', 'cycle_credits', 'cycle_duration_months', 'minimum_commitment_months');

-- Verificar users
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('plan_format', 'cycle_credits', 'last_cycle_payment_at');

-- Verificar enum
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'PlanFormat');
```

**Resultado esperado:**
```
plan_format              | PlanFormat
billing_cycle            | text
cycle_credits            | integer
cycle_duration_months    | integer
minimum_commitment_months| integer

plan_format              | PlanFormat
cycle_credits            | integer
last_cycle_payment_at    | timestamp

enumlabel
-----------
TRADITIONAL
MEMBERSHIP
```

---

### **PASSO 2: Criar Planos Membership (Formato B)**

#### **2.1. Executar seed**

**Opção A: Via script TypeScript**

```bash
npx ts-node prisma/seed-membership-plans.ts
```

**Opção B: Via SQL direto no Supabase**

```sql
-- 1. Membership Trimestral
INSERT INTO subscription_plans (
  id, "planId", name, description, "planType", "planFormat", "isActive", popular, "displayOrder",
  "billingCycle", "cycleDurationMonths", "minimumCommitmentMonths", "cycleCredits",
  "monthlyPrice", "annualPrice", "monthlyEquivalent",
  credits, models, resolution, features
) VALUES (
  gen_random_uuid(), 'MEMBERSHIP_QUARTERLY', 'Membership Trimestral',
  'Plano membership com renovação a cada 3 meses. Créditos fixos por ciclo.',
  'PAID', 'MEMBERSHIP', true, false, 10,
  'QUARTERLY', 3, 3, 2100,
  997, 3988, 332.33,
  2100, 1, '2048x2048',
  '["2.100 créditos a cada 3 meses", "210 fotos por ciclo", "1 modelo de IA incluído", "Máxima resolução", "Pacotes premium inclusos", "Créditos válidos durante o ciclo", "Suporte prioritário"]'::jsonb
);

-- 2. Membership Semestral
INSERT INTO subscription_plans (
  id, "planId", name, description, "planType", "planFormat", "isActive", popular, "displayOrder",
  "billingCycle", "cycleDurationMonths", "minimumCommitmentMonths", "cycleCredits",
  "monthlyPrice", "annualPrice", "monthlyEquivalent",
  credits, models, resolution, features
) VALUES (
  gen_random_uuid(), 'MEMBERSHIP_SEMI_ANNUAL', 'Membership Semestral',
  'Plano membership com renovação a cada 6 meses. Créditos fixos por ciclo.',
  'PAID', 'MEMBERSHIP', true, true, 11,
  'SEMI_ANNUAL', 6, 3, 4500,
  1897, 3794, 316.17,
  4500, 1, '2048x2048',
  '["4.500 créditos a cada 6 meses", "450 fotos por ciclo", "1 modelo de IA incluído", "Máxima resolução", "Todos os pacotes premium", "Créditos válidos durante o ciclo", "Suporte VIP"]'::jsonb
);

-- 3. Membership Anual
INSERT INTO subscription_plans (
  id, "planId", name, description, "planType", "planFormat", "isActive", popular, "displayOrder",
  "billingCycle", "cycleDurationMonths", "minimumCommitmentMonths", "cycleCredits",
  "monthlyPrice", "annualPrice", "monthlyEquivalent",
  credits, models, resolution, features
) VALUES (
  gen_random_uuid(), 'MEMBERSHIP_ANNUAL', 'Membership Anual',
  'Plano membership com renovação anual. Créditos fixos por ciclo. Melhor custo-benefício.',
  'PAID', 'MEMBERSHIP', true, false, 12,
  'ANNUAL', 12, 3, 9600,
  3587, 3587, 298.92,
  9600, 1, '2048x2048',
  '["9.600 créditos por ano", "960 fotos por ano", "1 modelo de IA incluído", "Máxima resolução", "Todos os pacotes premium", "API de integração", "Créditos válidos durante o ano", "Suporte VIP + consultoria"]'::jsonb
);
```

#### **2.2. Verificar planos criados**

```sql
SELECT "planId", name, "planFormat", "billingCycle", "cycleCredits", "monthlyPrice"
FROM subscription_plans
WHERE "planFormat" = 'MEMBERSHIP'
ORDER BY "cycleDurationMonths" ASC;
```

**Resultado esperado:**
```
MEMBERSHIP_QUARTERLY   | Membership Trimestral | MEMBERSHIP | QUARTERLY    | 2100 | 997
MEMBERSHIP_SEMI_ANNUAL | Membership Semestral  | MEMBERSHIP | SEMI_ANNUAL  | 4500 | 1897
MEMBERSHIP_ANNUAL      | Membership Anual      | MEMBERSHIP | ANNUAL       | 9600 | 3587
```

---

### **PASSO 3: Inicializar Configuração do Sistema**

#### **3.1. Criar registro em system_config**

```sql
INSERT INTO system_config (id, key, value, "createdAt", "updatedAt")
VALUES (
  'default',
  'active_plan_format',
  '{"format": "TRADITIONAL"}'::jsonb,
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;
```

#### **3.2. Verificar configuração**

```sql
SELECT * FROM system_config WHERE key = 'active_plan_format';
```

**Resultado esperado:**
```
id      | key                  | value                      | createdAt | updatedAt
--------|---------------------|----------------------------|-----------|----------
default | active_plan_format  | {"format":"TRADITIONAL"}   | ...       | ...
```

---

### **PASSO 4: Gerar Prisma Client**

```bash
npx prisma generate
```

---

### **PASSO 5: Deploy do Código**

#### **5.1. Fazer commit das mudanças**

```bash
git add .
git commit -m "feat: Add dual plan format system (Formato A + B)

- Database: Add PlanFormat enum and new columns
- Backend: Add system-config-service and conditional logic
- Frontend: Add conditional rendering in pricing page
- Admin: Add /admin/plan-format page for format switching
- Webhook: Add conditional credit logic for Membership plans"

git push origin main
```

#### **5.2. Aguardar deploy automático (Vercel)**

Vercel fará o deploy automaticamente. Verifique em:
- https://vercel.com/[seu-projeto]/deployments

---

### **PASSO 6: Verificar Funcionalidade**

#### **6.1. Verificar formato ativo (deve ser TRADITIONAL)**

```bash
curl https://vibephoto.app/api/subscription-plans
```

**Resposta esperada:**
```json
{
  "plans": [
    { "id": "STARTER", "name": "Starter", ... },
    { "id": "PREMIUM", "name": "Premium", ... },
    { "id": "GOLD", "name": "Gold", ... }
  ],
  "format": "TRADITIONAL"
}
```

#### **6.2. Testar alternância de formato (Admin)**

1. Acesse: `https://vibephoto.app/admin/plan-format`
2. Alterne para **Formato B - Membership**
3. Verifique a mensagem de sucesso
4. Acesse: `https://vibephoto.app/pricing`
5. Deve exibir 3 cards do plano Membership (Trimestral/Semestral/Anual)
6. **Volte para Formato A** (para manter produção atual)

#### **6.3. Verificar assinaturas existentes NÃO foram afetadas**

```sql
SELECT id, email, plan, "billingCycle", "planFormat", "subscriptionStatus"
FROM users
WHERE "subscriptionStatus" = 'ACTIVE'
LIMIT 5;
```

**Todas assinaturas ativas devem manter seus valores originais.**

---

## ⚠️ **Rollback (se necessário)**

### **Opção 1: Reverter formato ativo via Admin**

1. Acesse `/admin/plan-format`
2. Selecione **Formato A - Tradicional**
3. Pronto! (sem necessidade de deploy)

### **Opção 2: Reverter código**

```bash
git revert [commit-hash]
git push origin main
```

### **Opção 3: Reverter banco de dados**

```sql
-- Remover configuração do formato B
UPDATE system_config
SET value = '{"format":"TRADITIONAL"}'::jsonb
WHERE key = 'active_plan_format';

-- (Opcional) Desativar planos Membership
UPDATE subscription_plans
SET "isActive" = false
WHERE "planFormat" = 'MEMBERSHIP';
```

**⚠️ NÃO remova as colunas do banco!** Isso quebraria assinaturas existentes.

---

## 📊 **Monitoramento Pós-Deploy**

### **Verificar logs de webhook**

```sql
SELECT event, status, "createdAt", "processedAt"
FROM webhook_events
WHERE event IN ('PAYMENT_CONFIRMED', 'SUBSCRIPTION_CREATED')
  AND "createdAt" > NOW() - INTERVAL '1 hour'
ORDER BY "createdAt" DESC;
```

### **Verificar novos checkouts**

```sql
SELECT p.id, u.email, p."planType", p."billingCycle", p.value, p.status
FROM payments p
JOIN users u ON u.id = p."userId"
WHERE p.type = 'SUBSCRIPTION'
  AND p."createdAt" > NOW() - INTERVAL '1 hour'
ORDER BY p."createdAt" DESC;
```

---

## 🎉 **Conclusão**

Após seguir todos os passos:
- ✅ Formato A (Tradicional) está ativo por padrão
- ✅ Formato B (Membership) disponível via admin
- ✅ Assinaturas existentes NÃO foram afetadas
- ✅ Alternância de formato funciona sem deploy
- ✅ Webhook processa ambos formatos corretamente
- ✅ Pacotes avulsos continuam funcionando

**Sistema pronto para produção! 🚀**
