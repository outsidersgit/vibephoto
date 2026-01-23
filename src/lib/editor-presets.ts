/**
 * Atalhos do Estúdio IA
 * Configuração centralizada para fácil manutenção
 */

export interface EditorPreset {
  id: string
  title: string
  promptBase: string
  instruction: string
}

export const EDITOR_PRESETS: EditorPreset[] = [
  {
    id: 'enhance',
    title: 'Otimizar qualidade da foto',
    promptBase: 'Melhore a qualidade desta imagem mantendo o conteúdo original intacto. Aplique correção profissional de iluminação (ajuste de exposição, balanço de brancos, contraste dinâmico). Aumente a nitidez de forma natural usando técnicas de sharpening seletivo. Reduza ruído digital preservando detalhes finos e textura. Melhore saturação e vibrância das cores de forma balanceada e realista. Corrija aberrações cromáticas e distorções. Preserve a composição original, não adicione nem remova elementos. Resultado final: foto com qualidade profissional, natural e sem artifícios exagerados.',
    instruction: 'Anexe a foto que você quer otimizar'
  },
  {
    id: 'skin-realism',
    title: 'Melhorar pele',
    promptBase: 'Transforme esta foto gerada por IA em uma imagem ultra-realista com foco total na naturalização da pele e traços faciais. Adicione textura de pele humana autêntica: poros visíveis mas sutis, micro-variações de tom, leve vermelhidão natural em maçãs do rosto. Corrija o brilho artificial dos olhos, adicionando reflexos naturais e pequenas imperfeições realistas (veias leves, úmidade natural). Naturalize cabelos: adicione fios soltos, baby hairs, textura individual de cada fio, brilho natural não uniforme. Ajuste lábios para aparência natural: textura, linhas sutis, hidratação realista. Remova aspecto "plástico" ou "perfeito demais" típico de IA. Adicione micro-imperfeições humanas naturais (sardas leves, variações de tom, linhas de expressão sutis onde apropriado). Resultado: foto indistinguível de fotografia real, com todas as imperfeições naturais que provam humanidade.',
    instruction: 'Anexe a foto gerada por IA que você quer naturalizar'
  },
  {
    id: 'fix-hands',
    title: 'Corrigir mãos e pés',
    promptBase: 'Corrija completamente as mãos, dedos e pés (se visíveis) nesta imagem gerada por IA, garantindo anatomia humana perfeita e realista. MÃOS - Regras CRÍTICAS: cada mão tem EXATAMENTE 5 dedos (polegar, indicador, médio, anelar, mínimo). Proporções anatômicas corretas: dedos com 3 falanges (exceto polegar com 2), articulações no lugar certo, tamanho proporcional à mão. Posição natural dos dedos: curvatura realista, ângulos possíveis anatomicamente, sem dedos extras ou fundidos. Textura de pele realista: linhas da palma, rugas dos nós dos dedos, unhas com formato natural e cutícula. PÉS (se visíveis) - Regras: cada pé tem EXATAMENTE 5 dedos, proporções anatômicas corretas, arco plantar natural, tornozelo proporcional. Se não houver mãos ou pés visíveis na imagem, ignore esta instrução e mantenha a imagem original intacta. Iluminação consistente com o resto da imagem. Sombras e profundidade corretas. Remova: dedos extras, dedos fundidos, proporções impossíveis, articulações erradas, posições antinaturais. Resultado: mãos e pés anatomicamente perfeitos, indistinguíveis de foto real.',
    instruction: 'Anexe a foto com mãos ou pés que precisam ser corrigidos'
  },
  {
    id: 'product',
    title: 'Foto de produto',
    promptBase: 'Crie uma foto de produto premium para e-commerce de alta conversão. Use a imagem anexada como referência do produto, mantendo 100% de fidelidade visual (forma exata, proporções, cores, texturas, detalhes e acabamentos). Aplique iluminação de estúdio profissional com softbox (luz principal a 45°, luz de preenchimento suave, backlight sutil para separação do fundo). Fundo limpo e minimalista (branco puro ou gradiente neutro elegante). Sombras suaves e difusas para dar profundidade. Composição centrada com produto em destaque absoluto. Perspectiva frontal levemente superior. Aparência hiper-realista e apetecível. Sem elementos distrativos, foco 100% no produto. Resultado: imagem pronta para marketplace premium.',
    instruction: 'Anexe a foto do produto'
  },
  {
    id: 'try-on',
    title: 'Experimentar roupa',
    promptBase: 'Faça um virtual try-on realista e convincente. Use a primeira imagem (pessoa/modelo) como base da identidade e corpo, e a segunda imagem (roupa/look) como referência da peça a ser vestida. CRÍTICO: preserve 100% a identidade facial, tom de pele, tipo de corpo e proporções da pessoa original. Vista a pessoa com a roupa da segunda imagem, mantendo fidelidade total ao tecido (textura, cor, padrão, caimento). Simule física realista do tecido: vincos naturais, caimento por gravidade, ajuste ao corpo. Preservar iluminação coerente (sombras e reflexos condizentes com ambiente). Manter pose e postura da pessoa original. Transições perfeitas entre corpo e roupa (sem bordas artificiais). Resultado: foto realista como se a pessoa estivesse realmente vestindo aquela roupa.',
    instruction: 'Anexe a foto do modelo e a foto da roupa'
  },
  {
    id: 'banner',
    title: 'Criar banner',
    promptBase: 'Crie um banner publicitário profissional para mídia paga (Facebook Ads, Google Display, Instagram). Use a imagem anexada como elemento visual principal ou background. Estilo moderno, clean e de alta conversão. Adicione hierarquia visual clara. Inclua os seguintes textos (EDITE ENTRE COLCHETES): Título principal (headline): [ESCREVA SEU TÍTULO AQUI - máx 5 palavras]. Subtítulo (subheadline): [ESCREVA SEU SUBTÍTULO AQUI - máx 10 palavras]. Call-to-action (CTA): [ESCREVA SEU CTA AQUI - ex: "Compre Agora", "Saiba Mais"]. Layout equilibrado e respirado, tipografia legível (sans-serif bold para título), contraste alto para leitura fácil, espaçamento generoso, sem poluição visual. Composição que guia o olhar naturalmente do título → subtítulo → CTA. Resultado: criativo pronto para veicular.',
    instruction: 'Anexe a imagem base • ⚠️ Edite o prompt: substitua os textos entre [COLCHETES]'
  },
  {
    id: 'interior',
    title: 'Decorar ambiente',
    promptBase: 'Faça uma simulação fotorrealista de design de interiores. Use a imagem do ambiente atual como base estrutural. EDITE O ESTILO: aplique o estilo decorativo [ESCREVA O ESTILO AQUI - ex: "minimalista escandinavo", "industrial moderno", "boho chic", "clássico elegante"]. IMPORTANTE: mantenha 100% da arquitetura original (paredes, janelas, portas, pé-direito, piso). Substitua ou adicione mobiliário condizente com o estilo escolhido (sofás, mesas, cadeiras, estantes, luminárias). Adicione elementos decorativos coerentes (quadros, plantas, tapetes, almofadas, cortinas). Preserve perspectiva e proporções realistas. Iluminação natural e artificial verossímil. Paleta de cores harmoniosa com o estilo. Resultado: render fotográfico profissional como se fosse um projeto real de arquitetura.',
    instruction: 'Anexe a foto do ambiente • ⚠️ Edite o prompt: substitua [ESCREVA O ESTILO AQUI]'
  }
]

export const FREE_MODE_PRESET = {
  id: 'free',
  title: 'Modo livre'
}
