# 📱 Auditoria Mobile Performance - /gallery e /packages

## 🔍 Problemas Identificados

### 🔴 CRÍTICO: /packages Mobile (Score 74/100)

#### Problema 1: Fetch Sem Cache no Mount
**Arquivo**: `src/app/packages/packages-client.tsx` (linha 37)
```typescript
useEffect(() => {
  fetchPackages()  // ❌ Fetch sem cache
}, [])
```

**Impacto Mobile**:
- Latência de rede mobile (4G/3G) pior
- Primeiro carregamento sempre lento
- Sem skeleton durante loading (spinner genérico)

---

#### Problema 2: 84 Imagens Carregadas de Uma Vez
**Arquivo**: `src/components/packages/package-grid.tsx`
- 21 pacotes × 4 previews = **84 imagens**
- Todas com `quality={90}` (alta para mobile)
- Mobile baixa 84 imagens simultaneamente
- Sem lazy loading efetivo

**Impacto Mobile**:
- LCP alto (muitas imagens competindo por prioridade)
- Banda mobile desperdiçada
- Score baixo no Lighthouse

---

#### Problema 3: Lazy Loading dos Modals DUPLICADO
**Arquivo**: `src/components/packages/package-modal.tsx`
- Modal já é lazy-loaded pelo Next.js (dynamic import)
- Mas pacotes carregam todos os previews antes

---

### 🟡 MÉDIO: /gallery Mobile (Piorou)

#### Problema 1: Priority na Primeira Imagem
**Arquivo**: `src/components/gallery/gallery-grid.tsx` (linha 510)
```typescript
priority={index === 0}  // ✅ Correto
```

**Mas**: No mobile, primeira imagem pode estar **abaixo do fold**
- Filtros ocupam espaço no topo
- Tabs ocupam espaço
- Primeira imagem só aparece após scroll

**Impacto**: Priority inútil, desperdiça recursos

---

#### Problema 2: Sizes Pode Ser Muito Agressivo
```typescript
sizes="(max-width: 640px) 50vw, ..."
```

**Mas**: Em mobile portrait, imagens ocupam **100vw em 1 coluna**
- Grid muda para 1 coluna em telas pequenas
- 50vw é subestimado
- Browser baixa imagem pequena demais, depois upscale

---

#### Problema 3: Modals Lazy Loaded DEPOIS do Click
```typescript
const ImageModal = dynamic(() => import('./image-modal'), {
  ssr: false
})
```

**Problema**: Modal só carrega quando clica
- Delay perceptível no mobile (rede lenta)
- Pode ser pre-loaded durante idle time

---

## ✅ Plano de Correção Mobile

### Fix 1: /packages - React Query + Lazy Loading Real

**Arquivo**: `src/app/packages/packages-client.tsx`

```typescript
// 1. Migrar para React Query
const { data: packages = [], isLoading } = usePackages()

// 2. Lazy loading com Intersection Observer
// Carregar apenas 6 pacotes inicialmente
// Restante carrega on-demand
```

**Benefícios**:
- Cache automático
- Loading incremental
- Score esperado: 74 → 88+ (+14 pontos)

---

### Fix 2: /packages - Reduzir Quality no Mobile

**Arquivo**: `src/components/packages/package-grid.tsx`

```typescript
// ANTES:
quality={90}  // ❌ Muito alto para previews pequenos

// DEPOIS:
quality={80}  // Mobile
quality={85}  // Desktop (quando viewer > 1024px)
```

---

### Fix 3: /gallery - Ajustar Sizes para Mobile Portrait

**Arquivo**: `src/components/gallery/gallery-grid.tsx`

```typescript
// ANTES:
sizes="(max-width: 640px) 50vw, ..."

// DEPOIS:
sizes="(max-width: 480px) 100vw, (max-width: 640px) 50vw, ..."
// Mobile portrait 1 coluna = 100vw
// Mobile landscape 2 colunas = 50vw
```

---

### Fix 4: /gallery - Priority Apenas Se Above Fold

**Arquivo**: `src/components/gallery/gallery-grid.tsx`

```typescript
// ANTES:
priority={index === 0}  // ❌ Pode estar below fold

// DEPOIS:
priority={false}  // Remover priority (LCP é o header/filtros)
// Ou detectar viewport e aplicar apenas se visível
```

---

### Fix 5: Lazy Loading de Pacotes com Intersection Observer

**Novo**: `src/components/packages/package-grid-lazy.tsx`

Implementar:
- Carregar 6 pacotes iniciais
- Observer para carregar mais ao scroll
- Skeleton para pacotes não carregados

---

## 📊 Resultados Esperados

### /packages Mobile:
| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| **Score** | 74/100 | 88-92/100 | **+14-18pts** |
| **LCP** | ~4.5s | ~2.5s | **-44%** |
| **Images** | 84 (todas) | 24 (inicial) | **-71%** |
| **Transfer** | ~2.5 MB | ~800 KB | **-68%** |

### /gallery Mobile:
| Métrica | Antes | Depois |
|---------|-------|--------|
| **Score** | Piorou | Recuperado | ✅ |
| **LCP** | ? | <2.5s | ✅ |
| **Sizes** | Subestimado | Correto | ✅ |

---

## 🎯 Ordem de Implementação

### Sprint 3 - Mobile First (2-3 horas):

1. **Fix /packages** (1h):
   - React Query hook
   - Quality 80 (mobile)
   - Lazy loading com Intersection Observer
   
2. **Fix /gallery** (30min):
   - Ajustar sizes mobile
   - Remover priority desnecessário
   
3. **Testes Mobile** (30min):
   - Lighthouse mobile /packages
   - Lighthouse mobile /gallery
   - Validar scores > 85

---

## 📁 Arquivos a Modificar

### /packages:
- `src/app/packages/packages-client.tsx` - React Query
- `src/components/packages/package-grid.tsx` - Quality mobile
- `src/hooks/usePackages.ts` - Novo hook (criar)

### /gallery:
- `src/components/gallery/gallery-grid.tsx` - Sizes + priority

---

**Pronto para implementar Sprint 3: Mobile First?** 📱✨

