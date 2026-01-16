# Fluxo de Autenticação OAuth (Google/GitHub)

## Cenário: Signin OAuth com e-mail NÃO existente no DB

### Passo a passo:

1. **Usuário clica em "Entrar com Google/GitHub"**
   - Redireciona para o provedor OAuth (Google/GitHub)
   - Usuário autoriza o app

2. **PrismaAdapter cria o User automaticamente** (comportamento padrão do NextAuth)
   - PrismaAdapter detecta que o e-mail não existe no DB
   - Cria automaticamente um novo registro na tabela `users` com:
     - `id`: gerado automaticamente (cuid)
     - `email`: do provedor OAuth
     - `name`: do provedor OAuth (se disponível)
     - `role`: `USER` (default do schema)
     - `subscriptionStatus`: `null` (nullable, sem assinatura)
     - `creditsLimit`: `0` (default)
     - `creditsUsed`: `0` (default)
     - `creditsBalance`: `0` (default)
     - `plan`: `null` (sem plano)

3. **Callback `signIn` é executado**
   - Aguarda 100ms para garantir que o PrismaAdapter finalizou a criação
   - Busca o usuário no DB pelo e-mail
   - Define `user.id` = ID do DB
   - Define `user.subscriptionStatus` = `null` (novo usuário)
   - Define `user.role` = `USER` (padrão)
   - Cria registro na tabela `accounts` vinculando OAuth ao User

4. **Callback `redirect` é executado**
   - Redireciona para `/auth/callback?callbackUrl=/`

5. **Página `/auth/callback`**
   - Aguarda sessão ser autenticada
   - Verifica `role`:
     - Se `role === 'ADMIN'` → redireciona para `/admin`
     - Se `role === 'USER'` → continua
   - Verifica `subscriptionStatus`:
     - Se `subscriptionStatus !== 'ACTIVE'` → redireciona para `/pricing?newuser=true`
     - Se `subscriptionStatus === 'ACTIVE'` → redireciona para home (`/`)

**Resultado final**: Novo usuário → `/pricing?newuser=true`

---

## Cenário: Signin OAuth com e-mail JÁ existente no DB

### Passo a passo:

1. **Usuário clica em "Entrar com Google/GitHub"**
   - Redireciona para o provedor OAuth
   - Usuário autoriza o app

2. **PrismaAdapter encontra o User existente**
   - Busca na tabela `users` pelo e-mail
   - Usa o usuário existente (não cria novo)

3. **Callback `signIn` é executado**
   - Busca o usuário no DB pelo e-mail
   - Define `user.id` = ID existente
   - Define `user.subscriptionStatus` = valor do DB
   - Define `user.role` = valor do DB
   - Cria registro na tabela `accounts` se ainda não existir

4. **Callback `redirect` é executado**
   - Redireciona para `/auth/callback?callbackUrl=/`

5. **Página `/auth/callback`**
   - Verifica `role`:
     - Se `role === 'ADMIN'` → redireciona para `/admin`
     - Se `role === 'USER'` → continua
   - Verifica `subscriptionStatus`:
     - Se `subscriptionStatus !== 'ACTIVE'` → redireciona para `/pricing`
     - Se `subscriptionStatus === 'ACTIVE'` → redireciona para home (`/`)

**Resultado final**: 
- Usuário sem assinatura → `/pricing`
- Usuário com assinatura ativa → `/`
- Admin → `/admin`

---

## Importante

- **PrismaAdapter é automático**: Não precisa criar o usuário manualmente quando faz login OAuth
- **Sem duplicação**: Se o e-mail já existe, o PrismaAdapter reutiliza o usuário existente
- **Novos usuários sempre vão para `/pricing`**: São direcionados a escolher um plano
- **Admin sempre vai para `/admin`**: Independente do `subscriptionStatus`

