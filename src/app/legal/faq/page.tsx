'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
  category: 'geral' | 'funcionamento' | 'pagamento' | 'privacidade' | 'tecnico'
}

const faqData: FAQItem[] = [
  // Geral
  {
    category: 'geral',
    question: 'O que é o Vibe Photo?',
    answer: 'O Vibe Photo é uma plataforma que utiliza inteligência artificial para gerar fotos profissionais personalizadas. Você envia suas selfies, nossa IA treina um modelo único baseado no seu rosto e depois pode gerar fotos suas em qualquer cenário, pose ou estilo que desejar.'
  },
  {
    category: 'geral',
    question: 'Como funciona o sistema de créditos?',
    answer: 'Cada geração de foto consome créditos do seu plano. O plano Starter oferece 500 créditos/mês, Premium 1200 créditos/mês e Gold 2500 créditos/mês. Os créditos são renovados mensalmente e não acumulam entre os períodos. Você também pode comprar pacotes de créditos únicos que são válidos por 1 ano.'
  },
  {
    category: 'geral',
    question: 'Posso usar as fotos geradas comercialmente?',
    answer: 'Sim! Todas as fotos geradas pela nossa IA são de sua propriedade e podem ser usadas para fins comerciais, redes sociais, marketing pessoal, portfólios e qualquer outro propósito que desejar.'
  },
  {
    category: 'geral',
    question: 'Quantos modelos de IA posso criar?',
    answer: 'Cada assinatura dá direito à criação de 1 modelo de IA. Modelos adicionais podem ser criados ao custo de 500 créditos cada. A compra de pacotes de créditos serve como alternativa para gerar novos modelos quando os créditos do plano forem insuficientes.'
  },
  {
    category: 'geral',
    question: 'Qual o melhor plano para iniciantes?',
    answer: 'Para iniciantes, recomendamos o plano Premium (R$ 179/mês) que oferece 1200 créditos, 1 modelo de IA e processamento rápido.'
  },

  // Funcionamento
  {
    category: 'funcionamento',
    question: 'Quantas fotos preciso enviar para treinar meu modelo?',
    answer: 'Recomendamos entre 15-30 fotos de alta qualidade. Inclua selfies em diferentes ângulos, expressões e iluminações. Quanto mais variadas as fotos de treinamento, melhor será a qualidade dos resultados gerados.'
  },
  {
    category: 'funcionamento',
    question: 'Quanto tempo demora para treinar um modelo?',
    answer: 'O treinamento de um modelo personalizado leva entre 10-30 minutos, dependendo da complexidade e qualidade das fotos enviadas. Você receberá uma notificação por email quando o modelo estiver pronto para uso.'
  },
  {
    category: 'funcionamento',
    question: 'Que tipos de fotos posso gerar?',
    answer: 'Você pode gerar fotos em praticamente qualquer cenário: profissionais (linkedin, currículos), casuais (redes sociais), artísticas, em diferentes locações (praia, cidade, natureza), com diferentes roupas e estilos. As possibilidades são praticamente ilimitadas!'
  },
  {
    category: 'funcionamento',
    question: 'Qual a qualidade das fotos geradas?',
    answer: 'Todas as imagens são geradas na qualidade máxima disponível, independentemente do plano. Vale lembrar que a qualidade final depende das fotos de treinamento que você enviar.'
  },
  {
    category: 'funcionamento',
    question: 'Posso editar ou refazer uma foto gerada?',
    answer: 'Sim. Você pode editar qualquer foto (gerada aqui ou enviada) no nosso Editor IA. É edição não destrutiva: o original fica preservado.'
  },
  {
    category: 'funcionamento',
    question: 'Quantos créditos cada foto consome?',
    answer: 'Cada foto gerada consome, por padrão, 10 créditos, independentemente do plano. Alguns pacotes de fotos podem ter custo superior por imagem, conforme o nível de detalhamento ou exclusividade do pacote.'
  },
  {
    category: 'funcionamento',
    question: 'Como funciona o Upscale de imagens?',
    answer: 'O Upscale é uma ferramenta que aumenta a resolução e aprimora a nitidez das suas fotos, elevando o nível de detalhe e realismo. Cada uso custa 10 créditos por imagem e pode ampliar a resolução em até 4x.'
  },
  {
    category: 'funcionamento',
    question: 'Como funciona a geração de vídeos?',
    answer: 'Nossa ferramenta de geração de vídeos permite criar clipes curtos e realistas a partir de imagens ou descrições em texto. Os vídeos são gerados em alta qualidade (1080p), com animações, transições e movimentos naturais. O custo é de 100 créditos para vídeos de 5 segundos e 200 créditos para vídeos de 10 segundos.'
  },
  {
    category: 'funcionamento',
    question: 'Como funciona o Editor IA?',
    answer: 'O Editor IA permite editar ou criar qualquer imagem — seja sua, gerada na plataforma ou totalmente nova. Você pode recriar fotos famosas, montar campanhas publicitárias ou dar vida a qualquer ideia usando comandos de texto simples. Modifique cenários, troque roupas, ajuste luz, remova objetos ou combine imagens com realismo total. Cada edição custa 15 créditos.'
  },
  {
    category: 'funcionamento',
    question: 'O que são Pacotes de Fotos?',
    answer: 'Pacotes de Fotos são coleções temáticas pré-configuradas. Você seleciona um pacote (ex: "Quiet luxury", "Summer vibes"), escolhe seu modelo de IA e gera automaticamente 20 fotos no mesmo estilo. Cada pacote tem seu próprio custo em créditos, variando entre 200-400 créditos dependendo da categoria e exclusividade das fotos geradas.'
  },

  // Pagamento
  {
    category: 'pagamento',
    question: 'Quais formas de pagamento vocês aceitam?',
    answer: 'Aceitamos cartões de crédito e débito (Visa, Mastercard, Elo) e PIX através da nossa parceira Asaas. Todos os pagamentos são processados de forma segura e criptografada.'
  },
  {
    category: 'pagamento',
    question: 'Posso cancelar minha assinatura a qualquer momento?',
    answer: 'Sim, você pode cancelar sua assinatura a qualquer momento através do botão "Cancelar assinatura" na área "Minha Assinatura". O cancelamento será efetivo no final do período atual, e você continuará tendo acesso até o vencimento.'
  },
  {
    category: 'pagamento',
    question: 'Vocês oferecem reembolso?',
    answer: 'Conforme o Código de Defesa do Consumidor (Art. 49), você tem direito ao reembolso integral em até 7 dias da contratação, APENAS se nenhuma solicitação de geração de imagem ou treinamento de modelo for realizada. Após o primeiro uso dos recursos computacionais (GPU/IA), não há direito de desistência devido aos custos imediatos e irreversíveis de processamento.'
  },
  {
    category: 'pagamento',
    question: 'O que acontece se eu ultrapassar meu limite de créditos?',
    answer: 'Quando seus créditos acabarem, você não conseguirá gerar novas fotos até o próximo período de renovação ou upgrade de plano. Você pode fazer upgrade a qualquer momento ou comprar um pacote de créditos únicos para obter mais créditos imediatamente.'
  },
  {
    category: 'pagamento',
    question: 'Qual a diferença entre planos de assinatura e pacotes de créditos?',
    answer: 'Os planos de assinatura (Starter, Premium e Gold) renovam automaticamente a cada mês, liberando novos crédito. Cada assinatura dá direito à criação de 1 modelo de IA, e modelos adicionais podem ser criados por 500 créditos cada. Já os pacotes de créditos únicos (Essencial, Avançado, Pro e Enterprise) são compras avulsas, não se renovam automaticamente, têm validade de 1 ano e são ideais para uso pontual ou complementar.'
  },
  {
    category: 'pagamento',
    question: 'Os pacotes de créditos únicos expiram?',
    answer: 'Sim, os créditos dos pacotes únicos são válidos por 1 ano após a compra. Após esse período, os créditos não utilizados expiram. Recomendamos o uso dentro do prazo de validade para aproveitar ao máximo seu investimento.'
  },
  {
    category: 'pagamento',
    question: 'Posso combinar plano de assinatura com pacotes de créditos?',
    answer: 'Sim! Você pode ter um plano de assinatura ativo e ainda comprar pacotes de créditos únicos quando necessário. Os créditos são consumidos primeiro dos pacotes únicos (por ordem de expiração) e depois dos créditos mensais da assinatura.'
  },
  {
    category: 'pagamento',
    question: 'Como cancelar minha assinatura e excluir minha conta?',
    answer: 'Para excluir sua conta, você deve PRIMEIRO cancelar sua assinatura ativa. Vá em "Minha Assinatura" e clique em "Cancelar Assinatura". Aguarde a confirmação do cancelamento. Após isso, você pode solicitar a exclusão da conta em "Perfil > Excluir Conta". A exclusão de conta é irreversível e removerá todos os seus dados, fotos e modelos permanentemente.'
  },
  {
    category: 'pagamento',
    question: 'Qual é o valor dos pacotes de créditos únicos?',
    answer: 'Oferecemos 4 opções: Pacote Essencial (R$ 89 - 350 créditos), Pacote Avançado (R$ 179 - 1000 créditos), Pacote Pro (R$ 359 - 2200 créditos) e Pacote Enterprise (R$ 899 - 5000 créditos). Todos são válidos por 1 ano.'
  },

  // Privacidade
  {
    category: 'privacidade',
    question: 'Minhas fotos estão seguras?',
    answer: 'Sim! Suas fotos são armazenadas com criptografia de nível militar em servidores seguros. Apenas você tem acesso às suas fotos e modelos. Nunca compartilhamos, vendemos ou usamos suas imagens para outros fins que não sejam gerar seu modelo personalizado.'
  },
  {
    category: 'privacidade',
    question: 'Vocês usam minhas fotos para treinar outros modelos?',
    answer: 'Não! Suas fotos são usadas exclusivamente para criar seu modelo pessoal. Não utilizamos suas imagens para melhorar nossos algoritmos ou treinar modelos para outros usuários. Sua privacidade é nossa prioridade máxima.'
  },
  {
    category: 'privacidade',
    question: 'Posso excluir meus dados e fotos?',
    answer: 'Sim, você pode solicitar a exclusão completa de todos os seus dados, fotos e modelos a qualquer momento através de nossa área de privacidade ou entrando em contato conosco. O processo é irreversível e ocorre em até 30 dias.'
  },
  {
    category: 'privacidade',
    question: 'Onde meus dados são armazenados?',
    answer: 'Seus dados são armazenados em servidores seguros na AWS (Amazon Web Services) e podem ser processados em centros de dados nos EUA e Brasil. Seguimos rigorosamente as normas da LGPD para transferência internacional de dados.'
  },

  // Técnico
  {
    category: 'tecnico',
    question: 'Qual formato de fotos devo enviar?',
    answer: 'Aceitamos formatos JPG, PNG e WebP. Recomendamos fotos com pelo menos 512x512 pixels, bem iluminadas e com o rosto claramente visível. Evite fotos muito escuras, borradas ou com óculos escuros.'
  },
  {
    category: 'tecnico',
    question: 'Posso usar o serviço no celular?',
    answer: 'Sim! Nossa plataforma é totalmente responsiva e funciona perfeitamente em celulares, tablets e computadores. Você pode fazer upload de fotos e gerar imagens diretamente do seu smartphone.'
  },
  {
    category: 'tecnico',
    question: 'Há limite de armazenamento para minhas fotos?',
    answer: 'Não há limite específico de armazenamento. Você pode manter todas as fotos geradas em sua galeria. Fotos de treinamento são mantidas apenas durante o processo e podem ser excluídas após a criação do modelo, se desejar.'
  },
  {
    category: 'tecnico',
    question: 'O serviço funciona offline?',
    answer: 'Não, o Vibe Photo é um serviço online que requer conexão com a internet para funcionar. O processamento de IA acontece em nossos servidores para garantir a máxima qualidade e velocidade.'
  }
]

const categories = {
  geral: { name: 'Geral' },
  funcionamento: { name: 'Como Funciona' },
  pagamento: { name: 'Pagamento' },
  privacidade: { name: 'Privacidade' },
  tecnico: { name: 'Técnico' }
}

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<number[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const toggleItem = (index: number) => {
    setOpenItems(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const filteredFAQ = selectedCategory
    ? faqData.filter(item => item.category === selectedCategory)
    : faqData

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Perguntas Frequentes
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              !selectedCategory
                ? 'bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] text-white border border-slate-600/30'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            Todas
          </button>
          {Object.entries(categories).map(([key, category]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === key
                  ? 'bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] text-white border border-slate-600/30'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* FAQ Items */}
        <div className="space-y-2">
          {filteredFAQ.map((item, index) => {
            const isOpen = openItems.includes(index)

            return (
              <Card key={index} className="border border-gray-200 bg-white">
                <CardHeader
                  className="cursor-pointer py-4"
                  onClick={() => toggleItem(index)}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium text-gray-900 text-left">
                      {item.question}
                    </CardTitle>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent className="pt-0 pb-4">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {item.answer}
                    </p>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>

        {/* Contact CTA */}
        <div className="mt-8">
          <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30">
            <CardContent className="text-center py-6">
              <CardTitle className="text-base font-medium text-white mb-3">
                Não encontrou sua resposta?
              </CardTitle>
              <p className="text-sm text-slate-300 mb-4">
                Entre em contato conosco através do nosso formulário de suporte
              </p>
              <a
                href="/support"
                className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-[#667EEA] to-[#764BA2] text-white text-sm font-medium rounded-lg hover:from-[#5a6fd8] hover:to-[#6a4190] transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Entrar em Contato
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}