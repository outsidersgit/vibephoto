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
    id: 'iphone-selfie',
    title: 'Selfie de iPhone',
    promptBase: 'CRÍTICO: Preserve 100% a identidade da pessoa (formato do rosto, traços faciais, cor dos olhos, formato do nariz, boca, estrutura facial, etnia, cor e textura do cabelo). Transforme esta foto em uma selfie autêntica capturada com iPhone 15 Pro. CARACTERÍSTICAS TÉCNICAS OBRIGATÓRIAS: foto tirada com câmera frontal do iPhone 15 Pro (lente ultra-wide 12MP f/2.2), ângulo levemente superior típico de selfie (câmera acima do nível dos olhos), distância de braço estendido (60-70cm), ligeira distorção de perspectiva da lente frontal ultra-wide, profundidade de campo característica de smartphone (foco no rosto, background levemente desfocado mas ainda visível). ILUMINAÇÃO: luz natural suave vinda da frente (janela ou ambiente externo), ou iluminação interna balanceada, processamento computacional de imagem do iPhone (Smart HDR 5, Deep Fusion), cores vibrantes e contrastadas típicas do iPhone, balanço de brancos preciso, exposição otimizada para rosto. COMPOSIÇÃO: pessoa centralizada ou levemente deslocada seguindo regra dos terços, headroom natural de selfie, enquadramento de busto ou meio corpo, pose natural e relaxada típica de selfie casual, expressão autêntica (sorriso natural, olhar direto para câmera ou ligeiramente desviado). DETALHES REALISTAS: textura de pele natural com poros visíveis, cabelo com fios individuais e textura real, reflexo da luz da tela do iPhone nos olhos, micro-imperfeições naturais da pele, iluminação suave no rosto sem flash, sombras suaves e naturais. AMBIENTE: background caseiro, urbano ou externo desfocado mas identificável, iluminação ambiente real e crível, sem elementos artificiais ou cenários impossíveis. NÃO ALTERE: identidade facial, etnia, cor de pele, formato e cor dos olhos, nariz, boca, estrutura óssea, tipo e cor de cabelo, características físicas únicas. Resultado: selfie indistinguível de uma foto real tirada com iPhone, mantendo 100% a pessoa original com aparência natural de autorretrato casual contemporâneo.',
    instruction: 'Anexe a foto da pessoa'
  },
  {
    id: 'skin-realism',
    title: 'Melhorar pele',
    promptBase: 'CRÍTICO: Preserve 100% a identidade da pessoa (formato do rosto, traços faciais, expressão, maquiagem se houver). Melhore APENAS a textura e qualidade da pele mantendo todas as características originais intactas. Adicione textura de pele humana autêntica: poros visíveis mas sutis, micro-variações de tom, leve vermelhidão natural em maçãs do rosto. Se houver maquiagem (batom, sombra, blush, etc), preserve EXATAMENTE como está. Corrija o brilho artificial dos olhos, adicionando reflexos naturais e pequenas imperfeições realistas (veias leves, úmidade natural). Naturalize cabelos: adicione fios soltos, baby hairs, textura individual de cada fio, brilho natural não uniforme. Ajuste textura dos lábios mas mantenha cor e formato originais. Remova apenas o aspecto "plástico" ou "perfeito demais" da pele, sem alterar estrutura facial. Adicione micro-imperfeições humanas naturais (sardas leves se apropriado, variações de tom sutis). NÃO ALTERE: formato do rosto, traços faciais, maquiagem, expressão, identidade da pessoa. Resultado: mesma pessoa com pele naturalizada e textura humana realista.',
    instruction: 'Anexe a foto que você quer melhorar a pele'
  },
  {
    id: 'improve-sharpness',
    title: 'Melhorar nitidez',
    promptBase: 'CRÍTICO: Preserve 100% a identidade, composição e conteúdo original da imagem. Melhore APENAS a nitidez e clareza da foto. Aumente a definição de bordas e contornos. Reduza qualquer desfoque ou suavização excessiva. Melhore os detalhes finos: textura de tecidos, fios de cabelo, poros da pele, texturas de superfícies. Aumente o micro-contraste para maior percepção de profundidade. Corrija aberrações cromáticas se presentes. Remova ruído digital preservando detalhes. Otimize a nitidez de forma natural, sem criar halos ou artefatos artificiais. Mantenha o equilíbrio tonal e cores originais. NÃO ALTERE: composição, enquadramento, iluminação geral, cores, identidade de pessoas, objetos ou cenário. NÃO adicione elementos novos. Resultado: mesma imagem com nitidez e clareza profissional, como se tivesse sido capturada com lente de alta qualidade e foco perfeito.',
    instruction: 'Anexe a foto que você quer melhorar a nitidez'
  },
  {
    id: 'fix-hands',
    title: 'Corrigir mãos e pés',
    promptBase: 'CRÍTICO: Preserve 100% a identidade da pessoa (rosto, traços faciais, corpo, roupa, maquiagem). Corrija APENAS as mãos, dedos e pés (se visíveis), mantendo todo o resto intacto. MÃOS - Regras CRÍTICAS: cada mão tem EXATAMENTE 5 dedos (polegar, indicador, médio, anelar, mínimo). Proporções anatômicas corretas: dedos com 3 falanges (exceto polegar com 2), articulações no lugar certo, tamanho proporcional à mão. Posição natural dos dedos: curvatura realista, ângulos possíveis anatomicamente, sem dedos extras ou fundidos. Textura de pele realista: linhas da palma, rugas dos nós dos dedos, unhas com formato natural e cutícula. PÉS (se visíveis) - Regras: cada pé tem EXATAMENTE 5 dedos, proporções anatômicas corretas, arco plantar natural, tornozelo proporcional. Se não houver mãos ou pés visíveis na imagem, ignore esta instrução e mantenha a imagem original intacta. Iluminação consistente com o resto da imagem. Sombras e profundidade corretas. NÃO ALTERE: rosto, traços faciais, corpo, roupa, maquiagem, fundo, composição. Remova: dedos extras, dedos fundidos, proporções impossíveis, articulações erradas, posições antinaturais. Resultado: mesma pessoa e contexto, com mãos e pés anatomicamente perfeitos.',
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
    id: 'ugc-content',
    title: 'Conteúdo UGC',
    promptBase: 'Crie conteúdo UGC (User-Generated Content) autêntico e realista, como se fosse uma captura espontânea feita por um influenciador digital no celular. PRIMEIRA IMAGEM (se anexada) = pessoa/influencer, preserve 100% a identidade: rosto, traços, tom de pele, cabelo, expressão. IMAGENS SEGUINTES = produto(s) a serem apresentados naturalmente. ESTÉTICA SMARTPHONE: foto tirada com iPhone ou Android moderno (câmera traseira principal 12-48MP), qualidade natural de smartphone (não profissional), leve grain/ruído digital sutil, profundidade de campo natural (foco no rosto/produto, background suavemente desfocado). ILUMINAÇÃO NATURAL: luz de janela, golden hour, ambiente interno com luz natural, sem flash, sem iluminação de estúdio, sombras suaves e orgânicas, exposição balanceada mas não perfeita. COMPOSIÇÃO CASUAL: ângulo levemente inclinado ou imperfeito (não totalmente reto), enquadramento espontâneo, regra dos terços mas não óbvio, pessoa segurando produto de forma natural e relaxada, mão parcialmente visível se segurando celular ou produto. AMBIENTE COTIDIANO: quarto, sala, cozinha, café, parque, rua urbana, cenário identificável e crível, elementos do dia-a-dia no background (plantas, livros, móveis, objetos pessoais), background desfocado mas reconhecível. EXPRESSÃO AUTÊNTICA: sorriso natural (não forçado), olhar direto ou levemente desviado da câmera, linguagem corporal relaxada e genuína, sem pose profissional rígida. INTERAÇÃO COM PRODUTO: pessoa usando, segurando, mostrando ou interagindo naturalmente com o produto, produto integrado à cena de forma orgânica (não apenas exposto), contexto de uso real e cotidiano. IMPERFEIÇÕES INTENCIONAIS: leve motion blur sutil, ângulo não perfeitamente alinhado, iluminação não uniforme, pequenas imperfeições que aumentam autenticidade (fio de cabelo solto, roupa amassada). DETALHES REALISTAS: textura de pele com poros visíveis, cabelo com fios individuais, unhas naturais, micro-expressões faciais, sombras e reflexos coerentes com iluminação ambiente. NÃO FAÇA: iluminação de estúdio, fundo infinito branco, pose profissional, edição pesada, perfeição excessiva, elementos artificiais. SE NÃO HOUVER PESSOA ANEXADA: crie um influencer digital diverso, natural e contemporâneo que combine com o produto e contexto. Resultado: imagem indistinguível de conteúdo real gerado por usuário, autêntica, casual e altamente engajadora para anúncios.',
    instruction: 'Anexe a foto do produto • Opcional: anexe também a foto da pessoa'
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
    promptBase: 'CRÍTICO: Preserve 100% a arquitetura original (paredes, janelas, portas, pé-direito, piso, estrutura). Faça uma simulação fotorrealista de design de interiores mantendo a base estrutural intacta. EDITE O ESTILO: aplique o estilo decorativo [ESCREVA O ESTILO AQUI - ex: "minimalista escandinavo", "industrial moderno", "boho chic", "clássico elegante"]. Substitua ou adicione APENAS mobiliário e decoração condizente com o estilo escolhido (sofás, mesas, cadeiras, estantes, luminárias). Adicione elementos decorativos coerentes (quadros, plantas, tapetes, almofadas, cortinas). Se houver pessoas na imagem: mantenha identidade, posição e características EXATAMENTE como estão. NÃO ALTERE: estrutura arquitetônica, pessoas (se houver), proporções espaciais. Preserve perspectiva e proporções realistas. Iluminação natural e artificial verossímil. Paleta de cores harmoniosa com o estilo. Resultado: render fotográfico profissional do mesmo ambiente com nova decoração.',
    instruction: 'Anexe a foto do ambiente • ⚠️ Edite o prompt: substitua [ESCREVA O ESTILO AQUI]'
  }
]

export const FREE_MODE_PRESET = {
  id: 'free',
  title: 'Modo livre'
}
