# 📊 Guia de Análise de Bundle

## 🎯 Como usar o Bundle Analyzer

### Rodar a análise:

```bash
npm run analyze
```

Isso irá:
1. Fazer build de produção
2. Gerar relatórios visuais
3. Abrir automaticamente no navegador

### O que você verá:

Dois relatórios interativos:
- **Client Bundle** - JavaScript do cliente
- **Server Bundle** - JavaScript do servidor

### Como interpretar:

#### 🔴 **Problemas Comuns:**

**1. Pacotes grandes (> 100KB):**
```
- moment.js (300KB) → trocar por date-fns
- lodash (70KB) → usar lodash-es ou import específico
- @aws-sdk (500KB) → tree shaking não funcionando
```

**2. Duplicação:**
```
- react (aparece 2x) → problemas de dependências
- zod (múltiplas versões)
```

**3. Chunks grandes:**
```
- main.js > 200KB → precisa code splitting
- pages > 100KB → lazy loading
```

#### ✅ **O que é normal:**

```
- next/dist/client < 100KB
- react + react-dom ~150KB (gzipped ~50KB)
- framer-motion ~80KB (se usado)
```

---

## 🔍 Análise do VibePhoto

### Após rodar `npm run analyze`, verifique:

#### **1. Principais Chunks:**

```
┌─ Prioridade ALTA ─────────────────────┐
│ • page.js (homepage)      < 150KB    │
│ • gallery page           < 200KB    │
│ • generate page          < 180KB    │
└───────────────────────────────────────┘
```

#### **2. Shared Chunks:**

```
┌─ Compartilhados ──────────────────────┐
│ • framework.js           ~150KB     │
│ • main.js                ~50KB      │
│ • _app.js                ~30KB      │
└───────────────────────────────────────┘
```

#### **3. Modais (Lazy Loaded):**

```
✅ Devem estar em chunks separados:
│ • ImageModal            ~80KB       │
│ • VideoModal            ~60KB       │
│ • ComparisonModal       ~40KB       │
└───────────────────────────────────────┘
```

---

## 🎯 Otimizações Recomendadas

### **Se encontrar problemas:**

#### **1. Pacote grande não usado completamente:**

```javascript
// ❌ Ruim
import _ from 'lodash'

// ✅ Bom
import debounce from 'lodash/debounce'
```

#### **2. Lib pesada:**

```javascript
// ❌ Ruim - moment.js (300KB)
import moment from 'moment'

// ✅ Bom - date-fns (20KB)
import { format } from 'date-fns'
```

#### **3. Componente não lazy loaded:**

```javascript
// ❌ Ruim
import { HeavyModal } from './modal'

// ✅ Bom
const HeavyModal = dynamic(() => import('./modal'), {
  ssr: false,
  loading: () => <Skeleton />
})
```

---

## 📈 Métricas Alvo

### **Tamanhos ideais:**

```
┌─ First Load JS ───────────────────────┐
│ Homepage           < 200KB            │
│ Gallery            < 250KB            │
│ Generate           < 230KB            │
│ Dashboard          < 180KB            │
└───────────────────────────────────────┘

┌─ Shared Chunks ───────────────────────┐
│ framework          ~150KB (Next.js)   │
│ main               ~50KB              │
│ vendors            ~100KB total       │
└───────────────────────────────────────┘
```

### **Após otimizações esperadas:**

- ✅ Total First Load: ~350-450KB
- ✅ Gzipped: ~120-150KB
- ✅ Lazy chunks: 5-10 arquivos
- ✅ No duplicates

---

## 🚀 Próximos Passos

1. **Rodar análise:**
   ```bash
   npm run analyze
   ```

2. **Identificar oportunidades:**
   - Pacotes > 100KB
   - Duplicações
   - Imports desnecessários

3. **Implementar otimizações:**
   - Tree shaking
   - Code splitting
   - Lazy loading
   - Trocar libs pesadas

4. **Re-rodar e comparar:**
   ```bash
   npm run analyze
   ```

---

## 📝 Checklist de Análise

Após rodar `npm run analyze`, verifique:

- [ ] Homepage < 200KB First Load
- [ ] Sem duplicação de pacotes
- [ ] Modais em chunks separados
- [ ] Sem moment.js (usar date-fns)
- [ ] Sem lodash completo (usar imports específicos)
- [ ] @aws-sdk com tree shaking
- [ ] React Query separado
- [ ] Framer Motion em chunk próprio

---

**Última atualização:** Fase 3 - Performance Optimization

