/**
 * Presets do Estúdio IA
 * Configuração centralizada para fácil manutenção
 */

export interface EditorPreset {
  id: string
  title: string
  subtitle: string
  promptBase: string
  expectedAttachments: string
  icon: string
}

export const EDITOR_PRESETS: EditorPreset[] = [
  {
    id: 'enhance',
    title: 'Melhorar imagem',
    subtitle: 'Aprimore nitidez, iluminação e qualidade sem mudar o conteúdo.',
    promptBase: 'Melhore a qualidade desta imagem mantendo o conteúdo original. Corrija iluminação, aumente nitidez, reduza ruído, melhore contraste e cores de forma natural, sem alterar o tema ou adicionar elementos.',
    expectedAttachments: '1 imagem',
    icon: '✨'
  },
  {
    id: 'product',
    title: 'Foto de produto premium',
    subtitle: 'Transforme sua foto em estética e-commerce premium, com cara de anúncio.',
    promptBase: 'Crie uma foto de produto premium para e-commerce usando esta imagem como referência principal do produto. Mantenha o produto fiel (forma, cores e detalhes). Iluminação de estúdio, fundo limpo e elegante, sombras suaves, aparência realista, composição central e foco no produto.',
    expectedAttachments: '1 ou mais imagens (produto)',
    icon: '📦'
  },
  {
    id: 'try-on',
    title: 'Experimentar look',
    subtitle: 'Veja como um look ficaria em você — rápido e sem complicação.',
    promptBase: 'Faça um experimento de look. Use a foto da pessoa e a foto da roupa (ou do look) para gerar uma imagem realista da pessoa usando essa roupa. Preserve o corpo e identidade da pessoa (sem mudar rosto), mantenha caimento natural, textura do tecido e iluminação coerente.',
    expectedAttachments: '2 ou mais imagens (pessoa + roupa/look)',
    icon: '👔'
  },
  {
    id: 'banner',
    title: 'Banner ad / criativo',
    subtitle: 'Crie um criativo pronto para anúncio com visual forte e foco em conversão.',
    promptBase: 'Crie um banner criativo para anúncio usando esta imagem como base. Estilo moderno e limpo, com composição publicitária. Adicione um título curto e impactante: [TEXTO DO TÍTULO]. Adicione um subtítulo: [TEXTO DO SUBTÍTULO]. Inclua um botão/CTA com o texto: [CTA]. Layout equilibrado, legibilidade alta, sem poluição visual.',
    expectedAttachments: '1 imagem (base)',
    icon: '🎨'
  },
  {
    id: 'interior',
    title: 'Design de interiores',
    subtitle: 'Simule decoração e estilo no ambiente com resultado realista.',
    promptBase: 'Faça uma simulação de design de interiores neste ambiente. Aplique o estilo: [ESTILO DESEJADO]. Mantenha a arquitetura do cômodo, ajuste mobiliário e decoração de forma realista, preservando perspectiva, iluminação e proporções. Resultado com aparência fotográfica.',
    expectedAttachments: '1 imagem (ambiente)',
    icon: '🏠'
  }
]

export const FREE_MODE_PRESET = {
  id: 'free',
  title: 'Modo livre',
  subtitle: 'Crie seu próprio prompt personalizado',
  icon: '✏️'
}
