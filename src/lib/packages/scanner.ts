import fs from 'fs'
import path from 'path'

export interface PackageData {
  id: string
  name: string
  category: string
  description: string
  promptCount: number
  previewImages: string[]
  price: number
  isPremium: boolean
  estimatedTime: string
  popularity: number
  rating: number
  uses: number
  tags: string[]
  features: string[]
  userStatus: { activated: boolean; status: null }
}

// Package metadata based on the directory structure
const packageMetadata: Record<string, Omit<PackageData, 'id' | 'previewImages'>> = {
  'quiet-luxury': {
    name: 'Quiet Luxury',
    category: 'PREMIUM',
    description: 'Luxo discreto que prioriza qualidade, design atemporal e minimalismo',
    promptCount: 20,
    price: 400,
    isPremium: true,
    estimatedTime: '3-4 minutos',
    popularity: 92,
    rating: 4.9,
    uses: 8567,
    tags: ['luxury', 'elegante', 'minimalista', 'sofisticado'],
    features: ['20 fotos geradas', 'Estilo luxury', 'Paleta neutra', 'Sofisticação sutil'],
    userStatus: { activated: false, status: null },
    prompts: [
      { text: "Retrato editorial em estilo quiet luxury à beira-mar, pessoa usando suéter de cashmere Loro Piana em tom taupe, lenço de seda Hermès amarrado no pescoço, relógio de ouro minimalista e brisa leve movimentando os fios de cabelo. Luz difusa de fim de tarde, fundo com mar esverdeado e textura cinematográfica realista, atmosfera de elegância serena e sofisticação natural", style: "photographic" },
      { text: "Pessoa encostada em uma varanda de madeira com vista para o oceano, vestindo camisa branca de linho Brunello Cucinelli e calça bege de alfaiataria leve. Luz dourada filtrada pelo céu nublado, textura de tecido orgânico, composição editorial equilibrada e atmosfera de luxo discreto e introspecção", style: "photographic" },
      { text: "Retrato em estilo fine-art no interior de uma casa costeira minimalista, suéter Loro Piana de lã extrafina, pulseira de ouro delicada Cartier e fundo desfocado com janelas amplas. Iluminação natural suave, paleta neutra e atmosfera de requinte silencioso e conforto moderno", style: "photographic" },
      { text: "Pessoa caminhando por estrada costeira em carro conversível Maserati vintage, suéter de caxemira cinza-claro e lenço de seda Hermès esvoaçante ao vento. Luz dourada da tarde refletindo na lataria, flare natural e composição cinematográfica, atmosfera de liberdade sofisticada", style: "cinematic" },
      { text: "Retrato editorial com pessoa sentada em banco de couro claro em ambiente moderno, blazer de cashmere Brunello Cucinelli, relógio Patek Philippe e tons terrosos. Luz lateral suave projetando sombras elegantes, textura de filme analógico e atmosfera de poder calmo e refinamento", style: "photographic" },
      { text: "Pessoa em um iate ancorado na Costa Amalfitana, camisa branca de linho The Row, calça creme de algodão egípcio, óculos discretos e luz dourada refletindo no mar. Fundo com falésias distantes, textura cinematográfica realista e sensação de luxo leve e natural", style: "cinematic" },
      { text: "Retrato em plano médio com pessoa apoiada em corrimão de varanda, usando suéter bege de caxemira Loro Piana e lenço Hermès drapeado sobre o ombro. Céu parcialmente nublado e luz suave filtrada, textura orgânica e atmosfera de elegância tranquila e calor humano", style: "photographic" },
      { text: "Pessoa caminhando por campo aberto ao entardecer, casaco longo de lã Brunello Cucinelli e botas de couro Bottega Veneta. Luz dourada atravessando o tecido, flare natural e composição editorial de tom cinematográfico, atmosfera de introspecção e luxo atemporal", style: "cinematic" },
      { text: "Retrato de pessoa sentada em uma mesa de madeira clara, copo de vinho branco e fundo com vista para o mar, suéter fino de cashmere Loro Piana e relógio vintage Vacheron Constantin. Luz lateral dourada, textura de filme leve e atmosfera de contemplação elegante", style: "photographic" },
      { text: "Pessoa encostada em carro esportivo Aston Martin, vestindo camisa de algodão Ralph Lauren Purple Label e blazer de linho leve. Reflexos quentes do pôr do sol no metal e flare sutil na lente, composição cinematográfica, atmosfera de luxo silencioso e confiança serena", style: "cinematic" },
      { text: "Retrato com pessoa em ambiente interno iluminado por luz natural suave, suéter de lã merino e lenço de seda Hermès. Paleta monocromática de tons areia e caramelo, textura realista e atmosfera de sofisticação calma e conforto visual", style: "photographic" },
      { text: "Pessoa caminhando em marina com barcos de luxo ao fundo, calça branca de algodão Loro Piana e camisa bege de linho. Luz suave refletindo nas superfícies aquáticas, composição com profundidade e textura cinematográfica, atmosfera de tranquilidade e elegância mediterrânea", style: "photographic" },
      { text: "Retrato editorial no interior de uma casa de praia minimalista, luz suave entrando pelas janelas, pessoa com suéter de cashmere leve, pulseira dourada Cartier e taça de vinho branco sobre mesa de pedra. Textura cinematográfica naturalista, atmosfera de conforto sofisticado e discrição", style: "photographic" },
      { text: "Pessoa reclinada em sofá de couro caramelo, blusa de seda The Row, colar fino e relógio de pulseira marrom Hermès. Luz lateral quente e textura analógica de grão fino, paleta neutra e atmosfera de luxo silencioso e introspecção", style: "photographic" },
      { text: "Retrato ao ar livre na Toscana, pessoa usando suéter leve de caxemira Loro Piana e calça de linho branco, fundo com colinas e vinhedos dourados. Luz dourada de fim de tarde, textura cinematográfica e atmosfera de harmonia e sofisticação rural elegante", style: "cinematic" },
      { text: "Pessoa observando o mar da sacada de um hotel cinco estrelas, suéter bege de cashmere Brunello Cucinelli e lenço Hermès de seda creme. Reflexos de luz dourada nas janelas, textura fotográfica orgânica e atmosfera de luxo europeu discreto e refinado", style: "photographic" },
      { text: "Retrato em ambiente urbano sofisticado, pessoa de pé ao lado de um Range Rover cinza-prata, blazer de cashmere, camisa branca e calça neutra. Luz difusa de fim de tarde, composição editorial equilibrada e atmosfera de elegância moderna e poder contido", style: "photographic" },
      { text: "Pessoa lendo um livro em terraço com vista para o Lago de Como, suéter leve de lã Brunello Cucinelli, óculos de armação dourada, pulseira minimalista e xícara de café sobre mesa de mármore. Luz natural filtrada, textura cinematográfica e atmosfera de paz e luxo intelectual", style: "photographic" },
      { text: "Retrato fine-art em jardim costeiro, pessoa com cardigã de cashmere Loro Piana, lenço Hermès e relógio Cartier Tank. Fundo com vegetação e mar ao longe, luz difusa e textura suave, atmosfera de nostalgia e refinamento atemporal", style: "photographic" },
      { text: "Pessoa caminhando lentamente por passarela de madeira na costa francesa, suéter de lã merino, lenço Hermès de tons neutros e calça off-white. Luz suave dourada refletindo no mar, flare natural, composição editorial realista e atmosfera de luxo silencioso e naturalidade absoluta", style: "photographic" }
    ]
  },
  'executive-minimalist': {
    name: 'Executive Minimalist',
    category: 'PREMIUM',
    description: 'Elegância corporativa com linhas limpas, poder silencioso e liderança moderna',
    promptCount: 20,
    price: 400,
    isPremium: true,
    estimatedTime: '3-4 minutos',
    popularity: 88,
    rating: 4.7,
    uses: 6234,
    tags: ['executivo', 'minimalista', 'profissional', 'moderno'],
    features: ['20 fotos geradas', 'Estilo corporativo', 'Looks minimalistas', 'Alta qualidade'],
    userStatus: { activated: false, status: null },
    prompts: [
      { text: "Retrato editorial em estilo executive minimalist, pessoa em pé diante de janelas panorâmicas de prédio corporativo ao pôr do sol, luz lateral quente atravessando o vidro e criando reflexos dourados sutis no traje formal. Fundo urbano desfocado com skyline iluminado, flare leve e textura de filme analógico suave. Lente 85mm f/2.8, contraste equilibrado, atmosfera de liderança tranquila e elegância contemporânea", style: "photographic" },
      { text: "Pessoa em traje executivo posando em um escritório moderno de paredes neutras e design clean, iluminação quente difusa realçando contornos sutis do rosto e do tecido. Reflexos suaves em superfícies metálicas e detalhes de madeira clara ao fundo. Estilo realista-fine-art, foco no sujeito, fundo suavemente desfocado, atmosfera de autoridade calma e precisão profissional", style: "photographic" },
      { text: "Retrato editorial de pessoa diante de parede de vidro com skyline ao entardecer, tons de dourado e azul se fundindo no horizonte. Iluminação lateral cinematográfica delineando o contorno do terno e criando flare suave. Textura realista de tecido, profundidade de campo rasa, plano médio, composição simétrica e atmosfera de poder silencioso e confiança serena", style: "cinematic" },
      { text: "Pessoa sentada em poltrona de couro minimalista próxima a uma janela ampla, luz natural filtrada criando contraste refinado no traje formal escuro. Fundo neutro com móveis de linhas retas e discretas, textura cinematográfica de grão fino. Lente 50mm f/1.8, plano americano, atmosfera de controle emocional e equilíbrio executivo", style: "photographic" },
      { text: "Pessoa ajustando o paletó em frente a janelas envidraçadas, luz dourada do pôr do sol refletindo no vidro, flare diagonal natural. Enquadramento em plano médio editorial, textura detalhada de tecido e pele, paleta quente e realista. Estilo fine-art corporativo, atmosfera de foco, precisão e serenidade", style: "photographic" },
      { text: "Retrato executivo em hall de prédio moderno com paredes de mármore polido e reflexos discretos. Luz difusa realçando os volumes da arquitetura, tons neutros de cinza e bege equilibrando a cena. Traje formal elegante, composição centralizada, profundidade visual com perspectiva de linhas verticais. Atmosfera de luxo discreto e sofisticação calma", style: "photographic" },
      { text: "Pessoa encostada em parede de concreto polido iluminada por luz natural indireta, textura suave e sombras difusas. Traje executivo com corte preciso, foco no equilíbrio de luz e sombra. Estilo realista-minimalista editorial, contraste moderado, lente 85mm f/2.8, atmosfera de disciplina e refinamento moderno", style: "photographic" },
      { text: "Cena corporativa diante de janelas com skyline urbano distante, luz do entardecer refletindo nos vidros, flare sutil e tons quentes banhando o traje formal. Fundo desfocado e textura cinematográfica, composição com profundidade em três planos, atmosfera de autoridade introspectiva e poder tranquilo", style: "cinematic" },
      { text: "Pessoa sentada à mesa de madeira clara com notebook fechado e papéis organizados, luz suave atravessando cortina translúcida. Fundo limpo e tonalidade quente equilibrada, textura realista de superfície e foco no rosto. Estilo fine-art corporativo, contraste leve e sensação de concentração e serenidade", style: "photographic" },
      { text: "Pessoa caminhando por corredor corporativo com luz natural intensa vinda de janelas laterais, piso polido refletindo brilho dourado. Composição linear em perspectiva, textura analógica e flare leve. Traje executivo escuro contrastando com ambiente neutro. Estilo cinematográfico, atmosfera de propósito, foco e liderança", style: "cinematic" },
      { text: "Pessoa diante de parede de vidro com vista panorâmica da cidade, iluminação dourada do pôr do sol criando halo ao redor da silhueta. Lente 85mm f/2, plano americano, fundo levemente desfocado e textura de filme. Paleta quente e equilibrada, atmosfera de autoconfiança e autoridade silenciosa", style: "photographic" },
      { text: "Retrato editorial em ambiente minimalista de arquitetura limpa, linhas geométricas e tons bege e cinza. Luz difusa lateral, sombras suaves, textura realista e profundidade natural. Enquadramento médio, traje executivo estruturado, atmosfera de elegância discreta e clareza mental", style: "photographic" },
      { text: "Pessoa próxima a janela com cortina translúcida, luz dourada filtrada criando contraste delicado sobre o traje formal. Reflexos suaves e textura orgânica do tecido visível em detalhe. Paleta neutra e estilo cinematográfico editorial, profundidade rasa e atmosfera de refinamento e serenidade", style: "cinematic" },
      { text: "Pessoa em biblioteca corporativa com prateleiras de madeira escura, iluminação focal quente, composição com perspectiva lateral. Textura cinematográfica realista, traje executivo bem ajustado, planos equilibrados e atmosfera de cultura, liderança e concentração", style: "photographic" },
      { text: "Pessoa em varanda de prédio corporativo durante golden hour, luz dourada atravessando o vidro e refletindo no traje. Skyline distante parcialmente desfocado, flare leve e textura cinematográfica natural. Lente 85mm f/2.8, contraste controlado e atmosfera de visão estratégica e inspiração", style: "cinematic" },
      { text: "Pessoa sentada em cadeira de design moderno em escritório minimalista, superfícies de madeira clara e concreto polido ao redor. Luz difusa de fim de tarde iluminando parcialmente o rosto, composição centralizada com profundidade suave. Estilo editorial fine-art, atmosfera de controle e harmonia", style: "photographic" },
      { text: "Pessoa ajustando gravata diante de espelho de vidro escuro, reflexos sutis e flare suave, luz quente incidindo lateralmente. Plano médio com textura de filme leve, cores neutras e fundo difuso. Atmosfera de autoconfiança, precisão e elegância contida", style: "photographic" },
      { text: "Pessoa em pé diante de parede de mármore branco iluminada por luz natural dourada, sombras diagonais criando contraste artístico. Lente 50mm f/1.8, textura fina e composição clean. Paleta quente minimalista, atmosfera de calma assertiva e sofisticação contemporânea", style: "photographic" },
      { text: "Retrato editorial de pessoa junto a mesa executiva de madeira nobre, skyline refletido no vidro atrás. Luz lateral quente delineando o contorno, flare suave e textura cinematográfica realista. Plano americano, contraste médio e atmosfera de poder tranquilo e refinamento moderno", style: "cinematic" },
      { text: "Pessoa parada em sala de reuniões moderna com linhas arquitetônicas retas e mobiliário clean. Luz natural difusa vinda do teto e paredes de vidro, paleta fria equilibrada por reflexos quentes. Lente 85mm f/2.8, composição centrada, textura suave e atmosfera de liderança focada e serenidade executiva", style: "photographic" }
    ]
  },
  'nomade': {
    name: 'Wanderlust',
    category: 'LIFESTYLE',
    description: 'Espírito livre do nômade digital explorando o mundo com propósito e estilo',
    promptCount: 5,
    price: 200,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 85,
    rating: 4.6,
    uses: 4321,
    tags: ['nomade', 'viagem', 'aventura', 'digital'],
    features: ['20 fotos geradas', 'Cenários de viagem', 'Lifestyle nômade', 'Inspiração wanderlust'],
    userStatus: { activated: false, status: null }
  },
  'fitness-aesthetic': {
    name: 'Fitness Aesthetic',
    category: 'LIFESTYLE',
    description: 'Força, disciplina e bem-estar em uma estética fitness inspiradora e motivacional',
    promptCount: 5,
    price: 300,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 82,
    rating: 4.5,
    uses: 3876,
    tags: ['fitness', 'aesthetic', 'saúde', 'motivacional'],
    features: ['20 fotos geradas', 'Looks fitness', 'Ambientes de treino', 'Inspiração healthy'],
    userStatus: { activated: false, status: null }
  },
  'conceitual': {
    name: 'Conceitual',
    category: 'PREMIUM',
    description: 'Fotografia artística que transcende o comum com conceitos visuais únicos',
    promptCount: 5,
    price: 400,
    isPremium: true,
    estimatedTime: '4-5 minutos',
    popularity: 79,
    rating: 4.8,
    uses: 2156,
    tags: ['conceitual', 'artístico', 'experimental', 'único'],
    features: ['20 fotos geradas', 'Arte conceitual', 'Composições únicas', 'Estilo experimental'],
    userStatus: { activated: false, status: null }
  },
  'mirror-selfie': {
    name: 'Mirror Selfie',
    category: 'LIFESTYLE',
    description: 'Autorretratos espontâneos no espelho com autenticidade e estilo aesthetic',
    promptCount: 5,
    price: 200,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 91,
    rating: 4.4,
    uses: 7890,
    tags: ['selfie', 'espelho', 'aesthetic', 'natural'],
    features: ['20 fotos geradas', 'Poses naturais', 'Reflexos perfeitos', 'Estilo casual'],
    userStatus: { activated: false, status: null }
  },
  'rebel': {
    name: 'Rebel',
    category: 'CREATIVE',
    description: 'Atitude sem medo, estilo alternativo e expressão autêntica de personalidade',
    promptCount: 5,
    price: 200,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 77,
    rating: 4.3,
    uses: 3456,
    tags: ['rebelde', 'alternativo', 'attitude', 'forte'],
    features: ['20 fotos geradas', 'Looks alternativos', 'Poses com attitude', 'Estilo único'],
    userStatus: { activated: false, status: null }
  },
  'urban': {
    name: 'Urban',
    category: 'LIFESTYLE',
    description: 'Energia das grandes cidades com estilo streetwear e cultura urbana autêntica',
    promptCount: 5,
    price: 200,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 88,
    rating: 4.7,
    uses: 6234,
    tags: ['urbano', 'moderno', 'street', 'contemporâneo'],
    features: ['20 fotos geradas', 'Estilo urbano', 'Cenários de rua', 'Look despojado'],
    userStatus: { activated: false, status: null }
  },
  'soft-power': {
    name: 'Soft Power',
    category: 'PROFESSIONAL',
    description: 'Força suave, elegância com propósito e liderança gentil',
    promptCount: 5,
    price: 350,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 86,
    rating: 4.8,
    uses: 5123,
    tags: ['feminino', 'elegante', 'força', 'suave'],
    features: ['20 fotos geradas', 'Empoderamento feminino', 'Elegância natural', 'Força sutil'],
    userStatus: { activated: false, status: null }
  },
  'neo-casual': {
    name: 'Neo Casual',
    category: 'LIFESTYLE',
    description: 'Conforto contemporâneo que une casualidade com sofisticação moderna',
    promptCount: 5,
    price: 200,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 84,
    rating: 4.5,
    uses: 4567,
    tags: ['casual', 'moderno', 'descontraído', 'contemporâneo'],
    features: ['20 fotos geradas', 'Looks casuais', 'Estilo relaxado', 'Modernidade'],
    userStatus: { activated: false, status: null }
  },
  'flight-mode': {
    name: 'Flight Mode',
    category: 'LIFESTYLE',
    description: 'Lifestyle jet setter com estética de aeroportos e destinos ao redor do mundo',
    promptCount: 5,
    price: 200,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 80,
    rating: 4.6,
    uses: 3789,
    tags: ['viagem', 'aeroporto', 'aventura', 'mundo'],
    features: ['20 fotos geradas', 'Cenários de viagem', 'Estilo jet set', 'Inspiração wanderlust'],
    userStatus: { activated: false, status: null }
  },
  'summer-vibes': {
    name: 'Summer Vibes',
    category: 'LIFESTYLE',
    description: 'Sol, praia e energia tropical em momentos inesquecíveis de verão',
    promptCount: 20,
    price: 300,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 93,
    rating: 4.7,
    uses: 8901,
    tags: ['verão', 'praia', 'tropical', 'férias'],
    features: ['20 fotos geradas', 'Cenários paradisíacos', 'Looks de verão', 'Vibe relaxante'],
    userStatus: { activated: false, status: null },
    prompts: [
      { text: "Retrato em estilo summer vibes na Praia de Ipanema, pessoa deitada na areia fina sob luz solar intensa, chapéu de palha largo projetando sombra sobre o rosto, livro aberto ao lado e reflexos dourados na pele. Fundo com mar azul turquesa e o Morro Dois Irmãos ao longe, textura cinematográfica realista e atmosfera de calor, liberdade e elegância tropical", style: "photographic" },
      { text: "Cena ensolarada na Costa Amalfitana, pessoa caminhando por uma praia de pedras claras, luz dourada refletindo no mar cristalino e nas fachadas coloridas das casas. Chapéu de palha e bolsa de palha, brisa leve movendo o tecido, composição editorial realista, tons quentes e sensação de sofisticação costeira", style: "photographic" },
      { text: "Retrato em Capri, pessoa relaxando sobre toalha listrada ao lado de guarda-sol vintage, mar azul intenso e falésias de pedra branca ao fundo. Luz natural filtrada, reflexos de água na pele, textura de filme leve e atmosfera de férias mediterrâneas e charme despreocupado", style: "photographic" },
      { text: "Pessoa sentada à beira-mar em Positano, luz dourada do fim da tarde iluminando a costa vertical com casas coloridas, flare suave e textura orgânica da areia grossa. Traje de praia elegante, composição simétrica e atmosfera de relaxamento e beleza natural", style: "photographic" },
      { text: "Retrato cinematográfico na Praia do Arpoador ao entardecer, mar calmo com reflexos laranja e rosa, chapéu de palha largo sombreando parcialmente o rosto. Lente 85mm f/2.8, textura analógica, cores quentes e atmosfera de leveza e charme carioca", style: "cinematic" },
      { text: "Pessoa caminhando nas areias brancas de Bora Bora, céu cristalino e mar translúcido refletindo o sol. Reflexos na pele, flare natural e composição ampla com fundo de palmeiras e bangalôs sobre a água. Estilo realista fine-art, sensação de liberdade e paraíso tropical", style: "photographic" },
      { text: "Retrato editorial na Praia de Copacabana, ondas suaves e céu azul intenso, calçadão icônico visível ao fundo, luz natural forte criando sombras suaves e textura realista de areia. Paleta vibrante e atmosfera de alegria e espontaneidade urbana", style: "photographic" },
      { text: "Pessoa descansando em cadeira de praia na Riviera Francesa, mar azul profundo e horizonte limpo, guarda-sol branco e dourado projetando sombras geométricas. Luz natural difusa, composição refinada e atmosfera de luxo discreto e tranquilidade costeira", style: "photographic" },
      { text: "Cena cinematográfica nas praias de Mykonos, vento leve movendo o chapéu de palha, luz branca refletida na arquitetura grega ao fundo, mar azul elétrico e areia clara. Textura fotográfica natural, contraste equilibrado e atmosfera de verão mediterrâneo vibrante", style: "cinematic" },
      { text: "Pessoa caminhando pelas margens da Praia do Leblon, luz dourada refletindo nas ondas, sombra longa projetada sobre a areia úmida. Lente 50mm f/1.8, textura cinematográfica suave e atmosfera de paz, rotina e estilo natural carioca", style: "photographic" },
      { text: "Retrato na Praia da Costa Smeralda, Sardenha, mar esmeralda e rochedos de granito rosa ao fundo, reflexos solares cintilando na água, traje leve e chapéu naturalista. Composição ampla, textura de filme e atmosfera de verão sofisticado e sereno", style: "photographic" },
      { text: "Pessoa lendo sob guarda-sol em Saint-Tropez, luz dourada atravessando o tecido e criando manchas de luz sobre a pele. Fundo com iates e horizonte azul, flare suave e textura orgânica, estética editorial e sensação de prazer leve e luxo solar", style: "photographic" },
      { text: "Retrato próximo à Praia da Ferradura, Búzios, céu límpido e mar verde-esmeralda refletindo o sol. Areia clara e rochas ao fundo, luz lateral quente, textura cinematográfica naturalista e atmosfera de calma e sofisticação tropical brasileira", style: "photographic" },
      { text: "Pessoa reclinada em espreguiçadeira na Praia de Taormina, Sicília, vista panorâmica do Mediterrâneo ao fundo, luz quente e sombras sutis das palmeiras. Paleta quente e dourada, textura realista e atmosfera de tranquilidade e elegância italiana", style: "photographic" },
      { text: "Cena ensolarada na Praia de Trancoso, Bahia, céu azul profundo e coqueiros ao fundo, pessoa sentada em toalha de algodão rústico, livro aberto e reflexos dourados na pele. Lente 85mm f/2.8, flare suave e atmosfera de paz e autenticidade tropical", style: "photographic" },
      { text: "Retrato editorial na Praia de Amalfi, falésias majestosas refletindo tons dourados, mar vibrante e guarda-sol listrado em primeiro plano. Luz natural intensa, textura realista e atmosfera de cinema italiano e charme mediterrâneo", style: "photographic" },
      { text: "Pessoa mergulhando parcialmente no mar de Fernando de Noronha, água cristalina refletindo a luz solar, bolhas douradas subindo em primeiro plano, fundo difuso azul-turquesa, textura cinematográfica e atmosfera de liberdade natural e conexão com o oceano", style: "cinematic" },
      { text: "Retrato em Ibiza, luz dourada do pôr do sol banhando o horizonte, reflexos metálicos na água, flare forte controlado. Pessoa deitada na areia úmida com textura realista, tons quentes e sensação de energia e descontração boêmia", style: "photographic" },
      { text: "Pessoa caminhando pela praia de Tulum, areia branca e mar translúcido, reflexos de sol atravessando folhas de palmeira. Lente 50mm f/1.8, composição com profundidade e textura orgânica, atmosfera espiritual e vibração natural do Caribe", style: "photographic" },
      { text: "Retrato cinematográfico na Praia da Urca, Rio de Janeiro, sol dourado refletindo no Pão de Açúcar ao fundo, luz lateral quente iluminando o rosto parcialmente sombreado por chapéu de palha. Textura de filme analógica, contraste suave e atmosfera de tranquilidade e sofisticação tropical urbana", style: "cinematic" }
    ]
  },
  'golden-hour': {
    name: 'Golden Hour',
    category: 'CREATIVE',
    description: 'Magia da luz dourada que transforma momentos comuns em arte cinematográfica',
    promptCount: 20,
    price: 350,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 89,
    rating: 4.9,
    uses: 6745,
    tags: ['dourado', 'pôr-do-sol', 'mágico', 'luz'],
    features: ['20 fotos geradas', 'Luz natural perfeita', 'Tons dourados', 'Momentos mágicos'],
    userStatus: { activated: false, status: null },
    prompts: [
      { text: "caminhando lentamente pela praia durante o pôr do sol, ondas suaves refletindo luz dourada e rosada, flare solar sutil na lente 85 mm f/2.8, bokeh suave no horizonte, textura de filme analógico fina, luz lateral quente delineando silhueta e reflexos no mar, atmosfera de tranquilidade e liberdade", style: "photographic" },
      { text: "sentado em uma varanda de madeira com vista para o oceano, cortinas leves balançando ao vento, luz dourada atravessando o ambiente e criando reflexos quentes sobre superfícies de vidro e tecido, estilo editorial-fine-art, profundidade de campo rasa, composição equilibrada e atmosfera de introspecção serena", style: "photographic" },
      { text: "de pé em um campo de trigo dourado, vento leve movendo as espigas iluminadas pelo sol poente, flare natural atravessando o quadro, tons âmbar e cobre em textura cinematográfica, lente 50 mm f/1.4 com foco no sujeito, fundo difuso e atmosfera de natureza viva e contemplação", style: "cinematic" },
      { text: "encostado em um carro clássico à beira-mar, reflexos quentes sobre o metal cromado, sol baixo criando linhas de luz sobre o corpo e o horizonte, textura de filme vintage com contraste suave, plano americano cinematográfico, atmosfera nostálgica e sofisticada", style: "cinematic" },
      { text: "caminhando entre oliveiras antigas sob luz dourada filtrada, sombras longas cruzando o gramado, folhas iluminadas por trás criando halo natural, profundidade de campo rasa, textura orgânica e paleta quente-terrosa, sensação de conexão e serenidade mediterrânea", style: "photographic" },
      { text: "sentado à beira de uma piscina moderna, pés tocando a água que reflete o céu alaranjado, reflexos dourados ondulando na superfície, composição simétrica com ângulo baixo, lente 85 mm f/2.8, textura de filme suave e atmosfera de elegância descontraída e calor sutil", style: "photographic" },
      { text: "caminhando por uma estrada rural, horizonte em chamas com tons alaranjados e roxos, flare cinematográfico cruzando a lente, poeira leve iluminada pelo sol, profundidade de campo gradual, textura de grão fino, sensação de viagem, liberdade e movimento", style: "cinematic" },
      { text: "próximo a um penhasco de frente para o mar, vento leve movimentando o tecido da roupa, luz dourada lateral sobre o rosto, composição equilibrada com plano de fundo distante em desfoque suave, textura fine-art e atmosfera contemplativa e poderosa", style: "photographic" },
      { text: "sentado em um píer de madeira, reflexos dourados dançando sobre a água, flare diagonal entrando pela lente 50 mm f/2, fundo difuso e textura analógica, composição centrada, atmosfera de silêncio e conexão emocional com o ambiente", style: "photographic" },
      { text: "caminhando por ruas de paralelepípedo de uma vila mediterrânea, fachadas brancas banhadas em luz dourada, contraste suave de sombras longas, ângulo de câmera médio com perspectiva em fuga, textura orgânica e sensação de nostalgia e leveza", style: "photographic" },
      { text: "em um campo de lavanda sob o pôr do sol, flores violetas refletindo tons alaranjados e rosados, foco no sujeito e fundo difuso com flare suave, textura cinematográfica rica, composição equilibrada e atmosfera poética de calmaria", style: "cinematic" },
      { text: "sentado em um rooftop urbano, horizonte refletindo tons quentes sobre os prédios de vidro, reflexos dourados e flare leve na lente 85 mm, textura analógica com contraste médio, composição editorial contemporânea e clima de introspecção urbana", style: "photographic" },
      { text: "caminhando por um jardim tropical iluminado pelo sol poente, reflexos dourados nas folhas e flores, tons verdes equilibrados com laranja suave, textura naturalista-fine-art, plano médio e atmosfera de frescor e vitalidade", style: "photographic" },
      { text: "à beira de um lago calmo refletindo o céu dourado, névoa leve sobre a superfície, foco no sujeito com reflexo visível na água, profundidade de campo rasa, textura cinematográfica realista, atmosfera de paz e contemplação", style: "cinematic" },
      { text: "sentado em uma escadaria de pedra antiga, luz do entardecer criando diagonais de sombra, textura rica de superfície, lente 85 mm f/1.8, contraste suave e tons quentes, composição editorial clássica e sensação de quietude e elegância", style: "photographic" },
      { text: "caminhando ao lado de uma cerca de madeira em campo aberto, flare natural atravessando a lente, sol atrás criando halo luminoso, profundidade suave e textura de filme Kodak Portra 400, composição documental realista e atmosfera de liberdade", style: "photographic" },
      { text: "em uma varanda com vista para montanhas ao pôr do sol, luz lateral dourada aquecendo o ambiente, copo de bebida sobre a mesa refletindo a luz, textura fina-art e contraste quente, composição cinematográfica equilibrada e atmosfera relaxada e sofisticada", style: "cinematic" },
      { text: "sentado em uma rocha à beira do mar, ondas suaves batendo e refletindo o céu laranja-púrpura, flare intenso cruzando o quadro, textura de filme analógico e profundidade gradual, estilo realista-cinematográfico, sensação de liberdade e introspecção", style: "cinematic" },
      { text: "caminhando em meio a um campo de girassóis dourados, sol poente filtrando-se entre as pétalas, flare diagonal e textura de cor quente, foco no sujeito com fundo desfocado, composição ampla e atmosfera otimista e vibrante", style: "photographic" },
      { text: "parado em dunas douradas com o sol baixo atrás, textura de areia iluminada e contornos bem definidos, bokeh sutil no horizonte, tom quente-aveludado, flare natural, composição ampla e sensação de isolamento elegante e liberdade silenciosa", style: "photographic" }
    ]
  },
  'vintage': {
    name: 'Vintage',
    category: 'CREATIVE',
    description: 'Nostalgia visual com estética retrô, grão de filme e charme atemporal',
    promptCount: 5,
    price: 350,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 76,
    rating: 4.4,
    uses: 4234,
    tags: ['vintage', 'retrô', 'nostálgico', 'passado'],
    features: ['20 fotos geradas', 'Filtros vintage', 'Estética retrô', 'Nostalgia'],
    userStatus: { activated: false, status: null }
  },
  'comic-book': {
    name: 'Comic Book',
    category: 'CREATIVE',
    description: 'Transformação em quadrinhos com cores vibrantes, contornos marcados e estilo HQ',
    promptCount: 5,
    price: 200,
    isPremium: false,
    estimatedTime: '4-5 minutos',
    popularity: 73,
    rating: 4.2,
    uses: 2890,
    tags: ['quadrinhos', 'hq', 'arte', 'pop-art'],
    features: ['20 fotos geradas', 'Estilo quadrinhos', 'Cores vibrantes', 'Arte pop'],
    userStatus: { activated: false, status: null }
  },
  'food-mood': {
    name: 'Food Mood',
    category: 'LIFESTYLE',
    description: 'Experiências gastronômicas que celebram sabores, aromas e momentos à mesa',
    promptCount: 5,
    price: 200,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 81,
    rating: 4.5,
    uses: 5432,
    tags: ['culinária', 'gastronomia', 'mesa', 'sabor'],
    features: ['20 fotos geradas', 'Cenários gastronômicos', 'Food styling', 'Momentos à mesa'],
    userStatus: { activated: false, status: null }
  },
  'outfit': {
    name: 'Outfit',
    category: 'FASHION',
    description: 'Composições fashion coordenadas que destacam estilo e personalidade',
    promptCount: 5,
    price: 300,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 87,
    rating: 4.6,
    uses: 6789,
    tags: ['moda', 'coordenado', 'estilo', 'fashion'],
    features: ['20 fotos geradas', 'Looks coordenados', 'Styling profissional', 'Tendências'],
    userStatus: { activated: false, status: null }
  },
  '2000s-cam': {
    name: '2000s Cam',
    category: 'CREATIVE',
    description: 'Estética Y2K com flash frontal, baixa resolução e nostalgia dos anos 2000',
    promptCount: 4,
    price: 200,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 78,
    rating: 4.3,
    uses: 3987,
    tags: ['y2k', '2000s', 'digital', 'nostálgico'],
    features: ['4 fotos geradas', 'Estética Y2K', 'Digital cam aesthetic', 'Nostalgia 2000s'],
    userStatus: { activated: false, status: null },
    prompts: [
      { text: "A stylish individual sitting at a round outdoor café table at dusk, holding a small espresso cup with faint steam rising, sunglasses resting beside the cup. The subject wears early 2000s urban fashion — black blazer over a cropped top, mini skirt, and white sneakers — illuminated by the distinct flash of a compact digital camera. The background shows an empty boulevard with glowing street lamps, cars slightly blurred in motion, and pastel twilight sky gradients of pink and blue. The image includes a yellow digital timestamp overlay in the bottom-right corner displaying '12 JUN 2001 | 19:44', and a small battery icon indicator typical of early 2000s digital cameras. The photo has mild chromatic noise, flat shadows, and reflective textures on the table surface. Composition is clean and cinematic, with realistic lens flare from the flash and soft reflections from nearby glass and metal surfaces. The tone conveys calm confidence and nostalgic evening ambiance. camera: 35mm compact digital, on-camera flash, ISO 320 lighting: dusk ambient + direct flash color_grade: warm highlights, cool twilight shadows, nostalgic digital tint composition: centered portrait, eye-level framing, timestamp overlay in bottom-right corner depth: foreground table and coffee cup → middle ground subject → background city lights mood: calm, confident, nostalgic evening style: early 2000s compact digital camera realism textures: reflective metal, smooth plastic, faint chromatic noise, timestamp and battery overlay rendered authentically", style: "photographic" },
      { text: "A confident individual in a tailored vintage blue suit stands beside a glowing jukebox in a crowded nightclub, embodying the vibrant energy of early 2000s nightlife. The compact digital camera flash creates sharp frontal lighting, emphasizing reflective surfaces and colorful highlights on the jukebox chrome. The crowd behind dances under dim disco lights and a silver mirror ball scattering small reflections across the floor. The image includes a digital timestamp overlay '01.01.2003 | 23:57' with a red battery icon, softly glowing over a slightly grainy image texture. The composition captures nostalgic charm, realistic shadows, and lens softness typical of early 2000s point-and-shoot cameras, with mild vignetting and color fringing at the edges. The tone feels cinematic, retro, and playful, celebrating Y2K nightlife aesthetics. camera: compact digital, 28mm, ISO 400, flash enabled lighting: mixed club ambient + direct camera flash color_grade: blue-magenta tint with high contrast and saturated highlights composition: centered full-body framing, timestamp overlay in corner depth: foreground jukebox → subject → blurred dancing crowd mood: energetic, confident, retro club atmosphere style: Y2K nightlife captured through early 2000s digital lens textures: glowing jukebox chrome, reflective suit fabric, disco light speckles, timestamp and red battery overlay", style: "cinematic" },
      { text: "An individual stands under an orange streetlight in an empty parking lot at night, wearing a Y2K-inspired street outfit with a casual jacket and sneakers. The flash of a compact digital camera lights the subject against a deep blue night sky, creating stark contrast and reflective gleam on wet asphalt. The timestamp '06 FEB 2002 | 22:16' appears in yellow pixelated digits at the bottom corner, along with a blinking red battery icon. The air carries faint haze from cold weather, headlights blur in the distance, and the pavement mirrors the orange glow of street lamps. Mild vignetting, high ISO noise, and subtle flash bloom reinforce the early-2000s compact camera look. The scene feels cinematic yet nostalgic — the stillness of night paired with a low-tech digital texture. camera: 28mm compact lens, ISO 800, direct flash lighting: night scene illuminated by sodium vapor streetlights + camera flash color_grade: warm orange glow, cool blue shadows, desaturated tones composition: full-body portrait with timestamp overlay depth: wet pavement reflections in foreground → subject → soft horizon with cars and poles mood: introspective, cinematic, nostalgic style: early 2000s digital compact night photography textures: wet asphalt, light halos, visible grain, timestamp and red battery overlay", style: "cinematic" },
      { text: "A small group of friends laughing inside a dimly lit room decorated with string lights and retro posters. The shot captures spontaneous movement under the burst of a compact camera flash, producing overexposed highlights and mild color bleed. The timestamp '28 NOV 2001 | 21:09' in yellow digits and a low-battery icon appear in the lower corner. The walls have a warm tint from tungsten bulbs, and reflections from plastic cups and glass bottles shimmer slightly. The image has chromatic noise, shallow depth, and uneven exposure — perfectly matching the authentic 'party photo' look from early 2000s digital cameras. The atmosphere is candid, warm, and nostalgic, frozen in time like an old photo memory. camera: handheld compact, flash on, ISO 500 lighting: tungsten interior light + flash color_grade: warm tones, soft saturation, minor overexposure composition: mid-shot candid framing, timestamp overlay depth: cluttered foreground → people in middle → blurred background mood: carefree, friendly, nostalgic realism style: early 2000s digital snapshot with timestamp artifact textures: reflective glass, plastic surfaces, flash glare, visible noise, timestamp and battery overlay", style: "photographic" }
    ]
  },
  'life-aesthetic': {
    name: 'Life Aesthetic',
    category: 'LIFESTYLE',
    description: 'Cotidiano curado com beleza intencional em cada momento do dia',
    promptCount: 5,
    price: 200,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 85,
    rating: 4.7,
    uses: 7234,
    tags: ['lifestyle', 'aesthetic', 'cotidiano', 'especial'],
    features: ['20 fotos geradas', 'Lifestyle curado', 'Momentos aesthetic', 'Inspiração diária'],
    userStatus: { activated: false, status: null }
  },
  'pet-shot': {
    name: 'Pet Shot',
    category: 'LIFESTYLE',
    description: 'Conexão especial com pets em momentos autênticos e cheios de amor',
    promptCount: 5,
    price: 200,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 90,
    rating: 4.8,
    uses: 8456,
    tags: ['pets', 'animais', 'fofo', 'companhia'],
    features: ['20 fotos geradas', 'Momentos com pets', 'Poses naturais', 'Conexão especial'],
    userStatus: { activated: false, status: null }
  },
  'makeup': {
    name: 'Makeup',
    category: 'FASHION',
    description: 'Arte da maquiagem que realça beleza natural e expressa criatividade',
    promptCount: 5,
    price: 200,
    isPremium: false,
    estimatedTime: '3-4 minutos',
    popularity: 83,
    rating: 4.6,
    uses: 5876,
    tags: ['maquiagem', 'beleza', 'transformação', 'visual'],
    features: ['20 fotos geradas', 'Looks de maquiagem', 'Beleza destacada', 'Transformação'],
    userStatus: { activated: false, status: null }
  }
}

export function scanPackagesDirectory(): PackageData[] {
  const packagesDir = path.join(process.cwd(), 'public', 'packages', 'previews')

  if (!fs.existsSync(packagesDir)) {
    console.warn('Packages directory not found:', packagesDir)
    return []
  }

  const packages: PackageData[] = []

  try {
    const packageDirs = fs.readdirSync(packagesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)

    for (const packageId of packageDirs) {
      const packagePath = path.join(packagesDir, packageId)
      const metadata = packageMetadata[packageId]

      if (!metadata) {
        console.warn(`No metadata found for package: ${packageId}`)
        continue
      }

      // Scan for preview images
      const previewImages: string[] = []
      for (let i = 1; i <= 4; i++) {
        const jpgPath = `/packages/previews/${packageId}/preview-${i}.jpg`
        const pngPath = `/packages/previews/${packageId}/preview-${i}.png`

        const jpgFullPath = path.join(process.cwd(), 'public', jpgPath.slice(1))
        const pngFullPath = path.join(process.cwd(), 'public', pngPath.slice(1))

        if (fs.existsSync(jpgFullPath)) {
          previewImages.push(jpgPath)
        } else if (fs.existsSync(pngFullPath)) {
          previewImages.push(pngPath)
        }
      }

      if (previewImages.length > 0) {
        packages.push({
          id: packageId,
          ...metadata,
          previewImages
        })
      } else {
        console.warn(`No preview images found for package: ${packageId}`)
      }
    }

    console.log(`✅ Scanned ${packages.length} packages from directory`)
    return packages
  } catch (error) {
    console.error('Error scanning packages directory:', error)
    return []
  }
}