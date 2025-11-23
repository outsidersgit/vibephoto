# 🐛 Correção: Erro `Cannot read properties of undefined (reading '5')`

## 📋 Problema

Erro crítico ao verificar status de vídeos em processamento:

```
❌ Failed to get video status: TypeError: Cannot read properties of undefined (reading '5')
    at h.getEstimatedTime (.next/server/app/api/video/status/[id]/route.js:1:21764)
    at h.getVideoStatus (.next/server/app/api/video/status/[id]/route.js:1:19984)
```

**Contexto:**
- Ocorria quando o frontend fazia polling do status do vídeo (`/api/video/status/[id]`)
- Provider chamava `getEstimatedTime()` para calcular tempo restante
- Função tentava acessar `VIDEO_CONFIG.estimatedTimes['standard'][5]`
- Mas `VIDEO_CONFIG.estimatedTimes['standard']` = `undefined` ❌
- Resultado: `undefined[5]` = **CRASH**

---

## 🔍 Causa Raiz

### ❌ **Código com Bug:**

```typescript
// src/lib/ai/providers/kling.ts (linha 387-392)
private getEstimatedTime(duration: number, quality: string): number {
  const qualityKey = quality === 'pro' ? 'pro' : 'standard'  // ❌ ERRADO!
  const durationKey = duration === 10 ? 10 : 5
  
  return VIDEO_CONFIG.estimatedTimes[qualityKey][durationKey]
  // VIDEO_CONFIG.estimatedTimes['standard'] = undefined
  // undefined[5] = CRASH!
}
```

### ✅ **Estrutura Real do VIDEO_CONFIG:**

```typescript
// src/lib/ai/video/config.ts (linha 64-75)
estimatedTimes: {
  '720p': {    // ✅ CHAVE CORRETA: resolução, não quality!
    4: 60,
    6: 90,
    8: 120
  },
  '1080p': {   // ✅ CHAVE CORRETA: resolução, não quality!
    4: 120,
    6: 180,
    8: 240
  }
  // ❌ NÃO EXISTE: 'standard' ou 'pro'
}
```

**O problema:**
- Função usava `'standard'` e `'pro'` como chaves
- Mas `VIDEO_CONFIG.estimatedTimes` usa `'720p'` e `'1080p'`
- Mismatch de chaves → `undefined` → crash

---

## ✅ Solução Implementada

### **Mapeamento Correto: quality → resolution**

```typescript
// src/lib/ai/providers/kling.ts (linha 385-400)
/**
 * Get estimated processing time
 * @param duration - Video duration in seconds (4, 6, or 8)
 * @param quality - Quality setting (maps to resolution: 'standard' = 720p, 'pro' = 1080p)
 */
private getEstimatedTime(duration: number, quality: string): number {
  // 🔒 CRITICAL FIX: Map quality to resolution
  // quality='standard' → '720p', quality='pro' → '1080p'
  const resolutionKey = quality === 'pro' ? '1080p' : '720p'
  
  // Ensure duration is valid (4, 6, or 8), fallback to 8
  const validDuration = [4, 6, 8].includes(duration) ? duration : 8
  
  // Safely access estimatedTimes with proper type casting
  const times = VIDEO_CONFIG.estimatedTimes[resolutionKey as '720p' | '1080p']
  return times[validDuration as 4 | 6 | 8]
}
```

### **Melhorias Adicionais:**

1. ✅ **Validação de duration:**
   - Antes: assumia `5` ou `10` (valores inválidos!)
   - Depois: valida se é `4`, `6`, ou `8`, fallback para `8`

2. ✅ **Type safety:**
   - Usa type casting explícito: `'720p' | '1080p'` e `4 | 6 | 8`
   - TypeScript previne erros futuros

3. ✅ **Documentação:**
   - JSDoc explica o mapeamento `quality → resolution`
   - Comentários críticos marcados com 🔒 CRITICAL FIX

---

## 📊 Comportamento Antes vs Depois

### ❌ **Antes:**

```typescript
getEstimatedTime(5, 'standard')
// qualityKey = 'standard'
// durationKey = 5
// VIDEO_CONFIG.estimatedTimes['standard'] = undefined
// undefined[5] = CRASH! ❌
```

### ✅ **Depois:**

```typescript
getEstimatedTime(5, 'standard')
// resolutionKey = '720p' (mapped from 'standard')
// validDuration = 8 (fallback, 5 is invalid)
// VIDEO_CONFIG.estimatedTimes['720p'][8] = 120 ✅
// return 120 (2 minutos estimados)
```

---

## 🧪 Casos de Teste

### **Caso 1: quality='standard', duration=6**
```typescript
getEstimatedTime(6, 'standard')
// resolutionKey = '720p'
// validDuration = 6
// return VIDEO_CONFIG.estimatedTimes['720p'][6] = 90 ✅
```

### **Caso 2: quality='pro', duration=8**
```typescript
getEstimatedTime(8, 'pro')
// resolutionKey = '1080p'
// validDuration = 8
// return VIDEO_CONFIG.estimatedTimes['1080p'][8] = 240 ✅
```

### **Caso 3: quality='invalid', duration=999**
```typescript
getEstimatedTime(999, 'invalid')
// resolutionKey = '720p' (fallback)
// validDuration = 8 (fallback)
// return VIDEO_CONFIG.estimatedTimes['720p'][8] = 120 ✅
```

---

## 🔧 Arquivos Modificados

1. ✅ `src/lib/ai/providers/kling.ts` - Função `getEstimatedTime()` corrigida
2. ✅ `src/lib/ai/providers/veo.ts` - Função `getEstimatedTime()` corrigida (mesmo bug)
3. ✅ `docs/VIDEO_ESTIMATED_TIME_FIX.md` - Esta documentação

---

## 🚀 Impacto

### **Antes da Correção:**
- ❌ Erro no console do Vercel a cada 2 segundos (polling)
- ❌ Frontend não recebia progresso estimado
- ❌ Experiência ruim para o usuário

### **Depois da Correção:**
- ✅ Polling funciona sem erros
- ✅ Frontend exibe tempo estimado correto
- ✅ Melhor UX durante processamento

---

## 📚 Lições Aprendidas

1. **Consistência de nomes:** Se a config usa `'720p'`/`'1080p'`, todos os métodos devem usar o mesmo padrão
2. **Validação de entrada:** Sempre validar valores antes de usar como chave de objeto
3. **Type safety:** TypeScript literal types (`'720p' | '1080p'`) previnem erros
4. **Fallbacks:** Sempre ter valores padrão para entradas inválidas

---

## ✅ Checklist de Verificação

- [x] Bug identificado e causa raiz documentada
- [x] Correção implementada em Kling provider
- [x] Correção implementada em Veo provider
- [x] Validação de duration adicionada
- [x] Type safety melhorado
- [x] Documentação completa criada
- [x] Casos de teste documentados
- [x] Nenhum linter error

---

## 🔗 Relacionado

- `docs/VIDEO_STORAGE_FIX.md` - Correção de storage e thumbnails
- `src/lib/ai/video/config.ts` - Configuração central de vídeos

