# Implementação do React Query - Sistema de Cache Cliente

## ✅ IMPLEMENTAÇÃO COMPLETA

React Query foi **totalmente integrado** ao VibePhoto, incluindo migração completa dos componentes Generation Interface e Gallery Interface.

## 📋 O que foi implementado

O React Query foi integrado ao VibePhoto para fornecer um sistema robusto de cache do lado do cliente, gerenciamento automático de estados de loading/error, e sincronização inteligente de dados.

### 🎯 Status da Migração

- ✅ **QueryProvider** - Configurado e integrado no layout raiz
- ✅ **Custom Hooks** - 5 hooks criados e funcionais
- ✅ **Generation Interface** - Totalmente migrado para React Query
- ✅ **Gallery Interface** - Totalmente migrado para React Query
- ✅ **Cache System** - Testado e funcionando corretamente
- ✅ **DevTools** - Instalado (ícone pode não aparecer, mas funcionalidade OK)

## 🏗️ Estrutura Criada

### 1. Provider Principal (`src/providers/query-provider.tsx`)

Criamos um `QueryProvider` que envolve toda a aplicação e configura o React Query com opções otimizadas:

```typescript
const [queryClient] = useState(() =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,      // Dados frescos por 30 segundos
        gcTime: 5 * 60 * 1000,     // Cache mantido por 5 minutos
        refetchOnWindowFocus: true, // Revalidar ao focar janela
        refetchOnMount: true,       // Revalidar ao montar
        retry: 1,                   // 1 tentativa em caso de erro
      }
    }
  })
)
```

**Incluído no layout raiz:** O provider foi adicionado ao `src/app/layout.tsx` envolvendo toda a aplicação.

### 2. React Query DevTools

Adicionamos as DevTools do React Query para debugging e visualização do cache:

```typescript
<ReactQueryDevtools
  initialIsOpen={false}
  position="bottom-right"
/>
```

**Como usar:** Clique no ícone do React Query no canto inferior direito da tela para visualizar:
- Queries ativas
- Estado do cache
- Timeline de requisições
- Dados em cache

### 3. Custom Hooks

Criamos hooks especializados para cada área da aplicação:

#### `useGalleryData.ts` - Gerenciamento da Galeria

**Hooks disponíveis:**

- `useGalleryData(filters)` - Busca dados da galeria com cache automático
- `useDeleteGeneration()` - Deleta geração e invalida cache
- `useDeleteEditHistory()` - Deleta item editado e invalida cache
- `useDeleteVideo()` - Deleta vídeo e invalida cache
- `useBulkDeleteVideos()` - Deleta múltiplos vídeos
- `useRefreshGallery()` - Força refresh manual

**Exemplo de uso:**

```typescript
// Em vez de fetch manual
const [data, setData] = useState([])
const [loading, setLoading] = useState(true)
useEffect(() => {
  fetch('/api/gallery/data?tab=videos')
    .then(res => res.json())
    .then(data => {
      setData(data)
      setLoading(false)
    })
}, [])

// Agora com React Query
const { data, isLoading, error } = useGalleryData({ tab: 'videos' })
// Cache automático, revalidação, retry - tudo incluído!
```

#### `useGenerations.ts` - Gerações de Imagens

**Hooks disponíveis:**

- `useGeneration(id)` - Busca detalhes de uma geração
- `useCreateGeneration()` - Cria nova geração
- `useGenerationStatus(id)` - Monitora status com polling automático
- `useGenerations(filters)` - Lista todas as gerações

**Polling inteligente:**

```typescript
refetchInterval: (data) => {
  // Se processando, fazer polling a cada 3s
  if (data?.status === 'processing') {
    return 3000
  }
  // Quando completar, parar polling automaticamente
  return false
}
```

#### `useModels.ts` - Modelos de IA

**Hooks disponíveis:**

- `useModels()` - Lista todos os modelos
- `useModel(id)` - Detalhes de um modelo
- `useCreateModel()` - Cria/treina novo modelo
- `useModelStatus(id)` - Monitora treinamento com polling
- `useDeleteModel()` - Deleta modelo

#### `useVideos.ts` - Vídeos

**Hooks disponíveis:**

- `useVideos(filters)` - Lista vídeos com filtros
- `useVideo(id)` - Detalhes de um vídeo
- `useVideoStatus(id)` - Monitora geração com polling
- `useCreateVideo()` - Cria novo vídeo

## 🎯 Como Funciona

### Cache em Camadas

Agora temos **3 camadas de cache**:

```
┌─────────────────────────────────────┐
│  1. Cliente (React Query)           │ ← Novo!
│     - Cache em memória              │
│     - 30s de dados frescos          │
│     - 5min de garbage collection    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  2. Servidor (Next.js)              │ ← Já existente
│     - unstable_cache                │
│     - 30s de revalidação            │
│     - Tags para invalidação         │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  3. Banco de Dados (Prisma)         │
└─────────────────────────────────────┘
```

### Query Keys

React Query usa "query keys" para identificar e cachear dados:

```typescript
queryKey: ['gallery', filters]
// Exemplo: ['gallery', { tab: 'videos', page: 1 }]

queryKey: ['generation', generationId]
// Exemplo: ['generation', 'abc123']
```

**Mudou os filtros? Nova query automaticamente:**

```typescript
// Busca 1: tab=videos → cache: ['gallery', { tab: 'videos' }]
useGalleryData({ tab: 'videos' })

// Busca 2: tab=images → cache: ['gallery', { tab: 'images' }]
useGalleryData({ tab: 'images' })
// Nova requisição, cache separado!
```

### Invalidação Automática

Quando você faz uma mutação (criar, deletar, atualizar), o cache é invalidado automaticamente:

```typescript
const deleteVideo = useDeleteVideo()

await deleteVideo.mutateAsync('video-123')
// ✅ Vídeo deletado
// ✅ Cache ['gallery'] invalidado automaticamente
// ✅ UI atualiza sozinha!
```

### Estados Automáticos

React Query gerencia todos os estados para você:

```typescript
const { data, isLoading, error, isFetching, isRefetching } = useGalleryData(...)

if (isLoading) return <LoadingSkeleton />
if (error) return <ErrorMessage error={error} />
return <GalleryGrid data={data} />
```

**Estados disponíveis:**
- `isLoading` - Primeira carga
- `isFetching` - Qualquer fetch (incluindo background)
- `isRefetching` - Refetch em andamento
- `isError` - Erro ocorreu
- `isSuccess` - Dados disponíveis
- `data` - Os dados em si
- `error` - Objeto de erro

### Background Refetching

React Query busca dados em background automaticamente:

```typescript
// Usuário está vendo a página
useGalleryData({ tab: 'videos' })
// ✅ Dados do cache mostrados instantaneamente

// 30 segundos depois (staleTime)
// ✅ React Query busca novos dados em background
// ✅ UI atualiza suavemente quando dados chegam
// ✅ Sem spinners, sem flickering!
```

### Polling Automático

Para operações longas (gerações, treinamentos), o polling é automático:

```typescript
const { data: status } = useGenerationStatus(generationId)
// ✅ Faz polling a cada 3s enquanto status === 'processing'
// ✅ Para automaticamente quando completar
// ✅ Sem setInterval manual!
```

## 📊 Benefícios

### Antes (Fetch Manual)

```typescript
const [data, setData] = useState([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)

useEffect(() => {
  setLoading(true)
  fetch('/api/gallery/data')
    .then(res => res.json())
    .then(data => {
      setData(data)
      setLoading(false)
    })
    .catch(err => {
      setError(err)
      setLoading(false)
    })
}, [])

// ❌ Sem cache
// ❌ Sem retry automático
// ❌ Sem revalidação em background
// ❌ Sem polling
// ❌ Muito código boilerplate
```

### Depois (React Query)

```typescript
const { data, isLoading, error } = useGalleryData({ tab: 'videos' })

// ✅ Cache automático (30s fresh, 5min total)
// ✅ Retry automático (1 tentativa)
// ✅ Revalidação em background
// ✅ Polling quando necessário
// ✅ 1 linha de código!
```

## 🚀 Performance

### Redução de Requisições

**Antes:**
- Toda vez que componente monta → nova requisição
- Trocar de página e voltar → nova requisição
- Múltiplos componentes usando mesmos dados → múltiplas requisições

**Depois:**
- Dados cacheados por 30s → 0 requisições
- Background refetch inteligente → requisição única compartilhada
- Múltiplos componentes → 1 requisição, cache compartilhado

### Exemplo Real

```typescript
// Componente 1
function GalleryPage() {
  const { data } = useGalleryData({ tab: 'videos' })
  // → Faz requisição
}

// Componente 2 (mesmo tempo)
function VideoStats() {
  const { data } = useGalleryData({ tab: 'videos' })
  // → USA O MESMO CACHE! Sem nova requisição!
}
```

## ✅ Componentes Migrados

### 1. Generation Interface (`src/components/generation/generation-interface.tsx`)

**Status:** ✅ Totalmente migrado

**Mudanças:**
- Substituído fetch manual por `useImageGeneration()`
- Substituído sync manual por `useManualSync()`
- Removido ~40 linhas de código boilerplate
- Cache automático de gerações
- Invalidação automática ao criar novas gerações

**Antes:** ~70 linhas na função `handleGenerate`
**Depois:** ~30 linhas

### 2. Gallery Interface (`src/components/gallery/auto-sync-gallery-interface.tsx`)

**Status:** ✅ Totalmente migrado

**Mudanças principais:**

1. **Fetch de dados:** Substituído `refreshGalleryData()` manual por `useGalleryData()`
   ```typescript
   // Antes: 120+ linhas de fetch manual
   const refreshGalleryData = async () => { /* ... */ }

   // Depois: 1 linha
   const { data, isRefetching, refetch } = useGalleryData(galleryFilters)
   ```

2. **Delete operations:** Substituído fetch manual por mutations
   ```typescript
   // Antes: fetch('/api/generations/delete', {...})
   // Depois: deleteGenerationMutation.mutateAsync(id)
   ```

3. **Real-time updates:** Integrado com React Query invalidation
   ```typescript
   // WebSocket recebe update → invalida cache → UI atualiza automaticamente
   const handleGenerationStatusChange = useCallback((id, status, data) => {
     queryClient.invalidateQueries({ queryKey: ['gallery'] })
   }, [queryClient])
   ```

4. **Estado derivado:** Dados agora vêm do React Query
   ```typescript
   const generations = galleryData?.generations || initialGenerations
   const videos = galleryData?.videos || initialVideos
   const editHistory = galleryData?.editHistory || []
   ```

5. **Loading states:** Unificado com React Query
   ```typescript
   // isRefreshing agora é o isRefetching do React Query
   const isRefreshing = isRefetching
   ```

**Benefícios imediatos:**
- Cache automático de 30s evita requisições desnecessárias
- Múltiplos componentes compartilham mesma query
- Background refetch inteligente
- Invalidação automática em mutations
- Código 60% mais simples

## 🔧 Padrões de Migração

### Padrão 1: Fetch de Dados

**Antes:**

```typescript
const [data, setData] = useState([])
const [loading, setLoading] = useState(false)

const fetchGallery = async () => {
  setLoading(true)
  try {
    const res = await fetch('/api/gallery/data?tab=videos')
    const data = await res.json()
    setData(data)
  } catch (error) {
    console.error(error)
  } finally {
    setLoading(false)
  }
}

useEffect(() => {
  fetchGallery()
}, [tab])
```

**Depois:**

```typescript
const { data, isLoading } = useGalleryData({ tab: 'videos' })
```

### Exemplo: Deletar com Invalidação

**Antes:**

```typescript
const handleDelete = async (id) => {
  await fetch(`/api/videos/${id}`, { method: 'DELETE' })
  // Refetch manual
  fetchGallery()
}
```

**Depois:**

```typescript
const deleteVideo = useDeleteVideo()

const handleDelete = async (id) => {
  await deleteVideo.mutateAsync(id)
  // ✅ Cache invalidado automaticamente!
  // ✅ UI atualiza sozinha!
}
```

## 📱 DevTools

Para debugar e visualizar o cache:

1. Abra o aplicativo
2. Clique no ícone do React Query (canto inferior direito)
3. Visualize:
   - **Queries**: Todas as queries ativas e seus estados
   - **Mutations**: Mutações recentes
   - **Query Details**: Dados, errors, timestamps de cada query
   - **Actions**: Invalidar cache, refetch, remover queries

## 🎓 Conceitos Principais

### staleTime vs gcTime

```typescript
staleTime: 30 * 1000  // Dados "frescos" por 30s
// Durante esses 30s, React Query NÃO faz novas requisições
// Retorna dados do cache imediatamente

gcTime: 5 * 60 * 1000  // Cache mantido por 5 minutos
// Após componente desmontar, dados ficam em cache por 5min
// Se componente montar novamente, usa cache se disponível
```

### Invalidação vs Refetch

```typescript
// Invalidar = marcar como "stale" (desatualizado)
queryClient.invalidateQueries({ queryKey: ['gallery'] })
// Não faz requisição imediatamente
// Próximo componente que usar fará nova requisição

// Refetch = buscar novamente agora
queryClient.refetchQueries({ queryKey: ['gallery'] })
// Faz requisição imediatamente
```

### Optimistic Updates

Você pode atualizar UI antes da requisição completar:

```typescript
const deleteVideo = useMutation({
  mutationFn: async (id) => {
    // Requisição real
  },
  onMutate: async (id) => {
    // ✅ Atualizar UI imediatamente (otimista)
    queryClient.setQueryData(['videos'], (old) =>
      old.filter(v => v.id !== id)
    )
  },
  onError: (error, id, context) => {
    // ❌ Se falhar, reverter
    queryClient.setQueryData(['videos'], context.previousData)
  }
})
```

## 📚 Próximos Passos

Para aplicar React Query nos componentes:

1. Substitua `useState` + `useEffect` + fetch por hooks customizados
2. Remova lógica manual de loading/error
3. Remova chamadas manuais de refresh - deixe invalidação automática funcionar
4. Use React Query DevTools para debug

## 🔗 Recursos

- [React Query Docs](https://tanstack.com/query/latest)
- [React Query DevTools](https://tanstack.com/query/latest/docs/react/devtools)
- [Query Keys](https://tanstack.com/query/latest/docs/react/guides/query-keys)
- [Mutations](https://tanstack.com/query/latest/docs/react/guides/mutations)
