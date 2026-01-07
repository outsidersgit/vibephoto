# Relatório de Migração - Sistema de Erros

## 📊 Resumo
- **Total de arquivos com `catch`**: 55 arquivos
- **Arquivos com uso direto de toast em erros**: 6 arquivos principais
- **Componentes críticos identificados**: 10

---

## 🔴 PRIORIDADE ALTA - Componentes Críticos

### 1. **Geração de Imagens**
📁 `src/components/generation/generation-interface.tsx`

**Usos encontrados:**
- Linha 423-427: Erro na geração via SSE
  ```typescript
  addToast({
    type: 'error',
    title: 'Falha na geração de imagem',
    description: errorMessage, // ← Pode vir do backend!
  })
  ```
- Linha 515-520: Erro na geração via polling
- Linha 656-660: Erro genérico (já tem tratamento, mas usa descrição customizada)
- Linha 770-774: Erro de download

**Impacto:** CRÍTICO - Usuário pode ver mensagens técnicas do Replicate/API

---

### 2. **Editor de Imagens (Studio IA)**
📁 `src/components/image-editor/image-editor-interface.tsx`

**Usos encontrados:**
- Linha 218-222: Sucesso (OK)
- Linha 232-236: Warning (OK)
- Linha 261-265: Info (OK)
- Linha 270-274: Info (OK)

**Status:** ✅ Não tem erros expostos (só success/warning/info)

---

### 3. **Geração de Vídeo**
📁 `src/components/generation/video-generation-interface.tsx`

**Precisa verificar:** Possível uso de error.message

---

### 4. **Galeria**
📁 `src/components/gallery/auto-sync-gallery-interface.tsx`

**Precisa verificar:** Operações de sync/delete/favoritar

---

### 5. **Compra de Créditos**
📁 `src/components/credits/credit-packages-interface.tsx`

**Impacto:** CRÍTICO - Erros de pagamento devem ser claros

---

### 6. **Pacotes de Fotos**
📁 `src/components/packages/package-modal.tsx`

**Usos:**
- Linha 154-157: Erro ao gerar pacote
  ```typescript
  setErrorMessage(error instanceof Error ? error.message : 'Erro ao gerar pacote')
  ```

**Impacto:** ALTO - Usuário vê erro técnico

---

### 7. **Upload de Modelo**
📁 `src/components/models/creation/step-4-review.tsx`

**Impacto:** ALTO - Erros de treinamento devem ser claros

---

### 8. **Upscale**
📁 `src/components/upscale/upscale-config-modal.tsx`

**Impacto:** MÉDIO

---

### 9. **Pagamentos**
📁 `src/components/payments/update-card-modal.tsx`

**Impacto:** ALTO - Erros financeiros críticos

---

### 10. **Exclusão de Conta**
📁 `src/components/settings/account-deletion-modal.tsx`

**Impacto:** MÉDIO - Mas importante para UX

---

## 📋 Arquivos que NÃO precisam migração

Estes arquivos só têm `catch` mas não exibem erros ou já tratam corretamente:
- video-progress.tsx
- video-modal.tsx
- gallery-grid.tsx (apenas console.error)
- image-modal.tsx (apenas console.error)
- Muitos componentes admin (logging interno apenas)

---

## 🎯 Plano de Migração Sugerido

### Fase 1 - Crítico (fazer AGORA)
1. ✅ generation-interface.tsx (geração de imagens)
2. ✅ packages/package-modal.tsx (pacotes)
3. ✅ video-generation-interface.tsx (vídeos)
4. ✅ credits/credit-packages-interface.tsx (compra)
5. ✅ payments/update-card-modal.tsx (pagamentos)

### Fase 2 - Importante (fazer depois)
6. ✅ models/creation/step-4-review.tsx (treinamento)
7. ✅ upscale/upscale-config-modal.tsx (upscale)
8. ✅ gallery/auto-sync-gallery-interface.tsx (galeria)
9. ✅ settings/account-deletion-modal.tsx (exclusão)

### Fase 3 - Opcional (pode aguardar)
- Componentes admin
- Componentes analytics
- Componentes de monitoring

---

## 🔍 Padrões Encontrados

### Padrão 1: Error message direto
```typescript
catch (error) {
  addToast({
    type: 'error',
    title: 'Erro',
    description: error.message // ❌ PERIGOSO
  })
}
```

### Padrão 2: Error de API
```typescript
const data = await response.json()
addToast({
  type: 'error',
  description: data.error // ❌ PERIGOSO - vem do backend
})
```

### Padrão 3: SetState de erro
```typescript
catch (error) {
  setErrorMessage(error instanceof Error ? error.message : 'Erro') // ❌ PERIGOSO
}
```

---

## ✅ Como Migrar

### Antes:
```typescript
catch (error) {
  addToast({
    type: 'error',
    title: 'Erro',
    description: error.message
  })
}
```

### Depois:
```typescript
import { notifyError } from '@/lib/errors'

catch (error) {
  notifyError(error, 'FEATURE_NAME')
}
```

---

## 📊 Estatísticas

- **Total de linhas com addToast**: ~200+
- **Uso de error.message**: ~15 ocorrências
- **Uso de data.error**: ~10 ocorrências
- **SetState de erro**: ~5 ocorrências

---

## 🚀 Próximo Passo

Escolha uma das opções:
1. **Migração automática completa** - Substituo todos os usos de uma vez
2. **Migração por componente** - Vou migrando um de cada vez para você revisar
3. **Migração apenas dos 5 críticos** - Foco nos mais importantes primeiro

Qual prefere?
