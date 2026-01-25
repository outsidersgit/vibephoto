'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Wand2,
  Eye,
  Camera,
  Lightbulb,
  Palette,
  MapPin,
  RotateCcw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { PromptBlock, PromptCategory, BuiltPrompt } from '@/types'
import { getModelGender, getGenderPrefix } from '@/lib/utils/model-gender'

interface PromptBuilderProps {
  onPromptGenerated: (prompt: string) => void
  onGenerate?: () => void
  onLastBlockSelected?: (isSelected: boolean) => void
  modelClass?: string
}

// Contextual tree structure: each style defines its own compatible options
const CONTEXTUAL_OPTIONS = {
  // STEP 1: Style (5 options - starting point)
  style: [
    { id: 'prof', name: 'Profissional', value: 'fotografia corporativa profissional, traje formal executivo, postura confiante e autoritária, enquadramento de busto ou meio corpo, expressão séria e focada' },
    { id: 'casual', name: 'Casual', value: 'fotografia lifestyle casual, roupas informais e confortáveis, pose natural e relaxada, momento espontâneo autêntico, expressão descontraída' },
    { id: 'artistic', name: 'Artístico', value: 'retrato artístico conceitual, composição criativa e experimental, jogo de luzes e sombras, atmosfera dramática e expressiva, profundidade emocional' },
    { id: 'fashion', name: 'Fashion', value: 'editorial de moda high fashion, roupa designer sofisticada, pose elegante e alongada, atitude fashion confiante, styling impecável' },
    { id: 'lifestyle', name: 'Lifestyle', value: 'fotografia lifestyle autêntica, momento cotidiano genuíno, ambiente real e vivido, narrativa visual natural, conexão emocional verdadeira' },
  ],

  // STEP 2: Lighting (contextual per style)
  lighting: {
    prof: [
      { id: 'studio', name: 'Studio', value: 'iluminação de estúdio profissional 3-point lighting, key light suave difusa, fill light equilibrada, rim light de separação, controle total de exposição' },
      { id: 'natural', name: 'Natural', value: 'luz natural suave de janela difusa, temperatura de cor diurna balanceada 5500K, sombras suaves e gradientes naturais, qualidade de luz orgânica' },
      { id: 'soft', name: 'Suave', value: 'iluminação difusa ultra suave com softbox grande, sombras minimizadas, transições suaves de luz para sombra, qualidade de pele flattering' },
    ],
    casual: [
      { id: 'natural', name: 'Natural', value: 'luz ambiente natural disponível, temperatura de cor real do ambiente, sombras orgânicas autênticas, exposição balanceada para cena' },
      { id: 'golden', name: 'Golden Hour', value: 'luz dourada golden hour pré-pôr do sol, temperatura de cor quente 3200K, sombras longas e suaves, contraluz atmosférico, flare natural' },
      { id: 'soft', name: 'Suave', value: 'luz difusa overcast natural, céu nublado como softbox gigante, ausência de sombras duras, iluminação uniforme e suave' },
    ],
    artistic: [
      { id: 'dramatic', name: 'Dramática', value: 'iluminação dramática de alto contraste, chiaroscuro marcante, sombras profundas e recortadas, single light source hard, ratio de 8:1 ou maior' },
      { id: 'natural', name: 'Natural', value: 'luz natural direcional intensa, contraste moderado com sombras definidas, qualidade de luz real e tangível, textura revelada pela luz' },
      { id: 'golden', name: 'Golden Hour', value: 'luz golden hour dramática low angle, raios de luz tangíveis, temperatura quente saturada, contraluz épico com silhueta parcial' },
      { id: 'studio', name: 'Studio', value: 'iluminação de estúdio criativa experimental, gel colors opcionais, padrões de luz controlados, setup não convencional artístico' },
    ],
    fashion: [
      { id: 'studio', name: 'Studio', value: 'iluminação fashion editorial profissional, beauty dish para glamour, strip lights para corpo, iluminação esculpida precisa, contraste controlado médio' },
      { id: 'dramatic', name: 'Dramática', value: 'iluminação fashion dramática de alto impacto, contraste forte editorial, sombras marcantes fashion, luz hard direcional com caráter' },
      { id: 'natural', name: 'Natural', value: 'luz natural fashion location, janela grande como key light, rebatedor sutil, look natural mas polido, exposição para pele perfeita' },
    ],
    lifestyle: [
      { id: 'natural', name: 'Natural', value: 'luz ambiente real do local disponível, mix de luz natural e artificial do ambiente, temperatura de cor real da cena, atmosfera autêntica' },
      { id: 'golden', name: 'Golden Hour', value: 'luz dourada golden hour lifestyle, temperatura quente natural, atmosfera romântica e nostálgica, flare suave orgânico' },
      { id: 'soft', name: 'Suave', value: 'luz natural difusa window light, sombras suaves abertas, exposição gentle, qualidade de luz caseira aconchegante' },
    ],
  },

  // STEP 3: Camera (contextual per style + lighting combination)
  camera: {
    prof: {
      studio: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente prime 85mm f/1.8, distância focal portrait perfeita, compressão facial flattering, bokeh cremoso de fundo, separação de fundo profissional', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/1.4, perspectiva natural não distorcida, versatilidade profissional, campo de visão standard, rendição fiel à percepção humana', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
      ],
      natural: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente prime 85mm f/1.8, distância focal portrait perfeita, compressão facial flattering, bokeh cremoso de fundo, separação de fundo profissional', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/1.4, perspectiva natural não distorcida, versatilidade profissional, campo de visão standard, rendição fiel à percepção humana', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
      ],
      soft: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente prime 85mm f/1.8, distância focal portrait perfeita, compressão facial flattering, bokeh cremoso de fundo, separação de fundo profissional', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/1.4, perspectiva natural não distorcida, versatilidade profissional, campo de visão standard, rendição fiel à percepção humana', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
      ],
    },
    casual: {
      natural: [
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/2, perspectiva natural autêntica, campo de visão realista, profundidade de campo moderada, captura genuína sem distorção', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente prime 35mm f/2.8, campo de visão wide angle moderado, contexto ambiental incluído, storytelling espacial, narrativa com ambiente', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
      golden: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente prime 85mm f/1.8, distância focal portrait ideal, compressão facial flattering, bokeh dourado cremoso, separação mágica do fundo', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/1.8, perspectiva natural equilibrada, profundidade moderada, versatilidade golden hour, balanço entre sujeito e ambiente', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente prime 35mm f/2, campo amplo storytelling, inclusão de paisagem dourada, narrativa ambiental golden hour, contexto épico', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
      soft: [
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/2.2, perspectiva natural suave, profundidade balanced, look orgânico gentil, rendição suave não intrusiva', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente prime 35mm f/2.8, campo de visão inclusivo suave, storytelling ambiental íntimo, narrativa espacial gentil', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
    },
    artistic: {
      dramatic: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente prime 85mm f/1.4, profundidade de campo razor-thin, bokeh cremoso intenso, separação dramática extrema, isolamento total do sujeito', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/1.2, abertura wide para drama, profundidade seletiva poética, versatilidade criativa, perspectiva clássica intensa', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: 'macro', name: 'Macro - Detalhes extremos', value: 'fotografado com lente macro 100mm f/2.8, magnificação 1:1 ou maior, foco ultra seletivo, detalhes hiper ampliados, textura microscópica revelada', description: 'Close extremo - captura detalhes minuciosos' },
      ],
      natural: [
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/1.8, perspectiva natural artística, profundidade poética, versatilidade criativa clássica, balanço entre realismo e arte', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente prime 35mm f/1.4, campo wide storytelling, narrativa ambiental profunda, contexto como parte da arte, inclusão espacial criativa', description: 'Inclui mais do ambiente ao redor da pessoa' },
        { id: 'macro', name: 'Macro - Detalhes extremos', value: 'fotografado com lente macro 100mm f/2.8, close-up artístico extremo, detalhes abstratos magnificados, mundo microscópico revelado, textura como arte', description: 'Close extremo - captura detalhes minuciosos' },
      ],
      golden: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente prime 85mm f/1.4, compressão golden hour épica, bokeh dourado cinematográfico, separação dramática mágica, isolamento poético', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/1.4, perspectiva golden hour natural, profundidade poética balanceada, versatilidade magic hour, equilíbrio épico', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente prime 35mm f/2, campo wide golden hour, paisagem dourada incluída, narrativa cinematográfica épica, contexto dramático amplo', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
      studio: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente prime 85mm f/1.4, distância focal portrait perfeita, bokeh studio clean, compressão facial ideal, separação minimalista', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/1.8, perspectiva studio clássica, profundidade controlada, versatilidade conceitual, rendição pura', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: 'macro', name: 'Macro - Detalhes extremos', value: 'fotografado com lente macro 100mm f/2.8, close-up conceptual extremo, magnificação detalhes faciais, textura skin ultra detalhada, abstração fotográfica', description: 'Close extremo - captura detalhes minuciosos' },
      ],
    },
    fashion: {
      studio: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente prime 85mm f/1.8 fashion standard, distância focal editorial clássica, compressão facial flattering fashion, bokeh studio clean, separação profissional', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/1.4 fashion versatile, perspectiva editorial natural, profundidade fashion ideal, versatilidade full-body e bust, balanço profissional', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
      ],
      dramatic: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente prime 85mm f/1.4 fashion portrait, compressão dramática fashion, bokeh intenso editorial, separação extreme fashion, isolamento high fashion', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/1.2 fashion drama, abertura máxima fashion, profundidade seletiva editorial, perspectiva fashion clássica, intensidade controlada', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
      ],
      natural: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente prime 85mm f/2 fashion outdoor, distância focal location ideal, compressão natural fashion, bokeh orgânico, separação suave editorial', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/2 fashion location, perspectiva natural editorial, profundidade moderada fashion, versatilidade outdoor fashion, balanço location', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente prime 35mm f/1.4 fashion environmental, campo wide editorial, contexto location fashion, storytelling ambiental fashion, narrativa espacial chic', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
    },
    lifestyle: {
      natural: [
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/2 lifestyle natural, perspectiva autêntica documentária, profundidade storytelling real, versatilidade lifestyle genuína, balanço documental', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente prime 35mm f/2.8 lifestyle storytelling, campo wide documentário, inclusão ambiente real, narrativa lifestyle autêntica, contexto cotidiano', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
      golden: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente prime 85mm f/1.8 lifestyle golden hour, compressão dourada romântica, bokeh warm lifestyle, separação mágica natural, isolamento nostálgico', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/1.8 lifestyle magic hour, perspectiva golden hour natural, profundidade romântica balanced, versatilidade sunset lifestyle', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente prime 35mm f/2 lifestyle golden hour wide, campo épico sunset, inclusão paisagem dourada, narrativa golden hour ampla, contexto mágico', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
      soft: [
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente prime 50mm f/2.2 lifestyle suave, perspectiva natural gentil, profundidade soft natural, versatilidade intimate lifestyle, balanço aconchegante', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente prime 35mm f/2.8 lifestyle ambiente suave, campo inclusivo gentil, storytelling doméstico íntimo, narrativa lifestyle tranquila', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
    },
  },

  // STEP 4: Quality (multiple allowed - always available regardless of context)
  quality: [
    { id: 'ultra', name: 'Ultra Realista', value: 'fotorrealismo profissional ultra detalhado, textura de pele realista com poros visíveis, captura de micro detalhes, render fotográfico perfeito' },
    { id: 'sharp', name: 'Sharp Focus', value: 'foco crítico ultra nítido, nitidez profissional edge-to-edge, clareza máxima, definição precisa de detalhes, ausência de motion blur' },
    { id: 'raw', name: 'RAW Photo', value: 'estética RAW file professional, latitude dinâmica preservada, tonalidade natural não processada, grading mínimo, look autêntico de câmera' },
    { id: 'hires', name: 'Alta Resolução', value: 'resolução ultra high definition 8K, densidade de pixels máxima, captura de detalhes microscópicos, qualidade de impressão comercial' },
  ],

  // STEP 5: Mood (contextual per style)
  mood: {
    prof: [
      { id: 'confident', name: 'Confiante', value: 'expressão facial confiante e assertiva, olhar direto para câmera intenso, linguagem corporal de autoridade, presença executiva marcante, postura ereta e segura' },
      { id: 'serious', name: 'Sério', value: 'expressão séria e focada, semblante profissional neutro, olhar determinado e concentrado, postura formal corporativa, ausência de sorriso' },
      { id: 'friendly', name: 'Amigável', value: 'sorriso genuíno caloroso, expressão acessível e convidativa, olhar amigável e confiável, postura aberta e receptiva, energia positiva' },
    ],
    casual: [
      { id: 'friendly', name: 'Amigável', value: 'sorriso natural espontâneo, expressão descontraída e alegre, olhar caloroso casual, energia leve e positiva, atitude relaxada' },
      { id: 'energetic', name: 'Energético', value: 'expressão vibrante e dinâmica, olhar vívido e animado, postura energética em movimento, atitude entusiasmada, vitalidade transmitida' },
      { id: 'contemplative', name: 'Contemplativo', value: 'expressão pensativa e reflexiva, olhar distante introspectivo, semblante calmo e sereno, atmosfera tranquila, momento de quietude' },
    ],
    artistic: [
      { id: 'contemplative', name: 'Contemplativo', value: 'expressão profundamente pensativa, olhar distante filosófico, semblante melancólico sutil, intensidade emocional contida, profundidade interior' },
      { id: 'confident', name: 'Confiante', value: 'presença forte e magnética, olhar penetrante direto, expressão de força interior, atitude empoderada, energia poderosa emanando' },
      { id: 'serious', name: 'Sério', value: 'intensidade dramática no olhar, expressão grave e pesada, semblante carregado emocionalmente, atmosfera densa, peso existencial' },
    ],
    fashion: [
      { id: 'confident', name: 'Confiante', value: 'expressão fashion confiante editorial, olhar direto intenso para câmera, atitude fierce fashion, presença de modelo profissional, energia high fashion' },
      { id: 'serious', name: 'Sério', value: 'expressão séria editorial fashion, olhar frio e distante, semblante neutro de passarela, atitude avant-garde, ausência de emoção aparente' },
      { id: 'contemplative', name: 'Contemplativo', value: 'olhar pensativo fashion editorial, expressão suave e misteriosa, semblante etéreo sonhador, atmosfera romântica, mood introspectivo elegante' },
    ],
    lifestyle: [
      { id: 'friendly', name: 'Amigável', value: 'sorriso autêntico genuíno, expressão calorosa natural, olhar sincero e real, energia positiva contagiante, felicidade verdadeira transmitida' },
      { id: 'energetic', name: 'Energético', value: 'expressão vibrante cheia de vida, olhar animado e brilhante, energia contagiante natural, movimento e dinamismo, vitalidade pura' },
      { id: 'confident', name: 'Confiante', value: 'confiança natural casual, olhar seguro mas relaxado, expressão de autoaceitação, postura confortável consigo mesmo, energia positiva confiante' },
    ],
  },

  // STEP 6: Environment (contextual per style + lighting)
  environment: {
    prof: {
      studio: [
        { id: 'office', name: 'Escritório', value: 'escritório corporativo moderno minimalista, decoração executiva profissional, mesa e cadeira de alto padrão, ambiente corporativo clean, arquitetura comercial contemporânea' },
        { id: 'studio', name: 'Estúdio', value: 'estúdio fotográfico profissional, backdrop cinza neutro seamless, cyclorama infinito, piso refletor opcional, ambiente controlado sem distrações' },
      ],
      natural: [
        { id: 'office', name: 'Escritório', value: 'escritório empresarial com janelas amplas, luz natural corporativa, móveis executivos de qualidade, plantas corporativas, ambiente profissional arejado' },
        { id: 'urban', name: 'Urbano', value: 'cenário urbano corporativo sofisticado, prédios comerciais modernos ao fundo, arquitetura contemporânea de negócios, ambiente metropolitano profissional' },
      ],
      soft: [
        { id: 'office', name: 'Escritório', value: 'escritório corporativo de alto padrão, iluminação ambiente suave, decoração executiva refinada, mobiliário premium, atmosfera profissional acolhedora' },
        { id: 'studio', name: 'Estúdio', value: 'estúdio fotográfico profissional iluminado suavemente, fundo neutro gradient sutil, ambiente clean e minimalista, setup corporativo polido' },
      ],
    },
    casual: {
      natural: [
        { id: 'home', name: 'Casa', value: 'interior residencial aconchegante, decoração casual confortável, ambiente doméstico relaxado, mobília cotidiana natural, atmosfera íntima e pessoal' },
        { id: 'outdoor', name: 'Ar Livre', value: 'cenário natural outdoor, vegetação verde abundante, ambiente ao ar livre orgânico, natureza como backdrop, setting outdoor casual' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano casual descontraído, rua ou praça pública, arquitetura urbana contemporânea, cenário metropolitano informal, vida urbana autêntica' },
      ],
      golden: [
        { id: 'outdoor', name: 'Ar Livre', value: 'cenário natural em golden hour, campo aberto ou parque, vegetação iluminada dourada, horizonte visível para sol baixo, ambiente outdoor mágico' },
        { id: 'urban', name: 'Urbano', value: 'cenário urbano em golden hour, rua ou rooftop urbano, arquitetura banhada em luz dourada, skyline metropolitano ao pôr do sol, atmosfera urbana romântica' },
      ],
      soft: [
        { id: 'home', name: 'Casa', value: 'interior doméstico com janela grande, sala de estar ou quarto aconchegante, decoração suave e convidativa, ambiente caseiro tranquilo, atmosfera íntima' },
        { id: 'outdoor', name: 'Ar Livre', value: 'ambiente outdoor sob luz overcast, jardim ou parque em dia nublado, vegetação suave difusa, cenário natural calmo, atmosfera outdoor serena' },
      ],
    },
    artistic: {
      dramatic: [
        { id: 'studio', name: 'Estúdio', value: 'estúdio fotográfico minimalista, fundo escuro dramático black ou cinza grafite, ambiente controlado para sombras, setting monocromático, atmosfera teatral' },
        { id: 'urban', name: 'Urbano', value: 'cenário urbano gritty dramático, arquitetura industrial ou grafite, iluminação urbana noturna, ambiente metropolitano raw, atmosfera street art' },
      ],
      natural: [
        { id: 'outdoor', name: 'Ar Livre', value: 'cenário natural artístico, paisagem orgânica selvagem, elementos naturais como backdrop, ambiente outdoor autêntico, conexão com natureza' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano artístico contemporâneo, arquitetura moderna como arte, linhas geométricas urbanas, cenário metropolitano conceptual, urbanismo como canvas' },
        { id: 'home', name: 'Casa', value: 'interior residencial artístico bohemian, decoração eclética pessoal, ambiente intimista único, espaço pessoal como expressão, atmosfera criativa' },
      ],
      golden: [
        { id: 'outdoor', name: 'Ar Livre', value: 'paisagem natural em magic hour, campo aberto ou floresta iluminada, vegetação dourada épica, horizonte dramático, cenário natural cinematográfico' },
        { id: 'urban', name: 'Urbano', value: 'cenário urbano em golden hour épico, rooftop ou rua banhada em dourado, arquitetura urbana dramática, skyline dourado cinematográfico, atmosfera urbana poética' },
      ],
      studio: [
        { id: 'studio', name: 'Estúdio', value: 'estúdio fotográfico conceitual, fundo experimental artístico, ambiente minimalista absoluto, setting avant-garde, pureza visual total' },
      ],
    },
    fashion: {
      studio: [
        { id: 'studio', name: 'Estúdio', value: 'estúdio fashion profissional, backdrop cinza fashion industry standard, cyclorama perfeito, ambiente editorial clean, setting high fashion puro' },
        { id: 'urban', name: 'Urbano', value: 'cenário urbano fashion location, arquitetura moderna chic, ambiente metropolitano sofisticado, street fashion setting, urbanismo fashion editorial' },
      ],
      dramatic: [
        { id: 'studio', name: 'Estúdio', value: 'estúdio fashion dramático, backdrop preto absoluto ou branco puro, contraste máximo editorial, ambiente high contrast fashion, setting minimalista poderoso' },
        { id: 'urban', name: 'Urbano', value: 'cenário urbano fashion dramático, arquitetura brutalist ou industrial, ambiente metropolitano edge, setting urbano avant-garde, atmosfera fashion gritty' },
      ],
      natural: [
        { id: 'outdoor', name: 'Ar Livre', value: 'location outdoor fashion natural, jardim botânico ou praia elegante, natureza como backdrop fashion, ambiente outdoor sofisticado, setting natural chic' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano fashion editorial, rua elegante ou praça moderna, arquitetura urbana sofisticada, setting metropolitano fashion, urbanismo como passarela' },
      ],
    },
    lifestyle: {
      natural: [
        { id: 'home', name: 'Casa', value: 'interior doméstico lifestyle real, sala de estar ou cozinha vivida, decoração autêntica pessoal, ambiente caseiro genuíno, vida cotidiana verdadeira' },
        { id: 'outdoor', name: 'Ar Livre', value: 'ambiente outdoor lifestyle natural, parque urbano ou campo, setting outdoor casual autêntico, natureza acessível, cenário exterior cotidiano' },
        { id: 'urban', name: 'Urbano', value: 'cenário urbano lifestyle real, café ou rua comercial, ambiente metropolitano vivido, vida urbana autêntica, urbanismo cotidiano genuíno' },
      ],
      golden: [
        { id: 'outdoor', name: 'Ar Livre', value: 'cenário outdoor lifestyle em golden hour, praia ou campo ao pôr do sol, ambiente natural romântico, setting exterior mágico, atmosfera outdoor nostálgica' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano lifestyle em magic hour, terraço ou rua ao entardecer, cenário metropolitano dourado, vida urbana romântica, atmosfera citadina poética' },
      ],
      soft: [
        { id: 'home', name: 'Casa', value: 'interior doméstico lifestyle aconchegante, quarto ou sala íntima, decoração suave tranquila, ambiente caseiro sereno, atmosfera residencial calma' },
        { id: 'outdoor', name: 'Ar Livre', value: 'cenário outdoor lifestyle em overcast, jardim ou parque em luz difusa, ambiente natural calmo, setting exterior tranquilo, natureza serena' },
      ],
    },
  },
}

interface SelectedOption {
  category: string
  id: string
  name: string
  value: string
}

export function PromptBuilder({ onPromptGenerated, onGenerate, onLastBlockSelected, modelClass = 'MAN' }: PromptBuilderProps) {
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([])
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['style'])
  const [copiedBlocks, setCopiedBlocks] = useState<string[]>([])

  // Category order for sequential flow
  const categoryOrder = ['style', 'lighting', 'camera', 'quality', 'mood', 'environment']

  // Auto-expand next category and collapse completed ones
  useEffect(() => {
    const manageCategories = () => {
      const selectedCategories = selectedOptions.map(opt => opt.category)
      let newExpandedCategories = [...expandedCategories]

      for (let i = 0; i < categoryOrder.length; i++) {
        const currentCategory = categoryOrder[i]
        const hasSelectionInCategory = selectedCategories.includes(currentCategory)

        if (hasSelectionInCategory) {
          // Collapse the completed category
          newExpandedCategories = newExpandedCategories.filter(cat => cat !== currentCategory)

          // Expand next category if exists
          if (i < categoryOrder.length - 1) {
            const nextCategory = categoryOrder[i + 1]
            if (!newExpandedCategories.includes(nextCategory)) {
              newExpandedCategories.push(nextCategory)

              // Scroll to next category after a brief delay
              setTimeout(() => {
                const nextCategoryElement = document.getElementById(`category-${nextCategory}`)
                if (nextCategoryElement) {
                  nextCategoryElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                  })
                }
              }, 300)
            }
          }
        }
      }

      setExpandedCategories(newExpandedCategories)
    }

    manageCategories()
  }, [selectedOptions])

  // Get available options for the current context
  const getAvailableOptions = (category: string): any[] => {
    if (category === 'style') {
      return CONTEXTUAL_OPTIONS.style
    }

    if (category === 'quality') {
      return CONTEXTUAL_OPTIONS.quality
    }

    const styleSelection = selectedOptions.find(opt => opt.category === 'style')
    if (!styleSelection) return []

    if (category === 'lighting') {
      return CONTEXTUAL_OPTIONS.lighting[styleSelection.id as keyof typeof CONTEXTUAL_OPTIONS.lighting] || []
    }

    if (category === 'mood') {
      return CONTEXTUAL_OPTIONS.mood[styleSelection.id as keyof typeof CONTEXTUAL_OPTIONS.mood] || []
    }

    const lightingSelection = selectedOptions.find(opt => opt.category === 'lighting')
    if (!lightingSelection) return []

    if (category === 'camera') {
      const cameraOptions = CONTEXTUAL_OPTIONS.camera[styleSelection.id as keyof typeof CONTEXTUAL_OPTIONS.camera]
      if (cameraOptions) {
        return cameraOptions[lightingSelection.id as keyof typeof cameraOptions] || []
      }
      return []
    }

    if (category === 'environment') {
      const envOptions = CONTEXTUAL_OPTIONS.environment[styleSelection.id as keyof typeof CONTEXTUAL_OPTIONS.environment]
      if (envOptions) {
        return envOptions[lightingSelection.id as keyof typeof envOptions] || []
      }
      return []
    }

    return []
  }

  const getCategoryIcon = (categoryName: string) => {
    switch (categoryName) {
      case 'style': return <Wand2 className="w-4 h-4" />
      case 'lighting': return <Lightbulb className="w-4 h-4" />
      case 'camera': return <Camera className="w-4 h-4" />
      case 'quality': return <Eye className="w-4 h-4" />
      case 'mood': return <Palette className="w-4 h-4" />
      case 'environment': return <MapPin className="w-4 h-4" />
      default: return <Wand2 className="w-4 h-4" />
    }
  }

  const getCategoryLabel = (categoryName: string) => {
    switch (categoryName) {
      case 'style': return 'Estilo'
      case 'lighting': return 'Iluminação'
      case 'camera': return 'Câmera'
      case 'quality': return 'Qualidade'
      case 'mood': return 'Humor'
      case 'environment': return 'Ambiente'
      default: return categoryName
    }
  }

  const allowsMultiple = (category: string) => {
    return category === 'quality' // Only quality allows multiple selections
  }

  const toggleOption = (category: string, option: any) => {
    setSelectedOptions(prev => {
      const isMultiple = allowsMultiple(category)
      
      if (!isMultiple) {
        // Single selection - replace existing selection in this category
        const filtered = prev.filter(opt => opt.category !== category)
        const isAlreadySelected = prev.some(opt => opt.id === option.id)

        if (isAlreadySelected) {
          return filtered // Remove this option
        } else {
          const newSelection: SelectedOption = {
            category,
            id: option.id,
            name: option.name,
            value: option.value
          }
          
          // If changing style or lighting, clear all subsequent selections
          if (category === 'style') {
            return [newSelection]
          } else if (category === 'lighting') {
            const styleSelection = prev.find(opt => opt.category === 'style')
            return styleSelection ? [styleSelection, newSelection] : [newSelection]
          }
          
          return [...filtered, newSelection]
        }
      } else {
        // Multiple selection allowed
        const isAlreadySelected = prev.some(opt => opt.id === option.id)

        if (isAlreadySelected) {
          return prev.filter(opt => opt.id !== option.id)
        } else {
          return [...prev, {
            category,
            id: option.id,
            name: option.name,
            value: option.value
          }]
        }
      }
    })
  }

  // Check when environment (last step) is selected
  useEffect(() => {
    const hasEnvironment = selectedOptions.some(opt => opt.category === 'environment')
    onLastBlockSelected?.(hasEnvironment)

    // Auto-generate prompt when last block is selected
    if (hasEnvironment && selectedOptions.length > 0) {
      const prompt = generatePrompt()
      if (prompt) {
        console.log('✅ [PROMPT_BUILDER] Last block selected, generating prompt:', prompt.substring(0, 100) + '...')
        onPromptGenerated(prompt)
      }
    }
  }, [selectedOptions])

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(cat => cat !== categoryName)
        : [...prev, categoryName]
    )
  }

  const generatePrompt = () => {
    if (selectedOptions.length === 0) return ''

    // Add gender prefix based on model class
    const modelGender = getModelGender(modelClass)
    const genderPrefix = getGenderPrefix(modelGender)

    // Combine selected option values in order
    const orderedValues = categoryOrder
      .map(category => {
        const options = selectedOptions.filter(opt => opt.category === category)
        return options.map(opt => opt.value).join(', ')
      })
      .filter(Boolean)
      .join(', ')

    const fullPrompt = genderPrefix + orderedValues

    return fullPrompt
  }

  const handleGeneratePrompt = () => {
    const prompt = generatePrompt()
    if (prompt) {
      onPromptGenerated(prompt)

      // Show feedback
      setCopiedBlocks(selectedOptions.map(opt => opt.id))
      setTimeout(() => setCopiedBlocks([]), 2000)
    }
  }

  const handleCopyPrompt = () => {
    const prompt = generatePrompt()
    if (prompt) {
      navigator.clipboard.writeText(prompt)
      setCopiedBlocks(selectedOptions.map(opt => opt.id))
      setTimeout(() => setCopiedBlocks([]), 2000)
    }
  }

  const clearAll = () => {
    setSelectedOptions([])
    setExpandedCategories(['style'])
    onLastBlockSelected?.(false)
  }

  const currentPrompt = generatePrompt()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Prompt Builder</h3>
          <p className="text-sm text-gray-400">Construa seu prompt passo a passo</p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={selectedOptions.length === 0}
            className="border-slate-500 text-slate-300 hover:bg-slate-700"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {categoryOrder.map((categoryName, index) => {
          const isExpanded = expandedCategories.includes(categoryName)
          const selectedInCategory = selectedOptions.find(opt => opt.category === categoryName)
          const availableOptions = getAvailableOptions(categoryName)

          // Check if this category should be available based on sequential flow
          const isAvailable = index === 0 ||
            selectedOptions.some(opt => opt.category === categoryOrder[index - 1])

          // Don't show category if no options available (contextually filtered out)
          if (isAvailable && availableOptions.length === 0 && categoryName !== 'style') {
            return null
          }

          return (
            <Card key={categoryName} id={`category-${categoryName}`} className={`bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border-slate-600/30 ${!isAvailable && !selectedInCategory ? 'opacity-50' : ''}`}>
              <CardHeader
                className={`pb-2 transition-colors ${(isAvailable || selectedInCategory) ? 'cursor-pointer hover:bg-gray-750' : 'cursor-not-allowed'}`}
                onClick={() => (isAvailable || selectedInCategory) && toggleCategory(categoryName)}
              >
                <CardTitle className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    {getCategoryIcon(categoryName)}
                    <span className={`font-medium ${selectedInCategory ? 'text-[#667EEA]' : 'text-white'}`}>
                      {getCategoryLabel(categoryName)}
                    </span>
                    {selectedInCategory && (
                      <Badge className="bg-[#667EEA] text-white text-xs px-2">
                        ✓ {selectedInCategory.name}
                      </Badge>
                    )}
                    {allowsMultiple(categoryName) && (
                      <Badge variant="outline" className="text-xs border-gray-500 text-gray-400">
                        Múltiplo
                      </Badge>
                    )}
                    {!isAvailable && (
                      <Badge variant="outline" className="text-xs border-slate-600/30 text-gray-500">
                        Bloqueado
                      </Badge>
                    )}
                  </div>
                  <div className="text-gray-400">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </CardTitle>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 pb-4">
                  <div className="grid grid-cols-1 gap-2">
                    {availableOptions.map((option: any) => {
                      const isSelected = selectedOptions.some(opt => opt.id === option.id)
                      const isCopied = copiedBlocks.includes(option.id)

                      return (
                        <Button
                          key={option.id}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleOption(categoryName, option)}
                          disabled={!isAvailable && !selectedInCategory}
                          className={`w-full justify-between text-left h-auto py-3 px-4 transition-all ${
                            isSelected
                              ? 'bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-[#667EEA]'
                              : 'bg-gray-700 border-slate-600/30 text-white hover:bg-gray-600 hover:border-gray-500'
                          }`}
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-medium">{option.name}</span>
                            {option.description && categoryName === 'camera' ? (
                              <span className="text-xs opacity-75 mt-0.5">{option.description}</span>
                            ) : (
                              <span className="text-xs opacity-75 mt-0.5">{option.value.slice(0, 50)}...</span>
                            )}
                          </div>
                          {isCopied && <Check className="w-4 h-4 text-[#667EEA]" />}
                        </Button>
                      )
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Generated Prompt Preview */}
      {currentPrompt && (
        <Card className="bg-gray-700 border-slate-600/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-white">Prompt Gerado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 rounded-lg p-4 mb-4">
              <p className="text-sm text-white leading-relaxed">
                {currentPrompt}
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={handleCopyPrompt}
                disabled={selectedOptions.length === 0}
                className="border-slate-500 text-slate-300 hover:bg-slate-700"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
