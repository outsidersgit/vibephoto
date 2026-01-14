# WhatsApp Contact Integration

Integração simples e focada em conversão de leads via WhatsApp.

---

## 🎯 Objetivo

Permitir que visitantes da landing page entrem em contato instantaneamente pelo WhatsApp para tirar dúvidas antes de assinar, aumentando a conversão sem fricção.

---

## 📦 Arquivos Criados

### 1. **Configuração Central**
`src/lib/config/whatsapp.ts`
- Número de WhatsApp configurável
- Mensagens pré-definidas por contexto
- Funções helper (`getWhatsAppLink`, `openWhatsApp`)

### 2. **Componentes UI**
`src/components/ui/whatsapp-button.tsx`
- `WhatsAppButton` - Botão reutilizável com variantes
- `WhatsAppFloatingButton` - Botão fixo flutuante

### 3. **Variáveis de Ambiente**
`.env.example`
- Template para configuração do número

---

## ⚙️ Configuração

### 1. Adicionar Número de WhatsApp

Edite `.env.local` (ou `.env`):

```bash
# Formato: Código do país + DDD + Número (sem espaços, sem +)
# Exemplo Brasil: 5511999999999
#   55 = Brasil
#   11 = São Paulo
#   999999999 = Número
NEXT_PUBLIC_WHATSAPP_NUMBER=5511999999999
```

### 2. Customizar Mensagens

Edite `src/lib/config/whatsapp.ts`:

```typescript
messages: {
  default: 'Olá! Estou com uma dúvida sobre o VibePhoto.',
  pricing: 'Olá! Gostaria de saber mais sobre os planos e preços.',
  support: 'Olá! Preciso de ajuda com o VibePhoto.',
  demo: 'Olá! Gostaria de ver uma demonstração.',
}
```

### 3. Customizar Posição do Floating Button

Edite `src/lib/config/whatsapp.ts`:

```typescript
ui: {
  floatingButton: {
    enabled: true,
    position: 'bottom-right', // ou 'bottom-left'
    offsetBottom: '24px',
    offsetRight: '24px',
  }
}
```

---

## 🚀 Uso

### Floating Button (Já Implementado)

Adicionado automaticamente na landing page (`src/app/page.tsx`):

```tsx
import { WhatsAppFloatingButton } from '@/components/ui/whatsapp-button'

export default function LandingPage() {
  return (
    <div>
      {/* Conteúdo da página */}

      {/* Botão flutuante sempre visível */}
      <WhatsAppFloatingButton />
    </div>
  )
}
```

### Botão Inline Customizado

Use em qualquer lugar da aplicação:

```tsx
import { WhatsAppButton } from '@/components/ui/whatsapp-button'
import { WHATSAPP_CONFIG } from '@/lib/config/whatsapp'

// Botão padrão
<WhatsAppButton />

// Botão com mensagem customizada
<WhatsAppButton
  message={WHATSAPP_CONFIG.messages.pricing}
  label="Falar sobre Preços"
/>

// Botão ghost (sem background)
<WhatsAppButton
  variant="ghost"
  message="Olá! Tenho interesse em pacotes enterprise."
/>

// Botão outline
<WhatsAppButton
  variant="outline"
  size="lg"
  label="Contato WhatsApp"
/>

// Apenas ícone
<WhatsAppButton
  iconOnly
  size="icon"
  variant="default"
/>
```

### Abrir WhatsApp Programaticamente

```typescript
import { openWhatsApp, WHATSAPP_CONFIG } from '@/lib/config/whatsapp'

// Com mensagem padrão
openWhatsApp()

// Com mensagem customizada
openWhatsApp('Olá! Gostaria de saber mais sobre o plano Pro.')

// Com mensagem pré-definida
openWhatsApp(WHATSAPP_CONFIG.messages.demo)
```

---

## 🎨 Variantes do Botão

### WhatsAppButton Props

| Prop | Tipo | Padrão | Descrição |
|------|------|--------|-----------|
| `message` | `string` | `undefined` | Mensagem customizada (usa default se omitido) |
| `variant` | `'default' \| 'outline' \| 'ghost' \| 'floating'` | `'default'` | Estilo do botão |
| `size` | `'sm' \| 'default' \| 'lg' \| 'icon'` | `'default'` | Tamanho do botão |
| `showTooltip` | `boolean` | `true` | Mostrar tooltip no hover |
| `className` | `string` | `undefined` | Classes CSS customizadas |
| `label` | `string` | `'WhatsApp'` | Texto do botão (se não for iconOnly) |
| `iconOnly` | `boolean` | `false` | Mostrar apenas ícone |

### Exemplos Visuais

```tsx
// Botão verde padrão WhatsApp
<WhatsAppButton
  className="bg-[#25D366] hover:bg-[#20BA5A] text-white"
/>

// Botão grande com texto
<WhatsAppButton
  size="lg"
  label="Tire suas dúvidas no WhatsApp"
/>

// Botão pequeno outline
<WhatsAppButton
  variant="outline"
  size="sm"
  label="WhatsApp"
/>

// Apenas ícone circular
<WhatsAppButton
  iconOnly
  size="icon"
  className="rounded-full"
/>
```

---

## 🎯 Onde Usar (Sugestões)

### ✅ Já Implementado

1. **Landing Page** (`/`)
   - Floating button no canto inferior direito
   - Sempre visível durante scroll

### 💡 Sugestões de Implementação Futura

2. **Página de Pricing** (`/pricing`)
   ```tsx
   <WhatsAppButton
     message={WHATSAPP_CONFIG.messages.pricing}
     variant="outline"
     label="Dúvidas sobre planos?"
   />
   ```

3. **Página de Suporte** (`/support`)
   ```tsx
   <WhatsAppButton
     message={WHATSAPP_CONFIG.messages.support}
     size="lg"
     label="Falar com Suporte"
   />
   ```

4. **Modal de Insuficiência de Créditos**
   ```tsx
   <WhatsAppButton
     message="Olá! Preciso de mais créditos, como funciona?"
     variant="ghost"
   />
   ```

5. **FAQ** (`/legal/faq`)
   ```tsx
   <WhatsAppButton
     message="Olá! Não encontrei resposta para minha dúvida no FAQ."
   />
   ```

6. **Footer** (em todas as páginas)
   ```tsx
   <WhatsAppButton
     variant="ghost"
     iconOnly={false}
     label="WhatsApp"
   />
   ```

---

## 🔒 Boas Práticas Implementadas

### Segurança
- ✅ `rel="noopener noreferrer"` em todos os links
- ✅ Abre em nova aba (`target="_blank"`)
- ✅ Não quebra navegação atual
- ✅ Número configurável via env (não hardcoded)

### UX/UI
- ✅ Ícone oficial do WhatsApp (`MessageCircle` do lucide-react)
- ✅ Tooltip informativo no hover
- ✅ Cor verde oficial WhatsApp (`#25D366`)
- ✅ Funciona em desktop e mobile
- ✅ Link universal `wa.me` (abre app no mobile, web no desktop)
- ✅ Acessibilidade: `aria-label` presente

### Performance
- ✅ Client-side only (não afeta SSR)
- ✅ Componentes leves
- ✅ Sem dependências externas pesadas
- ✅ Lazy load opcional (já é client component)

### Manutenibilidade
- ✅ Configuração centralizada
- ✅ Componentes reutilizáveis
- ✅ Tipagem TypeScript completa
- ✅ Fácil customização
- ✅ Separação de concerns

---

## 📱 Comportamento Mobile vs Desktop

### Desktop
- Abre WhatsApp Web (`https://web.whatsapp.com/send`)
- Nova aba do navegador
- Usuário precisa estar logado no WhatsApp Web

### Mobile
- Abre app do WhatsApp automaticamente
- Não abre nova aba (deep link)
- Experiência nativa

### Link Universal
O link `wa.me` detecta automaticamente o dispositivo:
```
https://wa.me/5511999999999?text=Mensagem
```

---

## 🧪 Teste

### 1. Teste Local

```bash
# Configure o número no .env.local
NEXT_PUBLIC_WHATSAPP_NUMBER=5511999999999

# Inicie o servidor de desenvolvimento
npm run dev

# Acesse http://localhost:3000
# Clique no botão flutuante verde (canto inferior direito)
```

### 2. Verificação

- ✅ Link abre em nova aba
- ✅ URL gerada: `https://wa.me/5511999999999?text=Olá...`
- ✅ Mensagem pré-preenchida aparece
- ✅ Tooltip aparece no hover

### 3. Teste Mobile

```bash
# Em um dispositivo móvel, acesse:
https://seu-dominio.com

# Clique no botão WhatsApp
# Deve abrir o app automaticamente
```

---

## 🐛 Troubleshooting

### Botão não aparece

**Problema:** `NEXT_PUBLIC_WHATSAPP_NUMBER` não configurado

**Solução:**
```bash
# Adicione no .env.local
NEXT_PUBLIC_WHATSAPP_NUMBER=5511999999999

# Reinicie o servidor
npm run dev
```

### Link com formato errado

**Problema:** Número com espaços ou caracteres especiais

**Solução:**
```bash
# Formato correto (apenas dígitos):
NEXT_PUBLIC_WHATSAPP_NUMBER=5511999999999

# Formatos INCORRETOS:
# +55 11 99999-9999  ❌
# 55 11 999999999    ❌
# (11) 99999-9999    ❌
```

### Mensagem não aparece pré-preenchida

**Problema:** URL encoding incorreto

**Solução:** Já resolvido automaticamente com `encodeURIComponent()` na função `getWhatsAppLink()`

### Botão não abre WhatsApp no mobile

**Problema:** URL incorreta ou número inválido

**Solução:** Verifique:
1. Número tem código do país (ex: 55 para Brasil)
2. Número tem DDD (ex: 11 para SP)
3. Número tem 9 dígitos (celular)
4. Total: 13 dígitos (55 + 11 + 999999999)

---

## 📊 Métricas de Conversão (Recomendado)

Adicione tracking para medir eficácia:

```tsx
import { openWhatsApp } from '@/lib/config/whatsapp'

function trackWhatsAppClick(context: string) {
  // Google Analytics
  gtag('event', 'whatsapp_click', {
    event_category: 'Lead Generation',
    event_label: context,
  })

  // ou outro analytics
  analytics.track('WhatsApp Contact Initiated', {
    source: context,
  })
}

// No componente
<WhatsAppButton
  onClick={() => {
    trackWhatsAppClick('landing_page_floating')
    openWhatsApp()
  }}
/>
```

---

## 🎨 Customização Avançada

### Tema Escuro

```tsx
<WhatsAppFloatingButton
  className="dark:bg-[#128C7E] dark:hover:bg-[#075E54]"
/>
```

### Animação Pulse

```tsx
<WhatsAppFloatingButton
  className="animate-pulse hover:animate-none"
/>
```

### Badge de Notificação

```tsx
<div className="relative">
  <WhatsAppButton iconOnly />
  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">
    1
  </span>
</div>
```

---

## ✅ Checklist de Deploy

Antes de fazer deploy em produção:

- [ ] Número de WhatsApp configurado no `.env.production`
- [ ] Testado em desktop (Chrome, Firefox, Safari)
- [ ] Testado em mobile (Android, iOS)
- [ ] Link abre corretamente (`wa.me` funcionando)
- [ ] Mensagem pré-preenchida aparece
- [ ] Tooltip funciona
- [ ] Sem console errors
- [ ] Botão visível e acessível
- [ ] Analytics configurado (opcional)

---

## 📝 Changelog

### v1.0.0 (2026-01-14)

**Criado:**
- ✅ Configuração centralizada (`whatsapp.ts`)
- ✅ Componente `WhatsAppButton`
- ✅ Componente `WhatsAppFloatingButton`
- ✅ Integração na landing page
- ✅ Documentação completa

**Features:**
- ✅ Floating button sempre visível
- ✅ Múltiplas variantes de botão
- ✅ Mensagens pré-definidas por contexto
- ✅ Tooltip informativo
- ✅ Mobile-first design
- ✅ TypeScript completo
- ✅ Segurança (noopener, noreferrer)

---

## 🚀 Próximos Passos (Opcional)

1. **Analytics Integration**
   - Rastrear cliques por origem
   - Medir conversão WhatsApp → Assinatura

2. **A/B Testing**
   - Testar diferentes posições do floating button
   - Testar diferentes mensagens iniciais

3. **Smart Messaging**
   - Detectar contexto da página (pricing, support, etc.)
   - Ajustar mensagem automaticamente

4. **Chat Widget**
   - Widget de chat simulado antes de abrir WhatsApp
   - Capturar email antes de redirecionar

5. **Multi-idioma**
   - Detectar idioma do navegador
   - Ajustar mensagem automaticamente

---

## 📞 Suporte

Para dúvidas sobre esta implementação, consulte:
- Este arquivo (`WHATSAPP_INTEGRATION.md`)
- Código fonte em `src/lib/config/whatsapp.ts`
- Componentes em `src/components/ui/whatsapp-button.tsx`
