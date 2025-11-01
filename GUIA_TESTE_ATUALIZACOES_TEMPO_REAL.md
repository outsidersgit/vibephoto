# 🧪 Guia de Teste - Atualizações em Tempo Real

Este guia ajuda a verificar se as melhorias de atualização em tempo real estão funcionando corretamente.

## 📋 Pré-requisitos

1. Abra o **Console do Navegador** (F12 → Console)
2. Mantenha a aba aberta durante os testes
3. Certifique-se de estar logado na aplicação

---

## ✅ Teste 1: Verificar Conexão SSE (Server-Sent Events)

### Passos:
1. Abra qualquer página protegida (ex: `/dashboard`, `/gallery`, `/credits`)
2. Verifique o console do navegador

### Logs Esperados:
```
🎉 SSE connection confirmed: Real-time updates connected - webhook-driven system
📡 Server info: { pollingDisabled: true, webhookEnabled: true, instantUpdates: true }
📥 SSE event received: connected
```

### ✅ Resultado Esperado:
- Conexão SSE estabelecida com sucesso
- Status de conexão confirmado no console

---

## ✅ Teste 2: Atualização de Créditos Após Compra

### Passos:
1. Anote o saldo atual de créditos no dashboard
2. Abra o console do navegador
3. Compre créditos através do modal de compra
4. Complete o checkout
5. Observe o console e o dashboard

### Logs Esperados no Console:
```
✅ Checkout completed successfully
🔄 [CheckoutModal] Invalidando queries após checkout success
🔄 [PremiumNavigation] Créditos atualizados via SSE - invalidando queries
📥 SSE event received: credits_updated { creditsUsed: X, creditsLimit: Y, action: 'PURCHASE' }
```

### ✅ Resultado Esperado:
- **Console**: Logs de invalidação de queries
- **Dashboard**: Créditos atualizados automaticamente (sem reload)
- **Tempo**: Atualização ocorre em **menos de 5 segundos**

---

## ✅ Teste 3: Verificar Invalidação de Queries (React Query)

### Passos:
1. Abra o console do navegador
2. Vá para `/credits` ou `/dashboard`
3. Observe os logs durante uma ação (compra, uso, etc.)

### Logs Esperados:
```
🔄 [CreditsDashboard] Créditos atualizados via SSE - invalidando queries
🔄 [CreditsOverview] Créditos atualizados via SSE - invalidando queries
🔄 [PremiumNavigation] Créditos atualizados via SSE - invalidando queries
```

### Como Verificar no DevTools:
1. Abra **DevTools** → **Network**
2. Filtre por **Fetch/XHR**
3. Após uma ação, você verá requisições automáticas para:
   - `/api/credits/balance`
   - `/api/credits?action=usage`
   - `/api/credits?action=storage`

### ✅ Resultado Esperado:
- Queries são invalidadas automaticamente
- Novos dados são buscados automaticamente
- UI atualiza sem necessidade de reload manual

---

## ✅ Teste 4: Atualização Automática do Dashboard

### Passos:
1. Abra `/dashboard` em uma aba
2. Abra `/credits` em outra aba (mesmo navegador)
3. Na aba `/credits`, compre créditos
4. Volte para a aba `/dashboard`

### ✅ Resultado Esperado:
- Dashboard atualiza automaticamente ao voltar
- Créditos exibidos estão atualizados
- Logs no console mostram: `refetchOnWindowFocus: true`

---

## ✅ Teste 5: Polling Automático (Fallback)

### Passos:
1. Abra `/dashboard`
2. No console, procure por logs de refetch

### Logs Esperados:
```
🔄 Refetching credits data (polling every 60 seconds)
```

### Como Verificar:
1. Abra **DevTools** → **Network**
2. Observe requisições periódicas para `/api/credits/balance`
3. Intervalo esperado: **60 segundos** (1 minuto)

### ✅ Resultado Esperado:
- Polling automático ativo como fallback
- Dados atualizados mesmo sem SSE

---

## ✅ Teste 6: Atualização Via SSE (Event-Driven)

### Configuração:
1. Abra o console do navegador
2. Mantenha a aplicação aberta
3. Em outra aba/dispositivo, faça uma ação que altere créditos

### Logs Esperados:
```
📥 SSE event received: credits_updated
🔄 [ComponentName] Créditos atualizados via SSE - invalidando queries
```

### ✅ Resultado Esperado:
- Eventos SSE recebidos instantaneamente
- UI atualiza **imediatamente** (< 1 segundo)
- Sem necessidade de polling

---

## ✅ Teste 7: Múltiplos Componentes Atualizados Simultaneamente

### Passos:
1. Abra `/dashboard`
2. Observe os componentes: **CreditsOverview**, **CreditsDashboard**, **PremiumNavigation**
3. Faça uma ação que altere créditos

### Logs Esperados:
```
🔄 [CreditsOverview] Créditos atualizados via SSE - invalidando queries
🔄 [CreditsDashboard] Créditos atualizados via SSE - invalidando queries
🔄 [PremiumNavigation] Créditos atualizados via SSE - invalidando queries
```

### ✅ Resultado Esperado:
- **Todos os componentes** atualizam simultaneamente
- Dados consistentes em toda a aplicação
- Sem dessincronização entre componentes

---

## ✅ Teste 8: Verificar Atualização de Sessão

### Passos:
1. Abra o console do navegador
2. Complete uma compra
3. Observe os logs

### Logs Esperados:
```
🔄 [CheckoutModal] Invalidando queries após checkout success
Session updated: { subscriptionStatus: 'ACTIVE', ... }
```

### ✅ Resultado Esperado:
- Sessão NextAuth atualizada automaticamente
- Dados da sessão refletem mudanças imediatamente

---

## 🔍 Verificações Avançadas (DevTools)

### 1. React Query DevTools (Opcional)

Se tiver React Query DevTools instalado:
1. Abra o DevTools
2. Procure pela aba **React Query** ou **TanStack Query**
3. Verifique:
   - Queries com status `fetching` após ações
   - Cache invalidation ocorrendo
   - Dados atualizados automaticamente

### 2. Network Tab

1. Abra **DevTools** → **Network**
2. Filtre por **Fetch/XHR**
3. Durante ações, observe:
   - Requisições automáticas para APIs de créditos
   - Status `200 OK`
   - Timing rápido (< 500ms)

### 3. Performance

1. Abra **DevTools** → **Performance**
2. Grave durante uma atualização
3. Verifique:
   - Menos requisições desnecessárias
   - Cache sendo reutilizado
   - UI atualiza suavemente (sem lag)

---

## ❌ Problemas Comuns e Soluções

### Problema: Não vejo logs de SSE no console
**Solução**: 
- Verifique se está logado
- Certifique-se de que a página não bloqueou pop-ups
- Verifique se há erros de conexão no console

### Problema: Créditos não atualizam automaticamente
**Solução**:
1. Verifique logs de invalidação de queries
2. Verifique se há erros no console
3. Tente fazer um reload manual (F5)
4. Verifique se o SSE está conectado (Teste 1)

### Problema: Atualização demora muito (> 10 segundos)
**Solução**:
- Verifique conexão SSE (pode estar usando polling como fallback)
- Verifique logs de erro no console
- Verifique status da conexão SSE

---

## 📊 Checklist de Verificação Rápida

Marque quando cada teste passar:

- [ ] **Teste 1**: Conexão SSE estabelecida
- [ ] **Teste 2**: Créditos atualizam após compra (sem reload)
- [ ] **Teste 3**: Logs de invalidação aparecem no console
- [ ] **Teste 4**: Dashboard atualiza ao voltar à aba
- [ ] **Teste 5**: Polling automático ativo (60s)
- [ ] **Teste 6**: Eventos SSE recebidos instantaneamente
- [ ] **Teste 7**: Múltiplos componentes atualizam simultaneamente
- [ ] **Teste 8**: Sessão atualizada automaticamente

---

## 🎯 Resultado Esperado Final

✅ **Atualizações em tempo real funcionando quando:**
- Logs de SSE aparecem no console
- Créditos atualizam automaticamente após ações
- Múltiplos componentes sincronizam corretamente
- UI atualiza sem reload manual
- Performance é boa (atualizações rápidas)

❌ **Problema se:**
- Nenhum log de SSE aparece
- Créditos não atualizam automaticamente
- Componentes mostram dados desatualizados
- Necessário reload manual para ver mudanças

---

## 📝 Notas Importantes

1. **SSE é a fonte principal** de atualizações em tempo real
2. **Polling (60s) é fallback** quando SSE não está disponível
3. **Invalidação de queries** força refetch automático
4. **Todos os componentes** devem atualizar simultaneamente
5. **Performance**: Atualizações devem ser < 5 segundos

---

## 🐛 Debug Avançado

### Verificar Status da Conexão SSE:
```javascript
// No console do navegador
window.__SSE_STATUS__ // Se disponível
```

### Verificar Cache do React Query:
```javascript
// No console do navegador (se React Query DevTools instalado)
// Verifique queries relacionadas a 'credits'
```

### Forçar Invalidação Manual (Teste):
```javascript
// No console do navegador
const { queryClient } = await import('@tanstack/react-query')
queryClient.invalidateQueries({ queryKey: ['credits'] })
```

---

**Última atualização**: 01/11/2025
**Versão**: 1.0

