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

export function PromptBuilder({ onPromptGenerated, onGenerate, onLastBlockSelected, modelClass = 'MAN' }: PromptBuilderProps) {
  const [selectedBlocks, setSelectedBlocks] = useState<PromptBlock[]>([])
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['style'])
  const [copiedBlocks, setCopiedBlocks] = useState<string[]>([])

  // Category order for sequential flow
  const categoryOrder = ['style', 'lighting', 'camera', 'quality', 'mood', 'environment']

  // Auto-expand next category and collapse completed ones
  useEffect(() => {
    const manageCategories = () => {
      const selectedCategories = selectedBlocks.map(block => block.category)
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
  }, [selectedBlocks])

  // Prompt building blocks organized by category
  const promptCategories: PromptCategory[] = [
    {
      name: 'style',
      blocks: [
        { id: 'prof', name: 'Profissional', value: 'foto profissional de negócios, expressão confiante, fundo de escritório', category: 'style', isSelected: false },
        { id: 'casual', name: 'Casual', value: 'retrato casual ao ar livre, pose natural relaxada, roupas confortáveis', category: 'style', isSelected: false },
        { id: 'artistic', name: 'Artístico', value: 'retrato artístico, composição criativa, humor expressivo', category: 'style', isSelected: false },
        { id: 'fashion', name: 'Fashion', value: 'retrato de alta moda, roupa elegante, pose sofisticada', category: 'style', isSelected: false },
        { id: 'lifestyle', name: 'Lifestyle', value: 'fotografia lifestyle, momento espontâneo, ambiente cotidiano', category: 'style', isSelected: false },
      ],
      allowMultiple: false
    },
    {
      name: 'lighting',
      blocks: [
        { id: 'natural', name: 'Natural', value: 'luz natural do dia, luz suave da janela', category: 'lighting', isSelected: false },
        { id: 'studio', name: 'Studio', value: 'iluminação profissional de estúdio, iluminação controlada', category: 'lighting', isSelected: false },
        { id: 'golden', name: 'Golden Hour', value: 'luz solar dourada, luz atmosférica quente', category: 'lighting', isSelected: false },
        { id: 'dramatic', name: 'Dramática', value: 'iluminação dramática, sombras fortes, alto contraste', category: 'lighting', isSelected: false },
        { id: 'soft', name: 'Suave', value: 'iluminação difusa suave, sombras gentis', category: 'lighting', isSelected: false },
      ],
      allowMultiple: false
    },
    {
      name: 'camera',
      blocks: [
        { id: '85mm', name: '85mm - Retrato clássico', value: 'fotografado com lente 85mm, fotografia de retrato', category: 'camera', isSelected: false, description: 'Ideal para retratos - desfoca o fundo e destaca o rosto' },
        { id: '50mm', name: '50mm - Visão natural', value: 'fotografado com lente 50mm, perspectiva natural', category: 'camera', isSelected: false, description: 'Mais natural - mostra a pessoa como você vê com seus olhos' },
        { id: '35mm', name: '35mm - Contexto amplo', value: 'fotografado com lente 35mm, retrato ambiental', category: 'camera', isSelected: false, description: 'Inclui mais do ambiente ao redor da pessoa' },
        { id: 'macro', name: 'Macro - Detalhes extremos', value: 'fotografia macro, close-up detalhado', category: 'camera', isSelected: false, description: 'Close extremo - captura detalhes minuciosos' },
      ],
      allowMultiple: false
    },
    {
      name: 'quality',
      blocks: [
        { id: 'ultra', name: 'Ultra Realista', value: 'ultra realista, fotorrealista', category: 'quality', isSelected: false },
        { id: 'sharp', name: 'Sharp Focus', value: 'foco nítido, detalhes precisos', category: 'quality', isSelected: false },
        { id: 'raw', name: 'RAW Photo', value: 'estilo foto RAW, qualidade profissional', category: 'quality', isSelected: false },
        { id: 'hires', name: 'Alta Resolução', value: 'alta resolução, detalhado', category: 'quality', isSelected: false },
      ],
      allowMultiple: true
    },
    {
      name: 'mood',
      blocks: [
        { id: 'confident', name: 'Confiante', value: 'expressão confiante, presença marcante', category: 'mood', isSelected: false },
        { id: 'friendly', name: 'Amigável', value: 'sorriso caloroso, comportamento acessível', category: 'mood', isSelected: false },
        { id: 'serious', name: 'Sério', value: 'expressão séria, comportamento profissional', category: 'mood', isSelected: false },
        { id: 'contemplative', name: 'Contemplativo', value: 'expressão pensativa, humor introspectivo', category: 'mood', isSelected: false },
        { id: 'energetic', name: 'Energético', value: 'pose energética, expressão dinâmica', category: 'mood', isSelected: false },
      ],
      allowMultiple: false
    },
    {
      name: 'environment',
      blocks: [
        { id: 'office', name: 'Escritório', value: 'ambiente de escritório moderno, ambiente corporativo', category: 'environment', isSelected: false },
        { id: 'outdoor', name: 'Ar Livre', value: 'ambiente ao ar livre, fundo natural', category: 'environment', isSelected: false },
        { id: 'home', name: 'Casa', value: 'ambiente doméstico, interior aconchegante', category: 'environment', isSelected: false },
        { id: 'studio', name: 'Estúdio', value: 'estúdio de fotografia, fundo neutro', category: 'environment', isSelected: false },
        { id: 'urban', name: 'Urbano', value: 'ambiente urbano, fundo de cidade', category: 'environment', isSelected: false },
      ],
      allowMultiple: false
    },
  ]

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

  const toggleBlock = (block: PromptBlock) => {
    const category = promptCategories.find(cat => cat.name === block.category)
    if (!category) return

    setSelectedBlocks(prev => {
      let newSelectedBlocks

      if (!category.allowMultiple) {
        // Remove other blocks from the same category
        const filtered = prev.filter(b => b.category !== block.category)
        const isAlreadySelected = prev.some(b => b.id === block.id)

        if (isAlreadySelected) {
          newSelectedBlocks = filtered // Remove this block
        } else {
          newSelectedBlocks = [...filtered, { ...block, isSelected: true }] // Add this block
        }
      } else {
        // Allow multiple selections
        const isAlreadySelected = prev.some(b => b.id === block.id)

        if (isAlreadySelected) {
          newSelectedBlocks = prev.filter(b => b.id !== block.id) // Remove this block
        } else {
          newSelectedBlocks = [...prev, { ...block, isSelected: true }] // Add this block
        }
      }

      // Check if environment (last block) is selected
      const hasEnvironment = newSelectedBlocks.some(b => b.category === 'environment')
      onLastBlockSelected?.(hasEnvironment)

      // Auto-generate prompt when last block is selected
      if (hasEnvironment && newSelectedBlocks.length > 0) {
        // Generate prompt immediately using the same logic as generatePrompt()
        const modelGender = getModelGender(modelClass)
        const genderPrefix = getGenderPrefix(modelGender)
        const combinedPrompt = newSelectedBlocks.map(block => block.value).join(', ')
        const fullPrompt = genderPrefix + combinedPrompt
        if (fullPrompt) {
          console.log('✅ [PROMPT_BUILDER] Last block selected, generating prompt:', fullPrompt.substring(0, 100) + '...')
          // Update prompt immediately when last block is selected
          onPromptGenerated(fullPrompt)
        }
      }

      return newSelectedBlocks
    })
  }

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryName)
        ? prev.filter(cat => cat !== categoryName)
        : [...prev, categoryName]
    )
  }

  const generatePrompt = () => {
    if (selectedBlocks.length === 0) return ''

    // Add gender prefix based on model class using centralized utility
    const modelGender = getModelGender(modelClass)
    const genderPrefix = getGenderPrefix(modelGender)

    // Combine selected block values
    const combinedPrompt = selectedBlocks
      .map(block => block.value)
      .join(', ')

    const fullPrompt = genderPrefix + combinedPrompt

    return fullPrompt
  }

  const handleGeneratePrompt = () => {
    const prompt = generatePrompt()
    if (prompt) {
      onPromptGenerated(prompt)

      // Show feedback
      setCopiedBlocks(selectedBlocks.map(b => b.id))
      setTimeout(() => setCopiedBlocks([]), 2000)
    }
  }

  const handleCopyPrompt = () => {
    const prompt = generatePrompt()
    if (prompt) {
      navigator.clipboard.writeText(prompt)
      setCopiedBlocks(selectedBlocks.map(b => b.id))
      setTimeout(() => setCopiedBlocks([]), 2000)
    }
  }

  const clearAll = () => {
    setSelectedBlocks([])
    onLastBlockSelected?.(false)
  }

  const currentPrompt = generatePrompt()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Prompt Builder</h3>
          <p className="text-sm text-gray-400">Construa seu prompt</p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={selectedBlocks.length === 0}
            className="border-slate-500 text-slate-300 hover:bg-slate-700"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Limpar
          </Button>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {categoryOrder.map((categoryName) => {
          const category = promptCategories.find(cat => cat.name === categoryName)
          if (!category) return null

          const isExpanded = expandedCategories.includes(category.name)
          const selectedInCategory = selectedBlocks.find(b => b.category === category.name)

          // Check if this category should be available based on sequential flow
          const categoryIndex = categoryOrder.indexOf(category.name)
          const isAvailable = categoryIndex === 0 ||
            selectedBlocks.some(block => block.category === categoryOrder[categoryIndex - 1])

          return (
            <Card key={category.name} id={`category-${category.name}`} className={`bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border-slate-600/30 ${!isAvailable && !selectedInCategory ? 'opacity-50' : ''}`}>
              <CardHeader
                className={`pb-2 transition-colors ${(isAvailable || selectedInCategory) ? 'cursor-pointer hover:bg-gray-750' : 'cursor-not-allowed'}`}
                onClick={() => (isAvailable || selectedInCategory) && toggleCategory(category.name)}
              >
                <CardTitle className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <span className={`font-medium ${selectedInCategory ? 'text-[#667EEA]' : 'text-white'}`}>
                      {getCategoryLabel(category.name)}
                    </span>
                    {selectedInCategory && (
                      <Badge className="bg-[#667EEA] text-white text-xs px-2">
                        ✓ {selectedInCategory.name}
                      </Badge>
                    )}
                    {!category.allowMultiple && !selectedInCategory && (
                      <Badge variant="outline" className="text-xs border-gray-500 text-gray-400">
                        Único
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
                    {category.blocks.map((block) => {
                      const isSelected = selectedBlocks.some(b => b.id === block.id)
                      const isCopied = copiedBlocks.includes(block.id)

                      return (
                        <Button
                          key={block.id}
                          variant={isSelected ? "default" : "outline"}
                          size="sm"
                          onClick={() => (isAvailable || selectedInCategory) && toggleBlock(block)}
                          disabled={!isAvailable && !selectedInCategory}
                          className={`w-full justify-between text-left h-auto py-3 px-4 transition-all ${
                            isSelected
                              ? 'bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-[#667EEA]'
                              : (!isAvailable && !selectedInCategory)
                              ? 'bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border-gray-700 text-gray-500 cursor-not-allowed'
                              : 'bg-gray-700 border-slate-600/30 text-white hover:bg-gray-600 hover:border-gray-500'
                          }`}
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-medium">{block.name}</span>
                            {block.description && category.name === 'camera' ? (
                              <span className="text-xs opacity-75 mt-0.5">{block.description}</span>
                            ) : (
                              <span className="text-xs opacity-75 mt-0.5">{block.value.slice(0, 50)}...</span>
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
                disabled={selectedBlocks.length === 0}
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