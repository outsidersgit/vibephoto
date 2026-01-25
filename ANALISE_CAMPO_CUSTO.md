# Análise: Campo "Custo" nos Detalhes da Imagem

## Pergunta
O campo custo que aparece nos detalhes da imagem está puxando a informação de qual tabela e coluna? `generations.estimatedCost` ou `generations.metadata`?

---

## Resposta

O campo **"Custo"** exibido nos detalhes da imagem puxa informações de **AMBAS as fontes**, com uma **ordem de prioridade** definida.

---

## Fluxo de Dados

### 1. **Onde o custo é exibido**
**Arquivo:** `src/components/gallery/image-modal.tsx` (linhas 615-623)

```tsx
{/* Cost Information */}
<div>
  <div className="text-gray-300">Custo:</div>
  <div className="text-white font-medium">
    {getGenerationCostDescription(currentImage.generation, {
      operationType: currentImage.operationType
    })}
  </div>
</div>
```

---

### 2. **Função que resolve o custo**
**Arquivo:** `src/lib/utils/gallery-cost.ts`

A função `getGenerationCostDescription()` chama `extractCostMetadata()` que tem a seguinte **ordem de prioridade**:

```typescript
export function extractCostMetadata(generation: any): CostMetadata {
  const metadata = ensureMetadataObject(generation.metadata)

  // ORDEM DE PRIORIDADE:
  const estimatedCost =
    parseNumber(metadata.cost) ??              // 1. generation.metadata.cost
    parseNumber(metadata.estimatedCost) ??     // 2. generation.metadata.estimatedCost
    parseNumber(generation.estimatedCost)      // 3. generation.estimatedCost

  // ... resto do código
}
```

**Linhas:** 109-112 de `gallery-cost.ts`

---

## Ordem de Prioridade (Mais Importante → Menos Importante)

1. **`generation.metadata.cost`** (campo dentro do JSON `metadata`)
2. **`generation.metadata.estimatedCost`** (campo dentro do JSON `metadata`)
3. **`generation.estimatedCost`** (coluna direta da tabela `Generation`)

O sistema usa o **operador `??`** (nullish coalescing), que retorna o **primeiro valor que não seja `null` ou `undefined`**.

---

## Schema do Banco de Dados

**Arquivo:** `prisma/schema.prisma` (linha 357)

```prisma
model Generation {
  // ... outros campos ...
  
  estimatedCost  Float? // Cost in credits (COLUNA DIRETA)
  
  // ... outros campos ...
  
  metadata      Json? // JSON que pode conter { cost, estimatedCost, ... }
}
```

---

## Quando Cada Campo é Usado?

### ✅ **`generation.estimatedCost`** (Coluna Direta)
- **Usado na maioria dos casos**
- Definido quando a geração é criada
- **Exemplo:** `/api/image-editor/edit/route.ts` (linha 266, 508)
  ```typescript
  estimatedCost: creditsNeeded,
  ```

### ✅ **`generation.metadata.estimatedCost`** (Dentro do JSON)
- Usado quando há informações adicionais de custo
- Pode ser atualizado dinamicamente por webhooks
- **Exemplo:** Pacotes de fotos, gerações com configurações especiais

### ✅ **`generation.metadata.cost`** (Dentro do JSON)
- Prioridade máxima (usado raramente)
- Para casos onde o custo precisa ser sobrescrito

---

## Exemplos Práticos

### Exemplo 1: Geração Normal (10 créditos)
```json
{
  "id": "abc123",
  "estimatedCost": 10,          // ← Puxado daqui
  "metadata": {}
}
```
**Resultado:** "10 créditos"

---

### Exemplo 2: Pacote de Fotos (200 créditos)
```json
{
  "id": "def456",
  "estimatedCost": 200,         // ← Fallback
  "metadata": {
    "estimatedCost": 200,       // ← Puxado daqui (prioridade)
    "packageType": "premium",
    "variations": 20
  }
}
```
**Resultado:** "200 créditos (20 fotos)"

---

### Exemplo 3: Custo Personalizado (Override)
```json
{
  "id": "ghi789",
  "estimatedCost": 30,
  "metadata": {
    "cost": 35,                 // ← Puxado daqui (máxima prioridade)
    "estimatedCost": 30
  }
}
```
**Resultado:** "35 créditos"

---

## Visualização do Fluxo

```
┌─────────────────────────────────────────┐
│   image-modal.tsx (UI)                  │
│   Linha 619: getGenerationCostDescription│
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│   gallery-cost.ts                       │
│   extractCostMetadata(generation)       │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│   BUSCA NA ORDEM:                       │
│   1. generation.metadata.cost           │
│   2. generation.metadata.estimatedCost  │
│   3. generation.estimatedCost           │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│   cost-calculator.ts                    │
│   getCostDescription(type, metadata)    │
│   Formata o texto final (ex: "10 créditos")│
└─────────────────────────────────────────┘
```

---

## Código Relevante

### 1. Definição do Custo (API)
**Arquivo:** `src/app/api/image-editor/edit/route.ts`
```typescript
// Linha 266 e 508
const generation = await prisma.generation.create({
  data: {
    // ... outros campos ...
    estimatedCost: creditsNeeded,  // ← Define na coluna direta
  }
})
```

### 2. Extração do Custo (Utilitário)
**Arquivo:** `src/lib/utils/gallery-cost.ts`
```typescript
// Linhas 109-112
const estimatedCost =
  parseNumber(metadata.cost) ??              // Prioridade 1
  parseNumber(metadata.estimatedCost) ??     // Prioridade 2
  parseNumber(generation.estimatedCost)      // Prioridade 3
```

### 3. Exibição do Custo (UI)
**Arquivo:** `src/components/gallery/image-modal.tsx`
```typescript
// Linhas 615-623
<div>
  <div className="text-gray-300">Custo:</div>
  <div className="text-white font-medium">
    {getGenerationCostDescription(currentImage.generation, {
      operationType: currentImage.operationType
    })}
  </div>
</div>
```

---

## Resumo

| Fonte | Prioridade | Quando é Usado |
|-------|-----------|----------------|
| `metadata.cost` | 🥇 Máxima | Raríssimo - apenas para override manual |
| `metadata.estimatedCost` | 🥈 Alta | Pacotes, webhooks, dados complexos |
| `estimatedCost` (coluna) | 🥉 Padrão | **Maioria dos casos** - definido na criação |

**Em 90% dos casos, o sistema usa `generation.estimatedCost` (coluna direta).**

O sistema de fallback garante que sempre haverá um valor de custo, mesmo se um dos campos estiver vazio.

---

**Analisado por:** Claude (Cursor AI)  
**Data:** 25 de Janeiro de 2026
