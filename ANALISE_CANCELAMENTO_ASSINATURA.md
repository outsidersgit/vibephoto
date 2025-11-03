# Análise do Fluxo de Cancelamento de Assinatura

## 🔍 Problemas Identificados

### 1. **Método DELETE pode não retornar dados completos**

**Arquivo:** `src/lib/payments/asaas.ts` - Linha 298-302

**Problema:**
```typescript
async cancelSubscription(subscriptionId: string) {
  return this.request(`/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
  })
}
```

O método DELETE pode retornar apenas um status de sucesso, mas o código em `src/app/api/payments/subscription/cancel/route.ts` tenta acessar `asaasResponse.nextDueDate`:

```typescript
const subscriptionEndsAt = cancelImmediately 
  ? cancelDate 
  : new Date(asaasResponse.nextDueDate) // ❌ Pode não existir
```

**Solução:** Buscar a assinatura antes de cancelar para obter `nextDueDate`, ou usar o `endDate` se disponível.

---

### 2. **Falta Broadcast SSE após Cancelamento**

**Problema:** Após cancelar a assinatura, o frontend não é atualizado automaticamente.

**Impacto:**
- ❌ Usuário precisa recarregar página (F5) para ver mudanças
- ❌ Badge de assinatura não atualiza
- ❌ Interface não reflete cancelamento imediato

**Solução:** Adicionar `broadcastUserUpdate()` após cancelamento.

---

### 3. **Falta verificação de status antes de cancelar**

**Problema:** Não verifica se a assinatura está realmente `ACTIVE` antes de cancelar no Asaas.

**Impacto:**
- ❌ Pode tentar cancelar assinatura já cancelada
- ❌ Erros desnecessários do Asaas

**Solução:** Buscar assinatura do Asaas primeiro e verificar status.

---

### 4. **Tratamento de erro incompleto**

**Problema:** Se o DELETE falhar, o código não lida bem com diferentes tipos de erro.

**Solução:** Melhorar tratamento de erros e logs.

---

## ✅ Fluxo Correto (Como Deveria Ser)

### Etapa 1: Verificações
- ✅ Verificar autenticação do usuário
- ✅ Verificar que assinatura pertence ao usuário
- ✅ Verificar que assinatura não está já cancelada
- ✅ **Buscar assinatura do Asaas para obter dados atuais** ⚠️ FALTANDO

### Etapa 2: Cancelar no Asaas
- ✅ Chamar DELETE no Asaas
- ✅ **Tratar resposta corretamente** ⚠️ PROBLEMA
- ✅ **Verificar se cancelamento foi bem-sucedido** ⚠️ FALTANDO

### Etapa 3: Atualizar Banco
- ✅ Atualizar `subscriptionStatus = 'CANCELLED'`
- ✅ Atualizar `subscriptionEndsAt` (baseado em `nextDueDate` do Asaas ou `cancelImmediately`)
- ✅ Salvar `subscriptionCancelledAt`
- ✅ Se `cancelImmediately`, resetar para STARTER

### Etapa 4: Broadcast SSE
- ⚠️ **FALTANDO:** Broadcast para frontend

### Etapa 5: Logs
- ✅ Criar `usageLog`
- ✅ Criar `systemLog`

---

## 🔧 Correções Necessárias

### Correção 1: Buscar assinatura antes de cancelar

Antes de cancelar, buscar a assinatura do Asaas para:
- Obter `nextDueDate` atual
- Verificar status atual
- Validar que pode ser cancelada

### Correção 2: Tratar resposta do DELETE

O DELETE pode retornar:
- Status 200/204 com corpo vazio
- Status 200 com dados da assinatura cancelada
- Precisamos buscar a assinatura após cancelar para obter dados atualizados

### Correção 3: Adicionar Broadcast SSE

Após atualizar o banco, fazer broadcast para atualizar frontend.

### Correção 4: Melhorar tratamento de erros

Tratar diferentes tipos de erro do Asaas:
- 404: Assinatura não encontrada
- 400: Assinatura já cancelada
- 500: Erro do servidor

