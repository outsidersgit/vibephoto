# Sistema de Error Logging Client-Side para Safari/iOS

## 🔴 Problema Identificado

**Erro**: "The string did not match the expected pattern"
**Contexto**: Erro ocorre apenas no dispositivo de um usuário específico (iPhone/Safari)
**Impacto**: Usuário não consegue gerar fotos, erro acontece antes de enviar para servidor

### Causas Possíveis

1. **Validação HTML5 Pattern**: Safari pode ter comportamento diferente com atributos `pattern` em inputs
2. **Caracteres de Controle**: Safari/iOS pode rejeitar caracteres invisíveis (ASCII 0-31)
3. **Emojis e Unicode**: Comportamento diferente entre navegadores com caracteres especiais
4. **FormData Encoding**: Safari pode encodar dados de forma diferente
5. **Regex em JavaScript**: Diferenças na engine regex do Safari vs Chrome

---

## ✅ Solução Implementada

### Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────┐
│          Client-Side (Browser)                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  1. ErrorLoggerProvider (Global Handler)           │
│     └─> Captura erros não tratados                 │
│     └─> window.onerror, unhandledrejection         │
│                                                     │
│  2. SafeTextarea (Validação Defensiva)             │
│     └─> Remove caracteres de controle              │
│     └─> Sanitização específica Safari/iOS          │
│     └─> Notifica usuário se houver sanitização     │
│                                                     │
│  3. useImageGeneration (Hook com Logging)          │
│     └─> Detecta navegador e versão                 │
│     └─> Valida dados antes de enviar               │
│     └─> Captura erros específicos (pattern)        │
│     └─> Envia logs para servidor                   │
│                                                     │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ fetch('/api/logs/client-error')
                   │
┌──────────────────▼──────────────────────────────────┐
│          Server-Side (API)                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  POST /api/logs/client-error                       │
│     └─> Recebe erro do client                      │
│     └─> Salva no banco de dados (SystemLog)        │
│     └─> Logs detalhados no console do servidor     │
│     └─> Identifica navegador e device              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📁 Arquivos Criados/Modificados

### 1. **Sistema de Logging** (NOVO)

#### [`src/app/api/logs/client-error/route.ts`](src/app/api/logs/client-error/route.ts)
- Endpoint para receber erros do client
- Salva no banco (SystemLog)
- Logs detalhados no servidor
- Detecta navegador e device

#### [`src/lib/client-logger.ts`](src/lib/client-logger.ts)
- `logClientError()`: Envia erro para servidor
- `setupGlobalErrorHandler()`: Captura erros globais
- `validateAndSanitize()`: Validação defensiva
- `detectBrowser()`: Detecta navegador e versão
- `testBrowserCompatibility()`: Testa features

#### [`src/components/providers/error-logger-provider.tsx`](src/components/providers/error-logger-provider.tsx)
- Provider React para setup global
- Configura handlers no mount

---

### 2. **Validação Defensiva** (NOVO)

#### [`src/components/ui/safe-textarea.tsx`](src/components/ui/safe-textarea.tsx)
- Textarea com sanitização cross-browser
- Remove caracteres de controle (ASCII 0-31)
- Comportamento específico Safari/iOS
- Notifica usuário se sanitizar
- Remove `pattern` attribute no Safari

---

### 3. **Integração** (MODIFICADO)

#### [`src/app/layout.tsx`](src/app/layout.tsx)
- ✅ Adicionado `ErrorLoggerProvider`
- Captura erros globalmente

#### [`src/hooks/useImageGeneration.ts`](src/hooks/useImageGeneration.ts)
- ✅ Detecta navegador antes de enviar
- ✅ Valida e sanitiza dados
- ✅ Captura erro "pattern" específico
- ✅ Envia logs detalhados

#### [`src/components/generation/prompt-input.tsx`](src/components/generation/prompt-input.tsx)
- ✅ Substituído `<textarea>` por `<SafeTextarea>`
- ✅ Handler para notificar sanitização
- ✅ Toast informativo ao usuário

---

## 🔧 Como Usar

### Logging Manual

```typescript
import { logClientError } from '@/lib/client-logger'

try {
  // Código que pode falhar
} catch (error) {
  logClientError(error, {
    context: 'meu-componente',
    additionalInfo: 'dados extras'
  })
}
```

### Validação Defensiva

```typescript
import { validateAndSanitize } from '@/lib/client-logger'

const validation = validateAndSanitize(data, 'meu-contexto')

if (!validation.valid) {
  console.error(validation.error)
  return
}

// Usar validation.data (pode ter sido sanitizado)
const cleanData = validation.data
```

### SafeTextarea

```typescript
import { SafeTextarea } from '@/components/ui/safe-textarea'

<SafeTextarea
  value={value}
  onChange={(e) => setValue(e.target.value)}
  onSanitizedChange={(value, wasSanitized) => {
    if (wasSanitized) {
      alert('Caracteres removidos para compatibilidade')
    }
  }}
/>
```

---

## 📊 Monitoramento

### Ver Logs no Banco de Dados

```sql
-- Ver erros do client nas últimas 24h
SELECT
  id,
  "userId",
  action,
  status,
  details->>'errorType' as error_type,
  details->>'errorMessage' as error_message,
  details->>'browser' as browser,
  details->>'device' as device,
  details->>'url' as url,
  "createdAt"
FROM "system_logs"
WHERE action = 'CLIENT_ERROR'
  AND "createdAt" > NOW() - INTERVAL '24 hours'
ORDER BY "createdAt" DESC;

-- Ver erros de pattern específicos
SELECT *
FROM "system_logs"
WHERE action = 'CLIENT_ERROR'
  AND details->>'errorType' = 'PATTERN_VALIDATION_ERROR'
ORDER BY "createdAt" DESC;

-- Ver erros por navegador
SELECT
  details->>'browser' as browser,
  COUNT(*) as error_count,
  array_agg(DISTINCT details->>'errorType') as error_types
FROM "system_logs"
WHERE action = 'CLIENT_ERROR'
  AND "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY details->>'browser'
ORDER BY error_count DESC;
```

### Logs no Console do Servidor (Vercel)

Procure por:
```
🔴 [CLIENT_ERROR] ===== CLIENT-SIDE ERROR RECEIVED =====
```

---

## 🧪 Como Testar

### 1. Testar Sanitização no Safari

No Safari/iOS, tente colar texto com caracteres invisíveis:

```javascript
// No console do browser
const textarea = document.getElementById('prompt')
textarea.value = 'Teste\x00com\x01caracteres\x02invisíveis'
textarea.dispatchEvent(new Event('change', { bubbles: true }))
```

Você deve ver:
- ⚠️ Toast: "Texto ajustado"
- 📝 Console: "Removed control characters for Safari compatibility"
- 📡 Log enviado para servidor

### 2. Testar Erro Global

```javascript
// No console do browser
throw new Error('Teste de erro global')
```

Verifique:
- 📡 Log aparece no servidor
- 💾 Registro criado no banco

### 3. Testar Erro de Pattern

```javascript
// Simular erro de pattern
const error = new Error('The string did not match the expected pattern')
logClientError(error, { test: true })
```

Verifique:
- 🔴 Log com `safariIssue: true`
- 📊 Detalhes do browser incluídos

---

## 🎯 O Que Esperar

### Antes do Fix
❌ Erro ocorre silenciosamente no Safari
❌ Sem logs no servidor
❌ Impossível diagnosticar remotamente
❌ Usuário não recebe feedback

### Depois do Fix
✅ Erros são capturados e enviados para servidor
✅ Logs detalhados com navegador e device
✅ Sanitização automática de caracteres problemáticos
✅ Usuário recebe feedback se texto for ajustado
✅ Possível analisar padrões de erro por navegador

---

## 🔍 Debugging

### Se o usuário ainda tiver erro:

1. **Verificar logs no servidor**
   ```bash
   # Vercel CLI
   vercel logs --production
   ```

2. **Query no banco**
   ```sql
   SELECT * FROM "system_logs"
   WHERE "userId" = '{user_id}'
   AND action = 'CLIENT_ERROR'
   ORDER BY "createdAt" DESC
   LIMIT 10;
   ```

3. **Pedir ao usuário para testar**
   ```
   1. Abra o console do navegador (F12)
   2. Cole:
      import { testBrowserCompatibility } from '@/lib/client-logger'
      console.log(testBrowserCompatibility())
   3. Envie screenshot do resultado
   ```

---

## 🚀 Próximos Passos

### Se o erro persistir:

1. **Adicionar mais sanitização**
   - Emojis específicos
   - Caracteres Unicode problemáticos
   - Sequences de escape

2. **Criar dashboard de monitoramento**
   - Gráfico de erros por navegador
   - Top 10 erros mais comuns
   - Alertas automáticos

3. **A/B Testing**
   - Testar diferentes validações
   - Comparar taxa de erro Safari vs Chrome

4. **Feature Detection**
   - Detectar features não suportadas
   - Mostrar mensagem específica no Safari

---

## 📞 Suporte

Se encontrar novos erros:

1. Verificar logs: `POST /api/logs/client-error`
2. Query banco: `action = 'CLIENT_ERROR'`
3. Analisar padrão: navegador, device, erro
4. Ajustar sanitização: `src/lib/client-logger.ts`
5. Adicionar caso especial: `src/components/ui/safe-textarea.tsx`

---

## ✅ Checklist de Deploy

- [x] API endpoint criado: `/api/logs/client-error`
- [x] Utility de logging criado: `client-logger.ts`
- [x] Provider global adicionado: `ErrorLoggerProvider`
- [x] SafeTextarea criado e integrado
- [x] Hook de geração atualizado com logging
- [x] Layout atualizado com provider
- [ ] Testar em Safari/iOS local (se possível)
- [ ] Deploy em staging
- [ ] Pedir usuário testar novamente
- [ ] Monitorar logs por 24-48h
- [ ] Analisar padrões de erro
- [ ] Ajustar sanitização se necessário

---

## 🎯 Resultado Esperado

Após deploy, quando o usuário tentar gerar foto no Safari/iPhone:

1. **Se houver caracteres problemáticos**:
   - ✅ Serão removidos automaticamente
   - ✅ Usuário verá toast informativo
   - ✅ Geração funcionará normalmente

2. **Se ainda houver erro**:
   - ✅ Erro será capturado
   - ✅ Log completo enviado para servidor
   - ✅ Poderemos ver exatamente o que causou
   - ✅ Teremos dados para fix definitivo

**Prioridade**: 🟡 MÉDIO-ALTO - Sistema de debugging para caso raro mas crítico
