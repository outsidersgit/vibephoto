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
    { id: 'prof', name: 'Profissional', value: 'foto profissional de negócios, expressão confiante' },
    { id: 'casual', name: 'Casual', value: 'retrato casual, pose natural relaxada, roupas confortáveis' },
    { id: 'artistic', name: 'Artístico', value: 'retrato artístico, composição criativa, humor expressivo' },
    { id: 'fashion', name: 'Fashion', value: 'retrato de alta moda, roupa elegante, pose sofisticada' },
    { id: 'lifestyle', name: 'Lifestyle', value: 'fotografia lifestyle, momento espontâneo, ambiente cotidiano' },
  ],

  // STEP 2: Lighting (contextual per style)
  lighting: {
    prof: [
      { id: 'studio', name: 'Studio', value: 'iluminação profissional de estúdio, iluminação controlada' },
      { id: 'natural', name: 'Natural', value: 'luz natural do dia, luz suave da janela' },
      { id: 'soft', name: 'Suave', value: 'iluminação difusa suave, sombras gentis' },
    ],
    casual: [
      { id: 'natural', name: 'Natural', value: 'luz natural do dia, luz suave da janela' },
      { id: 'golden', name: 'Golden Hour', value: 'luz solar dourada, luz atmosférica quente' },
      { id: 'soft', name: 'Suave', value: 'iluminação difusa suave, sombras gentis' },
    ],
    artistic: [
      { id: 'dramatic', name: 'Dramática', value: 'iluminação dramática, sombras fortes, alto contraste' },
      { id: 'natural', name: 'Natural', value: 'luz natural do dia, luz suave da janela' },
      { id: 'golden', name: 'Golden Hour', value: 'luz solar dourada, luz atmosférica quente' },
      { id: 'studio', name: 'Studio', value: 'iluminação profissional de estúdio, iluminação controlada' },
    ],
    fashion: [
      { id: 'studio', name: 'Studio', value: 'iluminação profissional de estúdio, iluminação controlada' },
      { id: 'dramatic', name: 'Dramática', value: 'iluminação dramática, sombras fortes, alto contraste' },
      { id: 'natural', name: 'Natural', value: 'luz natural do dia, luz suave da janela' },
    ],
    lifestyle: [
      { id: 'natural', name: 'Natural', value: 'luz natural do dia, luz suave da janela' },
      { id: 'golden', name: 'Golden Hour', value: 'luz solar dourada, luz atmosférica quente' },
      { id: 'soft', name: 'Suave', value: 'iluminação difusa suave, sombras gentis' },
    ],
  },

  // STEP 3: Camera (contextual per style + lighting combination)
  camera: {
    prof: {
      studio: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente 85mm, fotografia de retrato', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
      ],
      natural: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente 85mm, fotografia de retrato', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
      ],
      soft: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente 85mm, fotografia de retrato', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
      ],
    },
    casual: {
      natural: [
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente 35mm, retrato ambiental', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
      golden: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente 85mm, fotografia de retrato', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente 35mm, retrato ambiental', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
      soft: [
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente 35mm, retrato ambiental', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
    },
    artistic: {
      dramatic: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente 85mm, fotografia de retrato', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: 'macro', name: 'Macro - Detalhes extremos', value: 'fotografia macro, close-up detalhado', description: 'Close extremo - captura detalhes minuciosos' },
      ],
      natural: [
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente 35mm, retrato ambiental', description: 'Inclui mais do ambiente ao redor da pessoa' },
        { id: 'macro', name: 'Macro - Detalhes extremos', value: 'fotografia macro, close-up detalhado', description: 'Close extremo - captura detalhes minuciosos' },
      ],
      golden: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente 85mm, fotografia de retrato', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente 35mm, retrato ambiental', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
      studio: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente 85mm, fotografia de retrato', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: 'macro', name: 'Macro - Detalhes extremos', value: 'fotografia macro, close-up detalhado', description: 'Close extremo - captura detalhes minuciosos' },
      ],
    },
    fashion: {
      studio: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente 85mm, fotografia de retrato', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
      ],
      dramatic: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente 85mm, fotografia de retrato', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
      ],
      natural: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente 85mm, fotografia de retrato', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente 35mm, retrato ambiental', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
    },
    lifestyle: {
      natural: [
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente 35mm, retrato ambiental', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
      golden: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente 85mm, fotografia de retrato', description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente 35mm, retrato ambiental', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
      soft: [
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente 35mm, retrato ambiental', description: 'Inclui mais do ambiente ao redor da pessoa' },
      ],
    },
  },

  // STEP 4: Quality (multiple allowed - always available regardless of context)
  quality: [
    { id: 'ultra', name: 'Ultra Realista', value: 'ultra realista, fotorrealista' },
    { id: 'sharp', name: 'Sharp Focus', value: 'foco nítido, detalhes precisos' },
    { id: 'raw', name: 'RAW Photo', value: 'estilo foto RAW, qualidade profissional' },
    { id: 'hires', name: 'Alta Resolução', value: 'alta resolução, detalhado' },
  ],

  // STEP 5: Mood (contextual per style)
  mood: {
    prof: [
      { id: 'confident', name: 'Confiante', value: 'expressão confiante, presença marcante' },
      { id: 'serious', name: 'Sério', value: 'expressão séria, comportamento profissional' },
      { id: 'friendly', name: 'Amigável', value: 'sorriso caloroso, comportamento acessível' },
    ],
    casual: [
      { id: 'friendly', name: 'Amigável', value: 'sorriso caloroso, comportamento acessível' },
      { id: 'energetic', name: 'Energético', value: 'pose energética, expressão dinâmica' },
      { id: 'contemplative', name: 'Contemplativo', value: 'expressão pensativa, humor introspectivo' },
    ],
    artistic: [
      { id: 'contemplative', name: 'Contemplativo', value: 'expressão pensativa, humor introspectivo' },
      { id: 'confident', name: 'Confiante', value: 'expressão confiante, presença marcante' },
      { id: 'serious', name: 'Sério', value: 'expressão séria, comportamento profissional' },
    ],
    fashion: [
      { id: 'confident', name: 'Confiante', value: 'expressão confiante, presença marcante' },
      { id: 'serious', name: 'Sério', value: 'expressão séria, comportamento profissional' },
      { id: 'contemplative', name: 'Contemplativo', value: 'expressão pensativa, humor introspectivo' },
    ],
    lifestyle: [
      { id: 'friendly', name: 'Amigável', value: 'sorriso caloroso, comportamento acessível' },
      { id: 'energetic', name: 'Energético', value: 'pose energética, expressão dinâmica' },
      { id: 'confident', name: 'Confiante', value: 'expressão confiante, presença marcante' },
    ],
  },

  // STEP 6: Environment (contextual per style + lighting)
  environment: {
    prof: {
      studio: [
        { id: 'office', name: 'Escritório', value: 'ambiente de escritório moderno, ambiente corporativo' },
        { id: 'studio', name: 'Estúdio', value: 'estúdio de fotografia, fundo neutro' },
      ],
      natural: [
        { id: 'office', name: 'Escritório', value: 'ambiente de escritório moderno, ambiente corporativo' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano, fundo de cidade' },
      ],
      soft: [
        { id: 'office', name: 'Escritório', value: 'ambiente de escritório moderno, ambiente corporativo' },
        { id: 'studio', name: 'Estúdio', value: 'estúdio de fotografia, fundo neutro' },
      ],
    },
    casual: {
      natural: [
        { id: 'home', name: 'Casa', value: 'ambiente doméstico, interior aconchegante' },
        { id: 'outdoor', name: 'Ar Livre', value: 'ambiente ao ar livre, fundo natural' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano, fundo de cidade' },
      ],
      golden: [
        { id: 'outdoor', name: 'Ar Livre', value: 'ambiente ao ar livre, fundo natural' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano, fundo de cidade' },
      ],
      soft: [
        { id: 'home', name: 'Casa', value: 'ambiente doméstico, interior aconchegante' },
        { id: 'outdoor', name: 'Ar Livre', value: 'ambiente ao ar livre, fundo natural' },
      ],
    },
    artistic: {
      dramatic: [
        { id: 'studio', name: 'Estúdio', value: 'estúdio de fotografia, fundo neutro' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano, fundo de cidade' },
      ],
      natural: [
        { id: 'outdoor', name: 'Ar Livre', value: 'ambiente ao ar livre, fundo natural' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano, fundo de cidade' },
        { id: 'home', name: 'Casa', value: 'ambiente doméstico, interior aconchegante' },
      ],
      golden: [
        { id: 'outdoor', name: 'Ar Livre', value: 'ambiente ao ar livre, fundo natural' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano, fundo de cidade' },
      ],
      studio: [
        { id: 'studio', name: 'Estúdio', value: 'estúdio de fotografia, fundo neutro' },
      ],
    },
    fashion: {
      studio: [
        { id: 'studio', name: 'Estúdio', value: 'estúdio de fotografia, fundo neutro' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano, fundo de cidade' },
      ],
      dramatic: [
        { id: 'studio', name: 'Estúdio', value: 'estúdio de fotografia, fundo neutro' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano, fundo de cidade' },
      ],
      natural: [
        { id: 'outdoor', name: 'Ar Livre', value: 'ambiente ao ar livre, fundo natural' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano, fundo de cidade' },
      ],
    },
    lifestyle: {
      natural: [
        { id: 'home', name: 'Casa', value: 'ambiente doméstico, interior aconchegante' },
        { id: 'outdoor', name: 'Ar Livre', value: 'ambiente ao ar livre, fundo natural' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano, fundo de cidade' },
      ],
      golden: [
        { id: 'outdoor', name: 'Ar Livre', value: 'ambiente ao ar livre, fundo natural' },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano, fundo de cidade' },
      ],
      soft: [
        { id: 'home', name: 'Casa', value: 'ambiente doméstico, interior aconchegante' },
        { id: 'outdoor', name: 'Ar Livre', value: 'ambiente ao ar livre, fundo natural' },
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
