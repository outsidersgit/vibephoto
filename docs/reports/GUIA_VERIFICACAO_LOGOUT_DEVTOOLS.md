# Guia Passo a Passo - Verificação Visual de Cache no DevTools

Este guia detalha como verificar visualmente se todos os caches (localStorage, sessionStorage, cookies, React Query) foram limpos corretamente após o logout no VibePhoto.

## 📋 Pré-requisitos

1. Navegador Chrome ou Edge (recomendado) ou Firefox
2. Conta de teste no VibePhoto (tainabuenojg@gmail.com / 123456)
3. DevTools aberto no navegador

---

## 🚀 Passo a Passo Completo

### **Etapa 1: Abrir o DevTools**

1. Abra o navegador Chrome ou Edge
2. Acesse `https://vibephoto.app`
3. Pressione `F12` ou `Ctrl + Shift + I` (Windows/Linux) ou `Cmd + Option + I` (Mac)
4. O DevTools será aberto na parte inferior ou lateral da janela

### **Etapa 2: Fazer Login e Verificar Dados ANTES do Logout**

Antes de fazer logout, vamos verificar quais dados estão armazenados:

#### **2.1 Verificar localStorage**

1. No DevTools, clique na aba **"Application"** (ou **"Aplicativo"** se estiver em português)
2. No painel esquerdo, expanda **"Storage"** → **"Local Storage"**
3. Clique em `https://vibephoto.app`
4. Anote as chaves presentes (ex: `consent_preferences`, `edit_history`, `feedback_dismissals`, etc.)

#### **2.2 Verificar sessionStorage**

1. No mesmo painel, expanda **"Storage"** → **"Session Storage"**
2. Clique em `https://vibephoto.app`
3. Anote as chaves presentes (se houver)

#### **2.3 Verificar Cookies**

1. No mesmo painel, expanda **"Storage"** → **"Cookies"**
2. Clique em `https://vibephoto.app`
3. Anote os cookies presentes, especialmente:
   - `next-auth.session-token` (cookie de sessão do NextAuth)
   - `__Secure-next-auth.session-token` (versão segura)
   - Qualquer outro cookie relacionado ao app

#### **2.4 Verificar Cache do React Query (opcional)**

1. Clique na aba **"Console"** no DevTools
2. Digite: `window.__REACT_QUERY_STATE__` e pressione Enter
3. Verifique se há dados de cache (pode retornar `undefined` se não houver cache visível)

---

### **Etapa 3: Realizar o Logout**

1. No navegador, clique no menu do usuário (botão com inicial "T" no header)
2. Clique em **"Sair"**
3. Aguarde o redirecionamento para `/auth/signin`

---

### **Etapa 4: Verificar Dados APÓS o Logout**

Após o logout, vamos verificar se os dados foram realmente limpos:

#### **4.1 Verificar localStorage após logout**

1. No DevTools, mantenha a aba **"Application"** aberta
2. Clique novamente em **"Local Storage"** → `https://vibephoto.app`
3. **Verifique:**
   - ✅ Deve conter apenas:
     - `ensaio_fotos_consent` (se presente antes)
     - `consent_preferences` (se presente antes)
   - ❌ Não deve conter:
     - `edit_history`
     - `feedback_dismissals`
     - Qualquer outra chave relacionada à sessão do usuário

**Como verificar se está limpo:**
- Se você vir apenas 1-2 chaves relacionadas a consentimentos → ✅ **PASSOU**
- Se você vir muitas chaves (5+) → ❌ **FALHOU**

#### **4.2 Verificar sessionStorage após logout**

1. No DevTools, clique em **"Session Storage"** → `https://vibephoto.app`
2. **Verifique:**
   - ✅ Deve estar completamente vazio (0 itens)
   - ❌ Não deve conter nenhuma chave

**Como verificar se está limpo:**
- Se você vir "No items" ou lista vazia → ✅ **PASSOU**
- Se você vir qualquer chave → ❌ **FALHOU**

#### **4.3 Verificar Cookies após logout**

1. No DevTools, clique em **"Cookies"** → `https://vibephoto.app`
2. **Verifique:**
   - ✅ O cookie `next-auth.session-token` deve estar **ausente** ou **expirado**
   - ✅ O cookie `__Secure-next-auth.session-token` deve estar **ausente** ou **expirado**
   - ❌ Não deve haver cookies de sessão válidos

**Como verificar se está limpo:**
- Se você não vir cookies `next-auth.session-token` ou se estiverem expirados → ✅ **PASSOU**
- Se você vir cookies `next-auth.session-token` com data de expiração futura → ❌ **FALHOU**

#### **4.4 Verificar Console Logs (logs de limpeza)**

1. Clique na aba **"Console"** no DevTools
2. Procure por mensagens que começam com:
   - `🧹 Iniciando limpeza completa de cache e sessão...`
   - `🗑️ Removendo localStorage: [key]`
   - `🗑️ sessionStorage limpo`
   - `🗑️ Removendo cookie: [name]`
   - `🗑️ React Query cache limpo`
   - `🔐 Fazendo logout do NextAuth...`
   - `✅ Logout completo realizado com sucesso`

**Como verificar:**
- Se você vir todas essas mensagens no console → ✅ **PASSOU** (limpeza executada)
- Se você não vir essas mensagens → ❌ **FALHOU** (função de logout não foi executada)

---

### **Etapa 5: Testar Acesso a Rotas Protegidas**

#### **5.1 Testar acesso direto via URL**

1. Na barra de endereço do navegador, digite: `https://vibephoto.app/gallery`
2. Pressione Enter
3. **Verifique:**
   - ✅ Deve redirecionar automaticamente para `/auth/signin?callbackUrl=...`
   - ❌ Não deve carregar a página `/gallery`

#### **5.2 Testar requisição API**

1. No DevTools, clique na aba **"Network"** (ou **"Rede"**)
2. Filtre por **"Fetch/XHR"**
3. Tente acessar uma rota protegida (ex: `/gallery`)
4. Procure por requisições para `/api/gallery` ou `/api/gallery/data`
5. **Verifique:**
   - ✅ A requisição deve retornar status **401** (Unauthorized)
   - ✅ O corpo da resposta deve conter `{ error: 'Authentication required', code: 'UNAUTHORIZED' }`
   - ❌ Não deve retornar dados da galeria (status 200)

**Como verificar:**
- Clique na requisição na aba Network
- Vá para a aba **"Headers"** e verifique o **Status Code**
- Vá para a aba **"Response"** e verifique o conteúdo da resposta

---

### **Etapa 6: Verificar React Query Cache (Avançado)**

Se você tiver o React Query DevTools instalado:

1. Procure pelo ícone do React Query no canto inferior direito da página
2. Clique nele para abrir o DevTools do React Query
3. **Verifique:**
   - ✅ Não deve haver queries ativas relacionadas ao usuário
   - ✅ Cache deve estar vazio ou contendo apenas queries públicas

**Nota:** Se o React Query DevTools não estiver disponível, a limpeza do cache é confirmada pelos logs no console (`🗑️ React Query cache limpo`).

---

## ✅ Checklist de Verificação Final

Marque cada item após a verificação:

- [ ] **localStorage**: Contém apenas 1-2 chaves de consentimentos
- [ ] **sessionStorage**: Completamente vazio (0 itens)
- [ ] **Cookies**: Cookie `next-auth.session-token` ausente ou expirado
- [ ] **Console Logs**: Mensagens de limpeza aparecem no console
- [ ] **Acesso Direto**: Redireciona para `/auth/signin` ao tentar acessar `/gallery`
- [ ] **Requisições API**: Retornam status 401 para rotas protegidas
- [ ] **React Query Cache**: Limpo (confirmado por logs)

---

## 🐛 Troubleshooting

### Problema: localStorage ainda contém muitas chaves após logout

**Possíveis causas:**
1. Função `logout()` não foi executada corretamente
2. Erro JavaScript impediu a execução

**Solução:**
1. Verifique o console do DevTools para erros JavaScript
2. Verifique se os logs de limpeza aparecem no console
3. Verifique se o botão "Sair" está chamando `logout()` (verifique o código-fonte)

### Problema: Cookies ainda estão presentes após logout

**Possíveis causas:**
1. Cookie foi definido com `path=/` diferente
2. Cookie foi definido com domínio diferente
3. NextAuth não removeu o cookie corretamente

**Solução:**
1. Verifique o domínio do cookie (deve ser `.vibephoto.app` ou `vibephoto.app`)
2. Verifique se a data de expiração do cookie é no passado
3. Limpe manualmente os cookies no DevTools (clique com botão direito → Delete)

### Problema: Ainda consigo acessar rotas protegidas após logout

**Possíveis causas:**
1. Middleware não está bloqueando corretamente
2. Token ainda está válido no servidor

**Solução:**
1. Verifique o status da requisição na aba Network (deve ser 401)
2. Verifique o cabeçalho da resposta (deve conter erro de autenticação)
3. Limpe o cache do navegador (Ctrl + Shift + Delete)

### Problema: Não vejo logs de limpeza no console

**Possíveis causas:**
1. Logs foram filtrados
2. Função não foi executada

**Solução:**
1. No console do DevTools, verifique se há filtros ativos (remova todos os filtros)
2. Verifique se a função `logout()` está sendo chamada (adicione breakpoint no código)

---

## 📸 Capturas de Tela de Referência

### localStorage Antes do Logout
```
Local Storage → https://vibephoto.app
├── consent_preferences
├── edit_history
├── feedback_dismissals
└── [outras chaves]
```

### localStorage Depois do Logout (✅ Correto)
```
Local Storage → https://vibephoto.app
└── consent_preferences (ou ensaio_fotos_consent)
    [Apenas 1-2 chaves relacionadas a consentimentos]
```

### sessionStorage Depois do Logout (✅ Correto)
```
Session Storage → https://vibephoto.app
    [Vazio - "No items"]
```

### Cookies Depois do Logout (✅ Correto)
```
Cookies → https://vibephoto.app
    [Sem cookies next-auth.session-token ou com expiração no passado]
```

### Console Logs (✅ Correto)
```
🧹 Iniciando limpeza completa de cache e sessão...
  🗑️ Removendo localStorage: edit_history
  🗑️ Removendo localStorage: feedback_dismissals
  🗑️ sessionStorage limpo
  🗑️ Removendo cookie: theme_preference
  🗑️ React Query cache limpo
  🔐 Fazendo logout do NextAuth...
✅ Logout completo realizado com sucesso
```

---

## 🎯 Resultado Esperado

Após seguir todos os passos, você deve observar:

1. ✅ **localStorage** contém apenas consentimentos não sensíveis
2. ✅ **sessionStorage** está completamente vazio
3. ✅ **Cookies** de sessão foram removidos ou expirados
4. ✅ **Console** mostra logs de limpeza completos
5. ✅ **Rotas protegidas** são bloqueadas e redirecionam para login
6. ✅ **APIs** retornam 401 para requisições não autenticadas

---

## 💡 Dicas Extras

1. **Atualizar dados em tempo real**: No DevTools, após fazer logout, clique com botão direito em "Local Storage" → "Refresh" para atualizar os dados exibidos

2. **Limpar manualmente para teste**: Se quiser testar o comportamento após limpeza manual:
   - No DevTools → Application → Storage
   - Clique com botão direito em cada item → "Clear"
   - Isso simula uma limpeza completa

3. **Verificar Network Tab**: A aba Network mostra todas as requisições HTTP, incluindo as que retornam 401, ajudando a confirmar que o middleware está funcionando

4. **Preservar Console Logs**: Para não perder os logs ao navegar:
   - No console, clique no ícone de "Settings" (⚙️)
   - Marque "Preserve log" para manter os logs mesmo após navegação

---

## 📝 Conclusão

Após seguir este guia, você terá confirmado visualmente que:
- Todos os caches foram limpos corretamente
- As rotas protegidas estão bloqueadas após logout
- As APIs retornam 401 para tokens inválidos
- O sistema de logout está funcionando como esperado

Se algum item do checklist não passar, verifique a seção de Troubleshooting acima ou revise o código do hook `useLogout` para garantir que todas as limpezas estão sendo executadas.

