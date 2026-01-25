# Correção: Custo Hardcoded no Webhook Replicate

## Data: 25 de Janeiro de 2026

---

## Problema Identificado

O webhook do Replicate estava salvando **15 créditos hardcoded** no campo `metadata.cost` ao processar edições de imagem, resultando em **custos incorretos** exibidos nos detalhes da foto na galeria.

### Sintoma
- Usuário reportou que o custo exibido nos detalhes da foto estava errado
- O campo estava mostrando 15 créditos, independentemente da resolução usada

### Causa Raiz
**Arquivo:** `src/app/api/webhooks/replicate/route.ts` (linhas 1139, 1163, 1166)

```typescript
// ❌ ANTES - Valor hardcoded errado
metadata: {
  source: 'editor',
  editHistoryId: editHistory.id,
  operation: editHistory.operation,
  webhook: true,
  cost: 15,  // ← HARDCODED! Sempre 15 créditos
  processedVia: 'webhook'
},
estimatedCost: 15,  // ← HARDCODED! Sempre 15 créditos
```

---

## Custos Corretos

**Arquivo:** `src/lib/credits/pricing.ts`

```typescript
export const CREDIT_COSTS = {
  IMAGE_GENERATION_PER_OUTPUT: 10,
  IMAGE_EDIT_PER_IMAGE: 20,      // ← Custo correto para edição padrão
  IMAGE_EDIT_4K_PER_IMAGE: 30,   // ← Custo correto para edição 4K
  // ...
}
```

### Tabela de Custos

| Operação | Resolução | Custo Correto |
|----------|-----------|---------------|
| Edição de Imagem | Standard (2K) | **20 créditos** |
| Edição de Imagem | 4K | **30 créditos** |
| ❌ Valor hardcoded | Qualquer | 15 créditos (ERRADO!) |

---

## Solução Implementada

### A. Usar `editHistory.creditsUsed`

O `EditHistory` já armazena o custo correto no campo `creditsUsed`, que é definido quando a edição é criada (baseado na resolução escolhida pelo usuário).

**Arquivo:** `src/app/api/image-editor/edit/route.ts` (linhas 308, 445)

```typescript
// ✅ Custo correto já está sendo salvo no EditHistory
creditsUsed: creditsNeeded  // 20 para standard, 30 para 4K
```

### B. Atualizar Webhook para Usar Valor Correto

**Arquivo:** `src/app/api/webhooks/replicate/route.ts` (linhas ~1124-1172)

```typescript
// ✅ DEPOIS - Usar o custo correto do EditHistory
if (existingPlaceholder) {
  console.log(`🔄 Updating existing placeholder generation: ${existingPlaceholder.id}`)
  
  // Use the creditsUsed from editHistory (which already has the correct cost based on resolution)
  const actualCost = editHistory.creditsUsed || 20 // Fallback to 20 if not set
  
  await prisma.generation.update({
    where: { id: existingPlaceholder.id },
    data: {
      imageUrls: [permanentUrl],
      thumbnailUrls: [thumbnailUrl],
      status: 'COMPLETED',
      jobId: payload.id,
      operationType: 'edit',
      metadata: {
        source: 'editor',
        editHistoryId: editHistory.id,
        operation: editHistory.operation,
        webhook: true,
        cost: actualCost,  // ← DINÂMICO! Usa o valor correto
        processedVia: 'webhook'
      },
      completedAt: new Date()
    }
  })
  finalGenerationId = existingPlaceholder.id
} else {
  console.log(`⚠️ No placeholder found, creating new generation record`)
  
  // Use the creditsUsed from editHistory (which already has the correct cost based on resolution)
  const actualCost = editHistory.creditsUsed || 20 // Fallback to 20 if not set
  
  const newGeneration = await prisma.generation.create({
    data: {
      userId: editHistory.userId,
      modelId: editHistory.metadata?.defaultModelId || null,
      prompt: editHistory.prompt,
      imageUrls: [permanentUrl],
      thumbnailUrls: [thumbnailUrl],
      status: 'COMPLETED',
      jobId: payload.id,
      operationType: 'edit',
      metadata: {
        source: 'editor',
        editHistoryId: editHistory.id,
        operation: editHistory.operation,
        webhook: true,
        cost: actualCost,  // ← DINÂMICO! Usa o valor correto
        processedVia: 'webhook'
      },
      estimatedCost: actualCost,  // ← DINÂMICO! Usa o valor correto
      aiProvider: 'hybrid',
      completedAt: new Date()
    }
  })
  finalGenerationId = newGeneration.id
}
```

---

## Fluxo de Dados Correto

```
┌─────────────────────────────────────────────────┐
│ 1. Usuário escolhe resolução no Editor         │
│    - Standard (2K) → 20 créditos               │
│    - 4K → 30 créditos                          │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 2. API /api/image-editor/edit                  │
│    - Calcula custo baseado em resolução        │
│    - Salva em EditHistory.creditsUsed          │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 3. Webhook Replicate recebe resultado          │
│    - Busca EditHistory                         │
│    - Usa editHistory.creditsUsed               │
│    - Salva em generation.metadata.cost         │
│    - Salva em generation.estimatedCost         │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 4. Galeria exibe custo correto                 │
│    - gallery-cost.ts lê metadata.cost          │
│    - Exibe "20 créditos" ou "30 créditos"     │
└─────────────────────────────────────────────────┘
```

---

## Validação

### Antes da Correção
```typescript
// Edição Standard (deveria ser 20)
metadata.cost = 15  // ❌ ERRADO
estimatedCost = 15  // ❌ ERRADO

// Edição 4K (deveria ser 30)
metadata.cost = 15  // ❌ ERRADO
estimatedCost = 15  // ❌ ERRADO
```

### Depois da Correção
```typescript
// Edição Standard (correto)
editHistory.creditsUsed = 20
metadata.cost = 20  // ✅ CORRETO
estimatedCost = 20  // ✅ CORRETO

// Edição 4K (correto)
editHistory.creditsUsed = 30
metadata.cost = 30  // ✅ CORRETO
estimatedCost = 30  // ✅ CORRETO
```

---

## Impacto

### ✅ Positivo
- **Custos corretos** exibidos na galeria
- **Transparência** para o usuário sobre créditos consumidos
- **Consistência** entre custo cobrado e custo exibido
- **Flexibilidade** para adicionar novas resoluções no futuro

### ⚠️ Observação
- Gerações antigas (antes desta correção) continuarão com o valor de 15 créditos
- Novas gerações usarão o custo correto (20 ou 30 créditos)

---

## Como Testar

### 1. Edição Standard (2K)
```bash
1. Acesse /image-editor
2. Faça upload de uma imagem
3. Escolha resolução "Standard"
4. Gere a edição (consumirá 20 créditos)
5. Aguarde o webhook processar
6. Vá para /gallery
7. Abra os detalhes da imagem
8. ✅ Verificar: Custo exibido = "20 créditos"
```

### 2. Edição 4K
```bash
1. Acesse /image-editor
2. Faça upload de uma imagem
3. Escolha resolução "4K"
4. Gere a edição (consumirá 30 créditos)
5. Aguarde o webhook processar
6. Vá para /gallery
7. Abra os detalhes da imagem
8. ✅ Verificar: Custo exibido = "30 créditos"
```

### 3. Verificação no Banco de Dados
```sql
-- Verificar gerações recentes
SELECT 
  id,
  operationType,
  estimatedCost,
  metadata->>'cost' as metadata_cost,
  createdAt
FROM "Generation"
WHERE operationType = 'edit'
  AND createdAt > NOW() - INTERVAL '1 hour'
ORDER BY createdAt DESC
LIMIT 10;

-- Resultado esperado:
-- Standard: estimatedCost = 20, metadata_cost = '20'
-- 4K: estimatedCost = 30, metadata_cost = '30'
```

---

## Arquivos Modificados

1. **`src/app/api/webhooks/replicate/route.ts`**
   - Linha ~1139: Removido `cost: 15` hardcoded
   - Linha ~1163: Removido `cost: 15` hardcoded
   - Linha ~1166: Removido `estimatedCost: 15` hardcoded
   - Adicionado `const actualCost = editHistory.creditsUsed || 20`
   - Atualizado para usar `cost: actualCost` e `estimatedCost: actualCost`

---

## Logs de Debug

Para facilitar troubleshooting futuro, os logs existentes já mostram:

```typescript
console.log(`🎨 [WEBHOOK] Edit ID: ${editHistory.id}`)
// Adicionar log do custo (opcional):
console.log(`💰 [WEBHOOK] Credits used: ${editHistory.creditsUsed}`)
```

---

## Resumo

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Valor no metadata.cost | 15 (hardcoded) | 20 ou 30 (dinâmico) |
| Valor no estimatedCost | 15 (hardcoded) | 20 ou 30 (dinâmico) |
| Fonte do valor | Hardcoded | editHistory.creditsUsed |
| Custo exibido na galeria | Errado (15) | Correto (20 ou 30) |
| Consistência | ❌ Inconsistente | ✅ Consistente |

---

**Correção implementada por:** Claude (Cursor AI)  
**Data:** 25 de Janeiro de 2026
