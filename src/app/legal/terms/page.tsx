import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

// ISR: Revalidar a cada 24 horas (Fase 2 - Otimização de Performance)
export const revalidate = 86400

export default function TermsPage() {
  const lastUpdated = '26 de Agosto de 2025'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Termos de Uso
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="space-y-6">
          {/* Introduction */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
                1. Introdução
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Bem-vindo ao <strong>Vibe Photo</strong>! Estes Termos de Uso regulamentam o uso de nossa plataforma de geração de fotos com inteligência artificial. Ao acessar ou utilizar nossos serviços, você concorda em cumprir estes termos.
              </p>
              <p className="text-gray-700">
                O <strong>Vibe Photo</strong> é operado por [Nome da Empresa], empresa brasileira inscrita no CNPJ [CNPJ], com sede em [Endereço Completo].
              </p>
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <p className="text-amber-800 text-sm">
                  <strong>Importante:</strong> Se você não concorda com estes termos, não utilize nossos serviços.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Service Description */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
                2. Descrição do Serviço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                O Vibe Photo oferece um serviço de Software como Serviço (SaaS) que utiliza inteligência artificial para:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Treinar modelos de IA personalizados baseados nas fotos do usuário</li>
                <li>Gerar imagens fotorrealísticas do usuário em diferentes cenários</li>
                <li>Fornecer ferramentas de edição e personalização de imagens</li>
                <li>Armazenar e organizar as imagens geradas em galerias pessoais</li>
              </ul>
              <p className="text-gray-700">
                Nossos serviços são oferecidos através de diferentes planos de assinatura com limitações de uso específicas.
              </p>
            </CardContent>
          </Card>

          {/* User Obligations */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
                3. Obrigações do Usuário
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900">3.1 Uso Aceitável</h3>
              <p className="text-gray-700">Você se compromete a:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Fornecer informações verdadeiras e atualizadas durante o cadastro</li>
                <li>Usar apenas fotos próprias ou com autorização expressa das pessoas retratadas</li>
                <li>Não criar conteúdo que viole direitos de terceiros</li>
                <li>Não utilizar o serviço para fins ilegais, fraudulentos ou prejudiciais</li>
                <li>Respeitar os limites de uso do seu plano contratado</li>
              </ul>

              <h3 className="text-base font-semibold text-gray-900">3.2 Uso Proibido</h3>
              <p className="text-gray-700">É expressamente proibido:</p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Gerar conteúdo pornográfico, violento ou discriminatório</li>
                <li>Criar deepfakes ou conteúdo enganoso de terceiros sem consentimento</li>
                <li>Usar fotos de menores de idade (exceto pelos próprios pais/responsáveis)</li>
                <li>Tentar contornar as limitações técnicas ou de segurança da plataforma</li>
                <li>Revender ou redistribuir nossos serviços sem autorização</li>
              </ul>

              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <p className="text-red-800 text-sm">
                  <strong>Importante:</strong> Violações podem resultar em suspensão imediata da conta sem reembolso.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Terms */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
                4. Pagamentos e Assinaturas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900">4.1 Planos e Preços</h3>
              <p className="text-gray-700">
                Oferecemos três planos de assinatura: Starter, Premium e Gold. Os preços e recursos estão descritos em nossa página de preços e podem ser alterados mediante aviso prévio de 30 dias.
              </p>

              <h3 className="text-base font-semibold text-gray-900">4.2 Cobrança</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>As assinaturas são cobradas mensalmente ou anualmente</li>
                <li>A cobrança ocorre no início de cada período</li>
                <li>Créditos não utilizados não são acumulados entre períodos</li>
                <li>Upgrades são cobrados proporcionalmente no período atual</li>
              </ul>

              <h3 className="text-base font-semibold text-gray-900">4.3 Cancelamento</h3>
              <p className="text-gray-700">
                Você pode cancelar sua assinatura a qualquer momento. O cancelamento será efetivo no final do período de cobrança atual, sem direito a reembolso proporcional, exceto conforme previsto em nossa política de reembolso.
              </p>

              <h3 className="text-base font-semibold text-gray-900">4.4 Política de Reembolso e Direito de Desistência</h3>

              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-4">
                <h4 className="font-medium text-amber-800 mb-2 text-sm">Direito de Desistência (CDC Art. 49)</h4>
                <p className="text-amber-700 text-sm">
                  Conforme o Código de Defesa do Consumidor, você tem <strong>7 dias</strong> para desistir do serviço <strong>APENAS</strong> se nenhuma solicitação de geração de imagem ou treinamento de modelo for realizada.
                </p>
              </div>

              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Reembolso integral:</strong> Disponível em até 7 dias da contratação, exclusivamente se nenhum recurso computacional for utilizado (treinamento de modelo ou geração de imagens)</li>
                <li><strong>Após primeiro uso:</strong> Devido aos custos imediatos e irreversíveis de processamento em GPU/IA, não há direito de desistência ou reembolso</li>
                <li><strong>Falhas técnicas:</strong> Reembolso proporcional em caso de indisponibilidade prolongada por nossa responsabilidade</li>
                <li><strong>Violações de termos:</strong> Não há reembolso para contas suspensas por violação destes termos</li>
              </ul>

              <div className="bg-red-50 p-4 rounded-lg border border-red-200 mt-4">
                <p className="text-red-800 text-sm">
                  <strong>Importante:</strong> Uma vez iniciado qualquer processamento de IA (treinamento ou geração), os custos computacionais são imediatos e irreversíveis, não cabendo reembolso conforme política transparente de custos de infraestrutura.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Intellectual Property */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">5. Propriedade Intelectual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900">5.1 Propriedade das Imagens Geradas</h3>
              <p className="text-gray-700">
                Você mantém todos os direitos sobre as imagens geradas através de nossa plataforma e pode usá-las livremente para fins pessoais e comerciais.
              </p>

              <h3 className="text-base font-semibold text-gray-900">5.2 Licença para Nossos Serviços</h3>
              <p className="text-gray-700">
                Ao utilizar nossos serviços, você nos concede uma licença limitada, não exclusiva e revogável para processar suas fotos exclusivamente para:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Treinar seu modelo personalizado de IA</li>
                <li>Gerar as imagens solicitadas por você</li>
                <li>Melhorar nossos algoritmos (apenas dados anonimizados)</li>
              </ul>

              <h3 className="text-base font-semibold text-gray-900">5.3 Propriedade da Plataforma</h3>
              <p className="text-gray-700">
                Todos os direitos sobre nossa plataforma, código, algoritmos e marca permanecem nossa propriedade exclusiva.
              </p>
            </CardContent>
          </Card>

          {/* Limitations */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">6. Limitações de Responsabilidade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900">6.1 Disponibilidade</h3>
              <p className="text-gray-700">
                Nos esforçamos para manter nossos serviços disponíveis 24/7, mas não garantimos 100% de uptime. Manutenções programadas serão comunicadas com antecedência.
              </p>

              <h3 className="text-base font-semibold text-gray-900">6.2 Qualidade dos Resultados</h3>
              <p className="text-gray-700">
                A qualidade das imagens geradas depende de vários fatores, incluindo a qualidade das fotos de treinamento. Não garantimos resultados específicos.
              </p>

              <h3 className="text-base font-semibold text-gray-900">6.3 Limitação de Danos</h3>
              <p className="text-gray-700">
                Nossa responsabilidade total não excederá o valor pago por você nos 12 meses anteriores ao evento que originou a reclamação.
              </p>

              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <p className="text-amber-800 text-sm">
                  <strong>Importante:</strong> Você é responsável pelo uso adequado das imagens geradas e por respeitar direitos de terceiros.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Privacy */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">7. Privacidade e Proteção de Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                O tratamento dos seus dados pessoais é regido por nossa{' '}
                <Link href="/legal/privacy" className="text-blue-600 hover:underline">
                  Política de Privacidade
                </Link>
                , que faz parte integrante destes Termos de Uso.
              </p>
              <p className="text-gray-700">
                Cumprimos integralmente a Lei Geral de Proteção de Dados (LGPD) e todas as normas aplicáveis de proteção de dados.
              </p>
            </CardContent>
          </Card>

          {/* Modifications */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">8. Modificações dos Termos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Podemos atualizar estes Termos de Uso periodicamente. Alterações significativas serão comunicadas por email ou através de notificação em nossa plataforma com pelo menos 30 dias de antecedência.
              </p>
              <p className="text-gray-700">
                O uso continuado dos serviços após as modificações constitui aceitação dos novos termos.
              </p>
            </CardContent>
          </Card>

          {/* Termination */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">9. Encerramento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Podemos encerrar ou suspender sua conta imediatamente, sem aviso prévio, por:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Violação destes Termos de Uso</li>
                <li>Atividade fraudulenta ou ilegal</li>
                <li>Não pagamento de taxas devidas</li>
                <li>Comportamento prejudicial a outros usuários</li>
              </ul>
              <p className="text-gray-700">
                Você pode encerrar sua conta a qualquer momento através das configurações da conta.
              </p>
            </CardContent>
          </Card>

          {/* Applicable Law */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">10. Lei Aplicável e Jurisdição</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Estes Termos de Uso são regidos pelas leis brasileiras. Qualquer disputa será resolvida no foro da comarca de [Cidade/Estado], com renúncia expressa a qualquer outro foro.
              </p>
              <p className="text-gray-700">
                Tentaremos resolver disputas através de mediação antes de recorrer ao judiciário.
              </p>
            </CardContent>
          </Card>

          {/* Contact CTA */}
          <div className="mt-8">
            <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30">
              <CardContent className="text-center py-6">
                <CardTitle className="text-base font-medium text-white mb-3">
                  Dúvidas sobre os termos?
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
    </div>
  )
}