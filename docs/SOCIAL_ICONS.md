# Ícones Oficiais das Redes Sociais

Este arquivo contém os ícones SVG oficiais das principais redes sociais utilizados no botão de compartilhamento da galeria.

## Ícones Implementados

### Instagram
- **Componente**: `InstagramIcon`
- **Características**:
  - **Gradiente oficial do Instagram 100% fiel ao original**
  - Gradiente linear diagonal (canto inferior esquerdo → superior direito):
    - `#FDC830` (amarelo ouro)
    - `#F37335` (laranja vibrante)
    - `#E73C7E` (rosa magenta)
    - `#A855F7` (roxo violeta)
    - `#833AB4` (roxo escuro)
  - Overlay radial do canto superior esquerdo:
    - `#405DE6` (azul Instagram)
    - `#5B51D8` (azul-roxo)
    - `#833AB4` (roxo escuro)
  - Formato de câmera com círculo central (stroke 2.5px) e ponto do flash
  - IDs únicos por tamanho para evitar conflitos
  - Tamanho padrão: 20px (customizável)
  - **Baseado na imagem oficial de referência fornecida**

### TikTok
- **Componente**: `TikTokIcon`
- **Características**:
  - Ícone oficial preto do TikTok
  - Formato musical característico
  - Tamanho padrão: 20px (customizável)

### WhatsApp
- **Componente**: `WhatsAppIcon`
- **Características**:
  - Cor verde oficial (#25D366)
  - Ícone do balão de conversa com telefone
  - Tamanho padrão: 20px (customizável)

## Uso

```tsx
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from '@/components/ui/social-icons'

// Uso básico
<InstagramIcon />
<TikTokIcon />
<WhatsAppIcon />

// Com tamanho personalizado
<InstagramIcon size={24} />
<TikTokIcon size={18} className="hover:opacity-80" />
<WhatsAppIcon size={16} />
```

## Localização

Os ícones são utilizados no componente `gallery-grid.tsx` dentro do dropdown de compartilhamento, substituindo os ícones simples anteriores (IG, TT, WA) por versões oficiais das respectivas marcas.