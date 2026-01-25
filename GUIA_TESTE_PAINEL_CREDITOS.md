# 🧪 GUIA DE TESTE - PAINEL ADMIN DE CRÉDITOS

**Data:** 25/01/2026  
**Ambiente:** Produção (https://vibephoto.app)

---

## ✅ **PRÉ-REQUISITOS**

1. ✅ Deploy feito na Vercel
2. ✅ Aguardar 2-3 minutos para build completar
3. ✅ Fazer login como admin em: https://vibephoto.app/admin
   - **Email:** `outsiders.agency.ai@gmail.com`
   - **Senha:** (senha de admin)

---

## 🎯 **TESTE 1: VERIFICAR MENU E CARD**

### **1.1 - Dashboard Principal (`/admin`)**
```
URL: https://vibephoto.app/admin
```

**O que verificar:**
- [ ] Existe um card **"💰 Monitoramento de Créditos"** com destaque (borda roxa/azul)
- [ ] O card tem descrição sobre monitorar renovações e ajustar créditos
- [ ] Ao clicar no card, redireciona para `/admin/credits`

### **1.2 - Menu Lateral**
**O que verificar:**
- [ ] No menu lateral esquerdo, existe item **"💰 Créditos"** (com highlight roxo)
- [ ] O item está abaixo de "Usuários" e acima de "Cobranças"
- [ ] Ao clicar, redireciona para `/admin/credits`

**Se NÃO aparecer:** Deploy ainda não completou ou houve erro no build. Aguardar mais 1-2 min.

---

## 🎯 **TESTE 2: DASHBOARD DE CRÉDITOS**

### **2.1 - Acessar Dashboard**
```
URL: https://vibephoto.app/admin/credits
```

**O que deve aparecer:**
1. **Título:** "💰 Monitoramento de Créditos"
2. **Botão:** "Atualizar" (canto superior direito)
3. **4 Cards de Métricas:**
   - 👥 Usuários Pagantes
   - 🔄 Renovando Hoje
   - ⚠️ Problemas
   - 🔔 Alertas Críticos

### **2.2 - Verificar Métricas**
**Valores esperados (aproximados):**
- Usuários Pagantes: **~10-15** (usuários reais + teste)
- Renovando Hoje: **0-2** (depende da data)
- Problemas: **0-3** (usuários com problemas detectados)
- Alertas Críticos: **0-2** (problemas graves)

**Se aparecer "Carregando..." por mais de 5 segundos:**
- Abrir **DevTools** (F12)
- Ir em **Console**
- Verificar se há erros (vermelho)
- Ir em **Network**
- Verificar se `/api/admin/credits/dashboard` retornou 500 ou 404

### **2.3 - Alertas Críticos (se houver)**
**Se `Alertas Críticos > 0`:**
- [ ] Aparece um box vermelho abaixo das métricas
- [ ] Lista os problemas (ex: "2 usuário(s) com renovação atrasada")

### **2.4 - Renovações Programadas**
**Tabela: "📅 Renovações Programadas (Próximos 7 dias)"**
- [ ] Lista usuários que vão renovar nos próximos 7 dias
- [ ] Colunas: Usuário | Plano | Créditos | Expira Em | Ações
- [ ] Botão "Ver Diagnóstico" em cada linha

**Para testar:**
- Clicar em **"Ver Diagnóstico"** em um usuário
- Deve redirecionar para `/admin/users/[userId]/credits`

### **2.5 - Ações Rápidas**
**Seção: "🔧 Ações Rápidas"**
- [ ] Botão **"Executar Cron de Renovação"** (azul)
- [ ] Botão **"Ver Todos os Usuários"** (cinza)

**Teste do Cron (CUIDADO!):**
1. Clicar em "Executar Cron de Renovação"
2. Aparece um **confirm()**: "Executar job de renovação mensal agora?"
3. Clicar **"Cancelar"** por enquanto (não executar ainda)

### **2.6 - Histórico Recente**
**Tabela: "📊 Renovações Recentes (Últimas 24h)"**
- [ ] Lista renovações que aconteceram nas últimas 24h
- [ ] Colunas: Data/Hora | Usuário | Plano | Créditos | Descrição
- [ ] Se não houver, mostra "Nenhuma renovação nas últimas 24 horas"

---

## 🎯 **TESTE 3: DIAGNÓSTICO INDIVIDUAL**

### **3.1 - Acessar Diagnóstico**
**Escolha um usuário real para testar:**
- Usuário sugerido: **Lucas Aragão** (ID: `cmhktfezk0000lb04ergjfykk`)
- Ou qualquer outro usuário com assinatura ativa

```
URL: https://vibephoto.app/admin/users/cmhktfezk0000lb04ergjfykk/credits
```

**IMPORTANTE:** Faça login com **`outsiders.agency.ai@gmail.com`** (admin)

**Ou:**
1. Ir em `/admin/users`
2. Procurar usuário "Lucas Aragão"
3. (Futuro) Clicar no dropdown de ações → "Diagnóstico de Créditos"

### **3.2 - Informações do Usuário**
**Card: "👤 Informações do Usuário"**
- [ ] Nome, Email, Plano, Ciclo
- [ ] Status da assinatura
- [ ] ID Asaas

### **3.3 - Saldo de Créditos**
**Card: "💰 Saldo de Créditos"**

**Créditos da Assinatura:**
- [ ] Mostra valor disponível / limite
- [ ] Porcentagem de uso
- [ ] Barra de progresso roxa

**Exemplo esperado para Lucas Aragão:**
```
Créditos da Assinatura: 1340 / 1500 (11% usado)
Barra de progresso: 11% preenchida
```

**Créditos Comprados:**
- [ ] Mostra saldo de créditos avulsos
- [ ] Cor verde

**Total Disponível:**
- [ ] Soma dos dois tipos
- [ ] Número grande em destaque

**Exemplo esperado para Lucas Aragão:**
```
Total Disponível: 3185 créditos
(1340 da assinatura + 1845 comprados)
```

### **3.4 - Ciclo de Renovação**
**Card: "🔄 Ciclo de Renovação"**

**Status do Ciclo:**
- [ ] Ícone colorido: 🟢 ATIVO | ⏳ GRACE | ❌ EXPIRADO | ⚠️ EXPIRANDO
- [ ] Mensagem contextual

**Datas:**
- [ ] Iniciou em
- [ ] Última Renovação
- [ ] Expira em
- [ ] Próxima Cobrança

**Exemplo esperado para usuário ativo:**
```
Status: 🟢 Ciclo ativo e saudável
Iniciou em: 08/01/2026
Última Renovação: 08/01/2026
Expira em: 08/02/2026
Próxima Cobrança: 08/02/2026
```

### **3.5 - Compras de Créditos (se houver)**
**Tabela: "📦 Compras de Créditos"**
- [ ] Lista todos os pacotes comprados
- [ ] Colunas: Pacote | Créditos | Usados | Restantes | Válido Até | Status
- [ ] Badge verde "Ativo" ou vermelho "Expirado"

### **3.6 - Últimas Transações**
**Tabela: "📜 Últimas Transações"**
- [ ] Lista últimas 20 transações
- [ ] Tipos com cores: EARNED (verde) | SPENT (vermelho) | RENEWED (verde)
- [ ] Descrição clara de cada transação

### **3.7 - Alertas de Problemas**
**Se houver problemas (no topo da página):**
- [ ] Box amarelo com lista de problemas
- [ ] Mensagens claras (ex: "Em grace period (24h)")

### **3.8 - Ferramentas de Correção**
**Card: "🔧 Ferramentas de Correção"**

**Botões disponíveis:**
- [ ] **Reconciliar Badge** (azul)
- [ ] **Ajustar Créditos** (verde)
- [ ] **Renovar Manual** (roxo)
- [ ] **Invalidar Cache** (cinza)

---

## 🎯 **TESTE 4: FERRAMENTA DE RECONCILIAÇÃO**

### **4.1 - Testar Reconciliar Badge**
**No diagnóstico de um usuário:**

1. Clicar em **"Reconciliar Badge"**
2. **Modal aparece:**
   - [ ] Título: "Reconciliar Badge"
   - [ ] Texto explicativo
   - [ ] Botões: "Cancelar" e "Confirmar"

3. Clicar em **"Confirmar"**
4. **Aguardar resposta:**
   - [ ] Alert com "✅ Badge reconciliado com sucesso!"
   - [ ] Página atualiza automaticamente (dados podem mudar)

**O que acontece nos bastidores:**
- Invalida cache Next.js
- Envia notificação SSE para frontend do usuário
- Registra ação no log de auditoria

### **4.2 - Verificar se Funcionou**
**No navegador do usuário (se tiver acesso):**
- Abrir conta do usuário
- Verificar se o badge de créditos atualizou

---

## 🎯 **TESTE 5: EXECUTAR CRON (OPCIONAL)**

⚠️ **CUIDADO:** Só execute se tiver certeza!

### **5.1 - Quando Executar**
**Cenários seguros:**
- Ambiente de teste/staging
- Após confirmar que validações estão OK
- Em horário de baixo tráfego

**NUNCA executar:**
- Se houver muitos "Alertas Críticos"
- Sem antes investigar problemas
- Em horário de pico

### **5.2 - Como Executar**
1. Ir em `/admin/credits`
2. Clicar em **"Executar Cron de Renovação"**
3. Confirmar
4. **Aguardar resposta** (pode levar 10-30s)
5. Alert mostra resumo:
   ```
   ✅ Cron executado!
   
   Processados: 10
   Renovados: 2
   Skipped: 8
   ```

### **5.3 - Verificar Resultado**
- Dashboard atualiza automaticamente
- Verificar "Renovações Recentes" (deve aparecer novas)
- Verificar se "Alertas Críticos" diminuiu

---

## 🎯 **TESTE 6: VERIFICAR LOGS (DevTools)**

### **6.1 - Console**
**Abrir DevTools (F12) → Console**

**Logs esperados:**
```
✅ [GET /api/admin/credits/dashboard] Success
✅ [GET /api/admin/credits/users/xxx/diagnostic] Success
```

**Erros comuns:**
```
❌ 404 Not Found → Deploy incompleto
❌ 500 Internal Server Error → Erro no banco ou API
❌ 403 Forbidden → Não está logado como admin
```

### **6.2 - Network**
**Abrir DevTools (F12) → Network**

**Requisições esperadas:**
1. **GET** `/api/admin/credits/dashboard` → Status **200**
2. **GET** `/api/admin/credits/users/[userId]/diagnostic` → Status **200**
3. **POST** `/api/admin/credits/users/[userId]/reconcile` → Status **200**

**Se status 404:**
- Deploy não completou ainda
- Aguardar mais 2-3 minutos

**Se status 500:**
- Erro no servidor (banco, API, etc)
- Ver resposta JSON para detalhes

---

## ✅ **CHECKLIST RESUMIDO**

### **Deploy e Acesso**
- [ ] Deploy completou na Vercel
- [ ] Login feito como admin
- [ ] Sem erros no console inicial

### **Dashboard (`/admin`)**
- [ ] Card "💰 Monitoramento de Créditos" aparece
- [ ] Menu lateral tem "💰 Créditos"

### **Dashboard de Créditos (`/admin/credits`)**
- [ ] 4 métricas carregam com valores numéricos
- [ ] Tabela de renovações programadas (pode estar vazia)
- [ ] Botão "Executar Cron" aparece
- [ ] Histórico recente (pode estar vazio)

### **Diagnóstico Individual**
- [ ] Página carrega com todos os cards
- [ ] Saldo de créditos correto (conferir com banco se possível)
- [ ] Status do ciclo com cor e ícone
- [ ] Últimas transações aparecem
- [ ] 4 botões de ferramentas aparecem

### **Reconciliação**
- [ ] Modal abre ao clicar
- [ ] Alert de sucesso após confirmar
- [ ] Página atualiza

---

## 🐛 **PROBLEMAS COMUNS E SOLUÇÕES**

### **"Carregando..." infinito**
**Causa:** API não está respondendo
**Solução:**
1. Abrir DevTools → Network
2. Ver status da requisição
3. Se 404: aguardar deploy completar
4. Se 500: ver resposta para detalhes do erro

### **404 Not Found nas APIs**
**Causa:** Deploy incompleto
**Solução:**
1. Verificar no painel Vercel se build completou
2. Ver logs do build para erros
3. Aguardar 2-3 minutos após deploy
4. Fazer hard refresh (Ctrl+Shift+R)

### **500 Internal Server Error**
**Causa:** Erro no banco ou lógica
**Solução:**
1. Ver resposta JSON (DevTools → Network → Resposta)
2. Ver logs no Vercel (Runtime Logs)
3. Verificar variáveis de ambiente (DATABASE_URL, etc)

### **Dados não batem com banco**
**Causa:** Cache ou lógica de cálculo
**Solução:**
1. Clicar em "Reconciliar Badge"
2. Fazer hard refresh (Ctrl+Shift+R)
3. Se persistir, verificar SQL direto no banco

### **Menu/Card não aparecem**
**Causa:** Arquivos não foram deployados
**Solução:**
1. Verificar commit no GitHub
2. Verificar Vercel pegou o commit certo
3. Ver logs de build (procurar por "admin-layout-client.tsx")
4. Fazer redeploy forçado

---

## 📊 **VALORES ESPERADOS (REFERÊNCIA)**

### **Usuário: Lucas Aragão (cmhktfezk0000lb04ergjfykk)**
```yaml
Créditos da Assinatura:
  - Limite: 1500
  - Usados: 160
  - Disponíveis: 1340
  - Porcentagem: 11%

Créditos Comprados:
  - Saldo: 1845

Total:
  - 3185 créditos

Ciclo:
  - Status: ATIVO 🟢
  - Plano: GOLD
  - Ciclo: MONTHLY
  - Expira: 08/02/2026
```

### **Métricas Globais (aproximadas)**
```yaml
Dashboard:
  - Usuários Pagantes: 10-15
  - Renovando Hoje: 0-2
  - Problemas: 0-3
  - Alertas Críticos: 0-2
```

---

## 🎉 **SUCESSO!**

Se todos os testes passaram:
- ✅ Sistema está 100% funcional
- ✅ APIs funcionando
- ✅ Frontend renderizando
- ✅ Ferramentas disponíveis

**Próximos passos:**
1. Monitorar próxima renovação real (06/02/2026)
2. Verificar logs e alertas diariamente
3. Usar ferramentas conforme necessário

---

**Qualquer problema, verificar:**
1. DevTools → Console
2. DevTools → Network
3. Vercel → Runtime Logs
4. GitHub → Último commit
