# 🛡️ SISTEMA DE MONITORAMENTO DE CRÉDITOS - INTEGRAÇÃO COM PAINEL ADMIN

**Data**: 25/01/2026  
**Objetivo**: Adicionar funcionalidades de monitoramento de créditos ao painel admin existente em `/admin`  
**Status**: 📋 PLANEJAMENTO

---

## 🎯 **INTEGRAÇÃO COM ADMIN EXISTENTE**

### **✅ Estrutura Atual do Admin:**
```
/admin                          → Dashboard principal
/admin/users                    → Lista de usuários (já existe!)
/admin/subscription-plans       → Planos de assinatura
/admin/credit-packages          → Pacotes de créditos
/admin/payments                 → Histórico de cobranças
/admin/analytics                → Analytics
/admin/tools                    → Ferramentas de manutenção
```

### **🆕 Nova Estrutura Proposta:**
```
/admin/credits                  → 🆕 Hub de Monitoramento de Créditos
  ├── /admin/credits/monitor    → Dashboard de monitoramento
  ├── /admin/credits/alerts     → Central de alertas
  ├── /admin/credits/reports    → Relatórios e auditoria
  └── /admin/credits/tools      → Ferramentas de correção

/admin/users                    → ⚡ Aprimorado com novas ações
  └── [userId]/credits          → 🆕 Página de diagnóstico individual
```

---

## 📊 **1. NOVO CARD NO DASHBOARD PRINCIPAL** (`/admin`)

### **Adicionar ao `page.tsx`:**

```typescript
// src/app/admin/page.tsx
{ 
  title: '💰 Monitoramento de Créditos', 
  href: '/admin/credits', 
  desc: 'Dashboard de renovações, alertas e diagnóstico',
  badge: alertas > 0 ? alertas : undefined // Badge vermelho se houver alertas
}
```

**Visual:**
```
┌─────────────────────────────────────────┐
│ 💰 Monitoramento de Créditos       [3] │
│ Dashboard de renovações, alertas...     │
└─────────────────────────────────────────┘
```

---

## 📊 **2. NOVA PÁGINA: `/admin/credits` (Hub Principal)**

### **Arquivo:** `src/app/admin/credits/page.tsx`

```typescript
import { requireAdmin } from '@/lib/auth'
import { unstable_noStore as noStore } from 'next/cache'
import CreditsDashboard from './credits-dashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminCreditsPage() {
  noStore()
  await requireAdmin()
  
  // Buscar dados do servidor
  const data = await getCreditsMonitoringData()
  
  return <CreditsDashboard initialData={data} />
}
```

### **Layout da Página:**

```
┌─────────────────────────────────────────────────────────────┐
│  💰 MONITORAMENTO DE CRÉDITOS                    [Atualizar] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  📊 MÉTRICAS RÁPIDAS                                          │
│  ┌──────────────┬──────────────┬──────────────┬────────────┐│
│  │ 👥 Pagantes  │ 🔄 Renovando │ ⚠️ Problemas │ 🔔 Alertas ││
│  │    127       │   Hoje: 8    │      2       │     3      ││
│  └──────────────┴──────────────┴──────────────┴────────────┘│
│                                                               │
│  🔔 ALERTAS CRÍTICOS                              [Ver Todos]│
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🔴 ZEUXIS - Renovação atrasada > 24h                │   │
│  │    → [Diagnosticar]  [Renovar Agora]               │   │
│  │                                                      │   │
│  │ 🟡 Eduardo - Badge diferente do banco               │   │
│  │    → [Reconciliar]  [Ver Detalhes]                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  📅 RENOVAÇÕES PROGRAMADAS (Próximos 7 dias)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Data     │ Usuário   │ Plano    │ Créditos  │ Status │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ Hoje     │ 8 usuários│ Vários   │ -         │ 🟢     │   │
│  │ 07/02    │ 5 usuários│ Vários   │ -         │ 🟢     │   │
│  │ 08/02    │ 3 usuários│ Vários   │ -         │ 🟢     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  🔧 AÇÕES RÁPIDAS                                             │
│  [Reconciliar Todos] [Executar Cron] [Gerar Relatório]      │
│                                                               │
│  📊 HISTÓRICO (Últimas 24h)                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Hora     │ Usuário   │ Ação      │ Método   │ Status │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ 10:05    │ Eduardo   │ Renovação │ Webhook  │ ✅     │   │
│  │ 09:32    │ Matheus   │ Renovação │ Webhook  │ ✅     │   │
│  │ 02:00    │ ZEUXIS    │ Renovação │ Cron     │ ⏭️ Skip│   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 👥 **3. APRIMORAMENTO: `/admin/users` (Já existe!)**

### **Adicionar Coluna "Status de Créditos":**

```typescript
// src/app/admin/users/page.tsx
// Adicionar ao select do Prisma:
select: {
  // ... campos existentes
  creditsExpiresAt: true,
  lastCreditRenewalAt: true,
  subscriptionStartedAt: true,
  billingCycle: true,
}

// Nova coluna na tabela:
<th className="px-3 py-2">Status Créditos</th>

// Célula:
<td className="px-3 py-2">
  <CreditStatusBadge user={user} />
</td>
```

### **Componente `CreditStatusBadge`:**

```typescript
// src/components/admin/credit-status-badge.tsx
'use client'

export function CreditStatusBadge({ user }) {
  const status = calculateCreditStatus(user)
  
  return (
    <div className="flex items-center gap-2">
      {status === 'OK' && <span className="text-green-600">✅ OK</span>}
      {status === 'GRACE' && <span className="text-yellow-600">⏳ Grace</span>}
      {status === 'EXPIRED' && <span className="text-red-600">❌ Expirado</span>}
      {status === 'ATTENTION' && <span className="text-orange-600">⚠️ Atenção</span>}
    </div>
  )
}
```

### **Nova Ação: "Diagnóstico de Créditos"**

```typescript
// src/app/admin/users/user-row-actions.tsx
// Adicionar nova opção:
<DropdownMenuItem onClick={() => router.push(`/admin/users/${user.id}/credits`)}>
  💰 Diagnóstico de Créditos
</DropdownMenuItem>
```

---

## 🔍 **4. NOVA PÁGINA: `/admin/users/[userId]/credits`**

### **Arquivo:** `src/app/admin/users/[userId]/credits/page.tsx`

```typescript
import { requireAdmin } from '@/lib/auth'
import { unstable_noStore as noStore } from 'next/cache'
import UserCreditsDiagnostic from './user-credits-diagnostic'

export default async function UserCreditsPage({ params }: { params: { userId: string } }) {
  noStore()
  await requireAdmin()
  
  const diagnostic = await getUserCreditsDiagnostic(params.userId)
  
  return <UserCreditsDiagnostic data={diagnostic} />
}
```

### **Layout da Página:**

```
┌─────────────────────────────────────────────────────────────┐
│  ← Voltar  |  💰 Diagnóstico de Créditos - ZEUXIS           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  👤 INFORMAÇÕES DO USUÁRIO                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Nome:   ZEUXIS                                       │   │
│  │ Email:  zeuxis@gmail.com                             │   │
│  │ Plano:  STARTER (R$ 39/mês)                          │   │
│  │ Status: 🟢 ACTIVE                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  💰 SALDO DE CRÉDITOS                                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Assinatura:  340 / 500 (68% usado)                   │   │
│  │ Comprados:   1845 créditos                            │   │
│  │ Total:       2185 créditos disponíveis                │   │
│  │ Badge:       2185 ✅ CORRETO                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  🔄 CICLO DE RENOVAÇÃO                                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Iniciou:          06/01/2026 às 10:30                │   │
│  │ Última Renovação: 06/01/2026 às 10:30 (inicial)      │   │
│  │ Expira Em:        06/02/2026 às 00:00 (em 12 dias)   │   │
│  │ Próxima:          06/02/2026                          │   │
│  │ Status:           🟢 DENTRO DO CICLO                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  💳 ASSINATURA ASAAS                          [Ver no Asaas] │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ID:               sub_abc123xyz                       │   │
│  │ Status Asaas:     ACTIVE ✅                           │   │
│  │ Último Pagamento: 06/01/2026 - R$ 39,00 (PIX)        │   │
│  │ Próxima Cobrança: 06/02/2026                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  📜 ÚLTIMAS TRANSAÇÕES                           [Ver Todas] │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Data/Hora    │ Tipo    │ Valor │ Descrição           │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ 24/01 15:32  │ SPENT   │ -15   │ Geração imagem      │   │
│  │ 24/01 14:20  │ SPENT   │ -15   │ Geração imagem      │   │
│  │ 20/01 10:45  │ EARNED  │ +350  │ Compra Essencial    │   │
│  │ 06/01 10:30  │ EARNED  │ +500  │ Ativação STARTER    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  🔧 FERRAMENTAS DE CORREÇÃO                                   │
│  [Reconciliar Badge] [Ajustar Créditos] [Renovar Manual]    │
│  [Invalidar Cache]   [Ver Logs]         [Exportar Relatório]│
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔔 **5. PÁGINA DE ALERTAS: `/admin/credits/alerts`**

### **Arquivo:** `src/app/admin/credits/alerts/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  🔔 CENTRAL DE ALERTAS                                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Filtros: [🔴 Críticos] [🟡 Atenção] [🔵 Info] [✅ Resolvidos]│
│                                                               │
│  🔴 ALERTAS CRÍTICOS (2)                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🔴 06/02 15:30                                       │   │
│  │ Renovação atrasada > 48h - ZEUXIS                    │   │
│  │ → Pagamento OK no Asaas, webhook não chegou          │   │
│  │ [Diagnosticar] [Renovar Agora] [Marcar Resolvido]   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  🟡 ALERTAS DE ATENÇÃO (3)                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🟡 06/02 12:00                                       │   │
│  │ Badge diferente do banco - Eduardo                   │   │
│  │ → Banco: 1200 | Badge: 1185 (diff: 15)              │   │
│  │ [Reconciliar] [Investigar] [Ignorar]                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 **6. PÁGINA DE RELATÓRIOS: `/admin/credits/reports`**

### **Arquivo:** `src/app/admin/credits/reports/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│  📊 RELATÓRIOS E AUDITORIA                                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  📅 Período: [01/02/2026] até [06/02/2026]                   │
│  📋 Tipo:    [Renovações ▼]                                  │
│  [Gerar Relatório]                                           │
│                                                               │
│  RELATÓRIO DE RENOVAÇÕES                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Total: 45 renovações                                 │   │
│  │ ✅ Sucesso:  42 (93.3%)                              │   │
│  │ ❌ Falha:    2 (4.4%)                                │   │
│  │ ⏭️  Skip:     1 (2.2%)                                │   │
│  │                                                      │   │
│  │ Método:                                              │   │
│  │ 🔔 Webhook:  40 (88.9%)                              │   │
│  │ ⏰ Cron:     3 (6.7%)                                │   │
│  │ 👤 Manual:   2 (4.4%)                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  [Exportar CSV] [Exportar PDF] [Ver Detalhes]               │
│                                                               │
│  📜 LOG DE AUDITORIA                                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Data/Hora    │ Admin │ Ação             │ Usuário    │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ 06/02 15:35  │ Lucas │ Renovação Manual │ ZEUXIS     │   │
│  │ 06/02 14:20  │ Lucas │ Ajuste Créditos  │ Eduardo    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ **7. ATUALIZAR MENU LATERAL (Sidebar)**

### **Arquivo:** `src/app/admin/admin-layout-client.tsx`

```typescript
const items = [
  { href: '/admin', label: 'Home' },
  { href: '/admin/users', label: 'Usuários' },
  { href: '/admin/credits', label: '💰 Créditos', badge: alertCount }, // 🆕 NOVO
  { href: '/admin/subscription-plans', label: 'Planos de Assinatura' },
  { href: '/admin/credit-packages', label: 'Pacotes de Créditos' },
  { href: '/admin/photo-packages', label: 'Pacotes de Fotos' },
  { href: '/admin/coupons', label: 'Cupons de Desconto' },
  { href: '/admin/payments', label: 'Cobranças' }, // 🆕 Adicionar ao menu
  { href: '/admin/analytics', label: 'Analytics' },
  { href: '/admin/retention', label: 'Retenção' },
  { href: '/admin/tools', label: 'Ferramentas' },
  { href: '/admin/feedback', label: 'Feedback' },
]
```

**Com badge de alertas:**
```
┌─────────────────────┐
│ Admin               │
├─────────────────────┤
│ Home                │
│ Usuários            │
│ 💰 Créditos    [3]  │ ← Badge vermelho se houver alertas
│ Planos...           │
└─────────────────────┘
```

---

## 🔧 **8. APIS NECESSÁRIAS**

```typescript
// Dashboard e métricas
GET  /api/admin/credits/dashboard
GET  /api/admin/credits/metrics

// Usuários
GET  /api/admin/credits/users
GET  /api/admin/credits/users/:id/diagnostic

// Ferramentas de correção
POST /api/admin/credits/users/:id/reconcile
POST /api/admin/credits/users/:id/adjust
POST /api/admin/credits/users/:id/renew
POST /api/admin/credits/cron/execute

// Alertas e relatórios
GET  /api/admin/credits/alerts
GET  /api/admin/credits/reports
GET  /api/admin/credits/audit-log

// Realtime (SSE)
GET  /api/admin/credits/stream
```

---

## 📦 **9. COMPONENTES REUTILIZÁVEIS**

```typescript
// Componentes compartilhados
src/components/admin/credits/
  ├── credit-status-badge.tsx      // Badge de status
  ├── credit-balance-card.tsx      // Card de saldo
  ├── renewal-info-card.tsx        // Info de renovação
  ├── asaas-subscription-card.tsx  // Info Asaas
  ├── transactions-table.tsx       // Tabela de transações
  ├── alerts-feed.tsx              // Feed de alertas
  ├── metrics-cards.tsx            // Cards de métricas
  ├── reconcile-dialog.tsx         // Modal de reconciliação
  ├── adjust-credits-dialog.tsx    // Modal de ajuste
  ├── manual-renewal-dialog.tsx    // Modal de renovação
  └── execute-cron-dialog.tsx      // Modal de cron
```

---

## 📋 **IMPLEMENTAÇÃO POR SPRINTS**

### **Sprint 1 (Esta Semana) - Dashboard Básico:**
1. ✅ Criar `/admin/credits/page.tsx` (dashboard principal)
2. ✅ API `/api/admin/credits/dashboard` (métricas)
3. ✅ API `/api/admin/credits/metrics`
4. ✅ Componente `MetricsCards`
5. ✅ Adicionar link no menu lateral
6. ✅ Adicionar card no dashboard principal

### **Sprint 2 (Próxima Semana) - Diagnóstico:**
1. ✅ Criar `/admin/users/[userId]/credits/page.tsx`
2. ✅ API `/api/admin/credits/users/:id/diagnostic`
3. ✅ Componentes de diagnóstico (cards)
4. ✅ Adicionar ação "Diagnóstico" na lista de usuários
5. ✅ Componente `CreditStatusBadge` na lista

### **Sprint 3 (Semana Seguinte) - Ferramentas:**
1. ✅ API `/api/admin/credits/users/:id/reconcile`
2. ✅ API `/api/admin/credits/users/:id/adjust`
3. ✅ API `/api/admin/credits/users/:id/renew`
4. ✅ API `/api/admin/credits/cron/execute`
5. ✅ Modais de correção (todos os 4)

### **Sprint 4 (Depois) - Alertas e Relatórios:**
1. ✅ Sistema de detecção de alertas
2. ✅ `/admin/credits/alerts/page.tsx`
3. ✅ `/admin/credits/reports/page.tsx`
4. ✅ API de alertas e relatórios
5. ✅ Log de auditoria

---

## 🚀 **VANTAGENS DA INTEGRAÇÃO**

1. ✅ **Reutiliza infraestrutura existente** (auth, layout, sidebar)
2. ✅ **UX consistente** com resto do admin
3. ✅ **Menos código** (aproveita componentes existentes)
4. ✅ **Mais rápido** (não precisa criar novo dashboard do zero)
5. ✅ **Integração natural** com `/admin/users`
6. ✅ **Fácil navegação** (tudo no mesmo lugar)

---

## 📂 **ESTRUTURA DE ARQUIVOS FINAL**

```
src/app/admin/
├── page.tsx                      ✏️ Atualizado (novo card)
├── layout.tsx                    ✅ Mantém
├── admin-layout-client.tsx       ✏️ Atualizado (novo menu item)
├── users/
│   ├── page.tsx                  ✏️ Atualizado (nova coluna + ação)
│   ├── [userId]/
│   │   └── credits/              🆕 NOVO
│   │       └── page.tsx
├── credits/                      🆕 NOVO
│   ├── page.tsx                  (dashboard principal)
│   ├── alerts/
│   │   └── page.tsx
│   ├── reports/
│   │   └── page.tsx
│   └── components/
│       ├── credits-dashboard.tsx
│       ├── user-credits-diagnostic.tsx
│       └── ... (outros componentes)

src/components/admin/credits/     🆕 NOVO
├── credit-status-badge.tsx
├── credit-balance-card.tsx
├── ... (componentes reutilizáveis)

src/app/api/admin/credits/        🆕 NOVO
├── dashboard/route.ts
├── users/
│   └── [id]/
│       ├── diagnostic/route.ts
│       ├── reconcile/route.ts
│       ├── adjust/route.ts
│       └── renew/route.ts
├── alerts/route.ts
├── reports/route.ts
└── cron/
    └── execute/route.ts
```

---

## ✅ **CHECKLIST DE IMPLEMENTAÇÃO**

### **Fase 1: Setup Básico**
- [ ] Adicionar card no dashboard principal (`/admin`)
- [ ] Adicionar item no menu lateral
- [ ] Criar pasta `/admin/credits`
- [ ] Criar API base `/api/admin/credits`

### **Fase 2: Dashboard de Créditos**
- [ ] `/admin/credits/page.tsx` com métricas
- [ ] API de dashboard e métricas
- [ ] Componentes de cards

### **Fase 3: Aprimorar Lista de Usuários**
- [ ] Adicionar coluna "Status de Créditos"
- [ ] Adicionar ação "Diagnóstico de Créditos"
- [ ] Componente `CreditStatusBadge`

### **Fase 4: Página de Diagnóstico**
- [ ] `/admin/users/[userId]/credits/page.tsx`
- [ ] API de diagnóstico completo
- [ ] Componentes de diagnóstico

### **Fase 5: Ferramentas de Correção**
- [ ] APIs de correção (4 endpoints)
- [ ] Modais de correção (4 dialogs)
- [ ] Integrar com página de diagnóstico

### **Fase 6: Alertas e Relatórios**
- [ ] Sistema de detecção de alertas
- [ ] Página de alertas
- [ ] Página de relatórios
- [ ] Log de auditoria

---

**Quer que eu comece pela Fase 1?** 🚀
