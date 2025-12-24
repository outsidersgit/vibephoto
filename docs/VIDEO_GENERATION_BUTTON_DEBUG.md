# Debug: Botão "Gerar Vídeo" Não Fica Ativo

## 🔴 Problema Reportado

O botão "Gerar Vídeo" não fica ativo mesmo após digitar o prompt.

---

## 🔍 Diagnóstico

### **Condicional do Botão**

```typescript
// src/components/generation/video-generation-interface.tsx (linha 587)

const canProcess = formData.prompt.trim() && !loading && canUseCredits && hasEnoughCredits
```

**O botão é ativado quando TODAS as condições são verdadeiras:**

1. ✅ `formData.prompt.trim()` - Prompt preenchido
2. ✅ `!loading` - Não está processando
3. ❓ `canUseCredits` - **Prop passado da página** (pode estar false)
4. ❓ `hasEnoughCredits` - **Usuário tem créditos suficientes**

---

## 🎯 Possíveis Causas

### **Causa 1: `canUseCredits` está `false`**

O prop `canUseCredits` vem de:

```typescript
// src/app/generate/page.tsx (linha 46-50)

const videoAffordability = await CreditManager.canUserAfford(userId, videoCreditsNeeded, userPlan)
const canUseVideoCredits = videoAffordability.canAfford

<VideoGenerationInterface
  canUseCredits={canUseVideoCredits}  // ← Passado aqui
/>
```

**Verificação do `CreditManager`:**
```typescript
// src/lib/credits/manager.ts (linha 170-185)

static async canUserAfford(userId: string, amount: number, _userPlan: Plan) {
  const currentCredits = await this.getUserCredits(userId)

  if (currentCredits < amount) {
    return {
      canAfford: false,
      reason: `Créditos insuficientes. Necessário: ${amount}, disponível: ${currentCredits}`
    }
  }

  return { canAfford: true }
}
```

**✅ CONFIRMADO: `CreditManager` NÃO verifica modelo treinado!**

### **Causa 2: Usuário não tem créditos suficientes**

```typescript
const videoCreditsNeeded = getVideoGenerationCost(5)  // Custo padrão de 5s
```

**Créditos necessários por duração:**
- 4 segundos: **60 créditos**
- 5 segundos: **80 créditos**
- 6 segundos: **100 créditos**
- 8 segundos: **120 créditos**

**Se usuário não tiver créditos:**
- `canUseCredits = false`
- Botão fica desabilitado

---

## 🔧 Solução Implementada

### **1. Logs de Debug Adicionados**

Adicionei logs detalhados para identificar qual condição está falhando:

```typescript
// src/components/generation/video-generation-interface.tsx (linha 589-603)

console.log('🎬 [VIDEO-BUTTON-DEBUG]', {
  hasPrompt: !!formData.prompt.trim(),
  loading,
  canUseCredits,
  hasEnoughCredits,
  requiredCredits,
  remainingCredits,
  canProcess,
  user: {
    creditsUsed: user.creditsUsed,
    creditsLimit: user.creditsLimit,
    creditsBalance: (user as any).creditsBalance
  }
})
```

### **2. Tipo Atualizado para Incluir `creditsBalance`**

```typescript
// src/components/generation/video-generation-interface.tsx (linha 16-24)

interface VideoGenerationInterfaceProps {
  user: {
    id: string
    plan: string
    creditsUsed: number
    creditsLimit: number
    creditsBalance?: number // ← Créditos comprados
  }
  canUseCredits: boolean
  sourceImageUrl?: string
}
```

### **3. Tab de Imagens Desabilitada (Sem Modelo)**

```typescript
// src/app/generate/page.tsx (linha 70-95)

{hasNoModels ? (
  <div
    className="flex-1 sm:flex-none py-3 sm:py-4 px-4 sm:px-6 text-xs sm:text-sm font-medium text-center text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50"
    title="Crie um modelo para gerar imagens"
  >
    Imagens
  </div>
) : (
  <a href="/generate" className="...">
    Imagens
  </a>
)}
```

---

## 🧪 Como Testar

### **Passo 1: Verificar Logs no Console**

1. Acesse `/generate?tab=video`
2. Digite um prompt
3. Abra o **Console do DevTools** (F12)
4. Procure por `🎬 [VIDEO-BUTTON-DEBUG]`

**Exemplo de log esperado:**
```javascript
🎬 [VIDEO-BUTTON-DEBUG] {
  hasPrompt: true,       // ✅ Prompt preenchido
  loading: false,        // ✅ Não está carregando
  canUseCredits: false,  // ❌ PROBLEMA AQUI!
  hasEnoughCredits: false, // ❌ Ou AQUI!
  requiredCredits: 120,  // 120 créditos necessários
  remainingCredits: 0,   // 0 créditos disponíveis
  canProcess: false,     // ❌ Botão desabilitado
  user: {
    creditsUsed: 500,
    creditsLimit: 500,
    creditsBalance: 0
  }
}
```

### **Passo 2: Verificar Créditos do Usuário**

```sql
-- Query no banco de dados
SELECT 
  id,
  email,
  plan,
  creditsUsed,
  creditsLimit,
  creditsBalance,
  creditsExpiresAt,
  (creditsLimit - creditsUsed + COALESCE(creditsBalance, 0)) as remainingCredits
FROM "users"
WHERE email = 'email-do-usuario@example.com';
```

### **Passo 3: Adicionar Créditos (Se Necessário)**

```sql
-- Adicionar créditos comprados
UPDATE "users"
SET creditsBalance = 500
WHERE email = 'email-do-usuario@example.com';
```

**OU resetar créditos do plano:**

```sql
-- Resetar créditos usados
UPDATE "users"
SET creditsUsed = 0, creditsExpiresAt = NOW() + INTERVAL '30 days'
WHERE email = 'email-do-usuario@example.com';
```

---

## 📊 Casos Comuns

### **Caso 1: Usuário Novo (STARTER)**

```
creditsLimit: 500
creditsUsed: 0
creditsBalance: 0
─────────────────────
remainingCredits: 500 ✅
videoCreditsNeeded: 120
canUseCredits: true ✅
```

**✅ Botão deve ficar ATIVO**

### **Caso 2: Usuário que Gastou Todos os Créditos**

```
creditsLimit: 500
creditsUsed: 500
creditsBalance: 0
─────────────────────
remainingCredits: 0 ❌
videoCreditsNeeded: 120
canUseCredits: false ❌
```

**❌ Botão fica DESABILITADO**

**Mensagem exibida:**
```
"Você precisa de 120 créditos, mas tem apenas 0"
```

### **Caso 3: Usuário com Créditos Comprados**

```
creditsLimit: 500
creditsUsed: 500
creditsBalance: 200  ← Comprou créditos
─────────────────────
remainingCredits: 200 ✅
videoCreditsNeeded: 120
canUseCredits: true ✅
```

**✅ Botão deve ficar ATIVO**

---

## ✅ Verificações Finais

- [ ] Tab de **Vídeos** está sempre visível e clicável
- [ ] Tab de **Imagens** está desabilitada quando sem modelo
- [ ] Mensagem na tab de imagens: "Criar meu modelo agora" + "Gerar vídeos com IA"
- [ ] Logs de debug aparecem no console ao digitar prompt
- [ ] `canUseCredits` é **true** quando usuário tem créditos
- [ ] **Nenhuma verificação de modelo** no `CreditManager`

---

## 📝 Arquivos Modificados

1. ✅ `src/components/generation/video-generation-interface.tsx`
   - Adicionado logs de debug
   - Atualizado tipo para incluir `creditsBalance`

2. ✅ `src/app/generate/page.tsx`
   - Tab de imagens desabilitada quando sem modelo
   - Tab de vídeos sempre ativa
   - Mensagem com duas ações na tab de imagens

3. ✅ `docs/VIDEO_GENERATION_BUTTON_DEBUG.md` (este arquivo)
   - Documentação de debug e solução

---

**Data**: 24/12/2025  
**Status**: ✅ Implementado - Aguardando Logs do Usuário

