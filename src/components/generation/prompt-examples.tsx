'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Sparkles } from 'lucide-react'

interface PromptExamplesProps {
  modelClass: string
  onPromptSelect: (prompt: string) => void
  onClose?: () => void
}

export function PromptExamples({ modelClass, onPromptSelect, onClose }: PromptExamplesProps) {
  const getPromptsForClass = (className: string) => {
    const basePrompts = {
      MAN: [
        {
          category: 'Profissional',
          prompts: [
            'Foto profissional ultra realista para negócios, usando terno e gravata, sorriso confiante, fundo de escritório, iluminação de estúdio, foco nítido, lente 85mm, estilo foto RAW',
            'Retrato corporativo profissional, usando terno elegante, expressão confiante, fundo de escritório moderno, luz natural da janela, profundidade de campo rasa, lente 50mm, estilo foto RAW',
            'Foto ultra realista para perfil LinkedIn, roupa casual de negócios, sorriso acessível, fundo neutro limpo, foco nítido, iluminação de estúdio, lente 85mm, estilo foto RAW'
          ]
        },
        {
          category: 'Casual',
          prompts: [
            'Retrato casual ultra realista ao ar livre, usando jeans e camiseta, sorriso natural, fundo de parque com vegetação, luz suave do dia, Sony A7R IV, lente 50mm, estilo foto RAW',
            'Foto espontânea ultra realista em cafeteria aconchegante, visual relaxado de fim de semana, roupa casual moderna, segurando xícara de café, luz dourada quente através das janelas, sorriso acessível, postura natural, profundidade de campo cinematográfica, Canon 5D com lente 50mm, estilo foto RAW',
            'Foto de férias ultra realista na praia, usando roupas casuais de verão, sorriso espontâneo, fundo de oceano e areia, luz do pôr do sol dourado, iluminação natural externa, Nikon Z7 II, lente 35mm, estilo foto RAW'
          ]
        },
        {
          category: 'Artístico',
          prompts: [
            'Retrato dramático ultra realista, fotografia preto e branco, iluminação artística forte com sombras profundas, tons de alto contraste, foco nítido, ambiente de estúdio, fotografado com Leica M10 Monochrom, lente 50mm, estilo foto RAW',
            'Headshot criativo ultra realista, fundo de estúdio com gradiente colorido, configuração de iluminação moderna, pose natural dinâmica, foco nítido, tons vibrantes, fotografado com Canon EOS R5, lente 85mm, estilo foto RAW',
            'Retrato cinematográfico ultra realista, iluminação atmosférica sombria, estilo de fotografia de filme com grão sutil, profundidade de campo suave, alto contraste, fotografado com Arri Alexa 65, lente 50mm, estilo foto RAW'
          ]
        }
      ],
      WOMAN: [
        {
          category: 'Profissional',
          prompts: [
            'Foto profissional ultra realista para negócios, mulher usando terno elegante e blusa, sorriso confiante, fundo de escritório moderno, iluminação de estúdio, foco nítido, lente 85mm, estilo foto RAW',
            'Retrato corporativo profissional, mulher em traje de negócios sofisticado, maquiagem natural, expressão confiante, fundo de escritório moderno, luz natural da janela, profundidade de campo rasa, lente 50mm, estilo foto RAW',
            'Foto ultra realista para perfil LinkedIn, mulher em roupa casual de negócios, sorriso acessível, fundo neutro limpo, styling profissional, foco nítido, iluminação de estúdio, lente 85mm, estilo foto RAW'
          ]
        },
        {
          category: 'Moda',
          prompts: [
            'Retrato de moda ultra realista, mulher usando vestido elegante de noite, pose sofisticada, iluminação dramática de estúdio, profundidade de campo rasa, Canon EOS R5, lente 85mm, estilo foto RAW',
            'Fotografia glamour ultra realista, mulher em traje de gala luxuoso, maquiagem dramática com destaques sutis, fundo luxuoso com bokeh suave, configuração de iluminação profissional, fotografado com Sony A7R IV, lente 50mm, estilo foto RAW',
            'Foto de moda lifestyle ultra realista, mulher em roupa moderna da moda, pose confiante, fundo urbano com iluminação natural, luz dourada do pôr do sol, expressão espontânea, Nikon Z7 II, lente 35mm, estilo foto RAW'
          ]
        },
        {
          category: 'Casual',
          prompts: [
            'Retrato casual lifestyle ultra realista, mulher usando roupas confortáveis e estilosas, sorriso natural genuíno, ambiente doméstico aconchegante com iluminação quente, luz suave do dia, Sony A7R IV, lente 50mm, estilo foto RAW',
            'Foto casual ultra realista ao ar livre, mulher em lindo vestido de verão, pose relaxada, fundo de jardim com vegetação, iluminação do pôr do sol dourado, ambiente natural externo, Canon 5D com lente 50mm, estilo foto RAW',
            'Retrato de cafeteria ultra realista, mulher em suéter aconchegante, segurando xícara de café, atmosfera quente com luz suave da janela, expressão natural espontânea, postura confortável, Nikon Z7 II, lente 35mm, estilo foto RAW'
          ]
        }
      ],
      BOY: [
        {
          category: 'Brincação',
          prompts: [
            'menino brincando no parque, roupas casuais, expressão alegre, ambiente ao ar livre',
            'retrato escolar, uniforme arrumado, sorriso amigável, fundo de sala de aula',
            'foto de festa de aniversário, roupas festivas, expressão animada, fundo colorido'
          ]
        },
        {
          category: 'Esportes',
          prompts: [
            'retrato de jovem atleta, uniforme esportivo, pose confiante, fundo de campo',
            'foto de ação de jogador de futebol, camisa do time, pose dinâmica, ambiente de estádio',
            'retrato de basquete, roupa atlética, expressão determinada, fundo de quadra'
          ]
        }
      ],
      GIRL: [
        {
          category: 'Retrato',
          prompts: [
            'retrato de menina, vestido bonito, sorriso doce, fundo de jardim',
            'foto escolar, uniforme arrumado, expressão amigável, ambiente de sala de aula',
            'estilo retrato de família, roupas casuais, pose natural, ambiente doméstico'
          ]
        },
        {
          category: 'Atividades',
          prompts: [
            'retrato de dança, roupa de balé, pose graciosa, ambiente de estúdio',
            'foto de aula de arte, expressão criativa, fundo colorido, olhar focado',
            'aventura ao ar livre, roupas de trilha, expressão animada, fundo de natureza'
          ]
        }
      ],
      ANIMAL: [
        {
          category: 'Retrato Pet',
          prompts: [
            'retrato profissional de pet, pose sentado, iluminação de estúdio, fundo limpo',
            'foto de pet ao ar livre, ambiente natural, expressão brincalhona, hora dourada',
            'fotografia lifestyle de pet, ambiente doméstico, pose confortável, iluminação quente'
          ]
        },
        {
          category: 'Ação',
          prompts: [
            'pet em ação, correndo ou pulando, ambiente externo, fundo com desfoque de movimento',
            'foto de pet brincando, brinquedo ou bola, ambiente de jardim, expressão alegre',
            'pet e natureza, paisagem bonita, pose pacífica, iluminação natural'
          ]
        }
      ]
    }

    return basePrompts[className as keyof typeof basePrompts] || basePrompts.MAN
  }

  const promptCategories = getPromptsForClass(modelClass)

  return (
    <Card className="bg-gray-700 border-gray-500">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-medium text-gray-100">
          Exemplos de Descrição
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage Tips */}
        <div className="bg-gray-600 border border-gray-500 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-100 mb-2">Como Usar os Exemplos</h4>
          <div className="text-xs text-gray-400 space-y-0.5 leading-tight" style={{fontSize: '8px'}}>
            <p>• Clique em "Usar Prompt" para copiar</p>
            <p>• Modifique para sua visão específica</p>
            <p>• Combine elementos diferentes</p>
            <p>• Adicione detalhes próprios</p>
          </div>
        </div>

        {promptCategories.map((category, categoryIndex) => (
          <div key={categoryIndex}>
            <h4 className="text-sm font-medium text-gray-200 mb-3 flex items-center">
              <Badge variant="outline" className="mr-2 border-gray-500 text-gray-300 bg-gray-600">
                {category.category}
              </Badge>
            </h4>

            <div className="space-y-2">
              {category.prompts.map((prompt, promptIndex) => (
                <div
                  key={promptIndex}
                  className="group p-3 bg-gray-600 rounded-lg border border-gray-500 hover:border-gray-400 transition-colors"
                >
                  <p className="text-sm text-gray-200 mb-2 leading-relaxed">
                    {prompt}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onPromptSelect(prompt)
                          onClose?.()
                        }}
                        className="h-7 px-3 text-xs border-gray-400 text-gray-200 hover:bg-gray-500 bg-gray-600"
                      >
                        Usar Prompt
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigator.clipboard.writeText(prompt)}
                        className="h-7 px-2 text-xs text-gray-300 hover:text-gray-100 hover:bg-gray-500"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="text-xs text-gray-400">
                      {prompt.split(' ').length} palavras
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

      </CardContent>
    </Card>
  )
}