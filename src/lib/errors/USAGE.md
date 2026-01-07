# Sistema de Tratamento de Erros - Guia de Uso

## ✅ Como usar (CORRETO)

### Exemplo 1: Geração de imagem
```typescript
import { notifyError, notifySuccess } from '@/lib/errors'

async function handleGenerate() {
  try {
    const response = await fetch('/api/generate', { method: 'POST', body: ... })

    if (!response.ok) {
      const error = await response.json()
      throw error
    }

    notifySuccess('Imagem gerada!', 'Sua imagem está pronta')
  } catch (error) {
    notifyError(error, 'IMAGE_GENERATION') // ← Sistema traduz automaticamente
  }
}
```

### Exemplo 2: Erro de créditos
```typescript
try {
  await buyPackage(packageId)
} catch (error) {
  // Se for erro de créditos, sistema mostra modal + toast automaticamente
  notifyError(error, 'CREDIT_PURCHASE')
}
```

### Exemplo 3: Erro de validação
```typescript
try {
  const data = schema.parse(formData)
} catch (error) {
  // Traduz "Expected pattern..." para mensagem amigável
  notifyError(error, 'FORM_VALIDATION')
}
```

---

## ❌ NÃO fazer (ERRADO)

```typescript
// ❌ NUNCA exibir error.message cru
toast({
  title: 'Erro',
  description: error.message, // ← ERRADO!
  type: 'error'
})

// ❌ NUNCA usar addToast diretamente para erros
addToast({
  title: 'Erro',
  description: response.error, // ← ERRADO!
  type: 'error'
})

// ❌ NUNCA criar mensagens genéricas manualmente
catch (error) {
  toast({ title: 'Algo deu errado' }) // ← ERRADO! Use notifyError
}
```

---

## 📋 Mensagens que serão exibidas

| Erro Original | Mensagem Amigável |
|--------------|-------------------|
| `"The string did not match the expected pattern."` | "Algum dado foi preenchido em formato inválido. Revise e tente novamente." |
| `"Insufficient credits"` | "Você não tem créditos suficientes para esta ação." |
| `"Content moderation failed"` | "Não foi possível gerar por causa das diretrizes de conteúdo. Ajuste o prompt." |
| `"Network timeout"` | "Falha de conexão. Verifique sua internet e tente novamente." |
| `"Unauthorized"` | "Sua sessão expirou. Por favor, faça login novamente." |
| `"Generation failed"` | "A geração falhou e seus créditos não foram cobrados. Tente novamente." |
| Erro desconhecido | "Algo deu errado. Tente novamente em instantes." |

---

## ⏱️ Durações dos Toasts

| Severidade | Duração | Exemplo |
|------------|---------|---------|
| `low` | 5s | Erro de validação |
| `high` | 8s | Erro de geração |
| `critical` | 8s + modal | Erro de crédito, autenticação |

---

## 🔍 Logs Internos

O sistema loga automaticamente todos os erros no console:

```
🔴 [CRITICAL ERROR] {
  context: 'IMAGE_GENERATION',
  severity: 'critical',
  userMessage: 'A geração falhou...',
  debugMeta: {
    originalMessage: 'Generation failed: timeout',
    statusCode: 500,
    errorCode: 'TIMEOUT'
  }
}
```

Isso permite debugging sem expor mensagens técnicas ao usuário.

---

## 🎯 Migração de Código Existente

### Antes:
```typescript
catch (error) {
  addToast({
    title: 'Erro',
    description: error.message,
    type: 'error'
  })
}
```

### Depois:
```typescript
catch (error) {
  notifyError(error, 'FEATURE_NAME')
}
```

---

## 🚀 Próximos Passos

1. ✅ Sistema criado e configurado
2. ⏳ Migrar componentes principais (geração, editor, créditos)
3. ⏳ Adicionar modal persistente para erros críticos
4. ⏳ Integrar com Sentry para monitoring
