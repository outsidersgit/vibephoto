import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

// ISR: Revalidar a cada 24 horas (Fase 2 - Otimização de Performance)
export const revalidate = 86400

export default function PrivacyPage() {
  const lastUpdated = '26 de Agosto de 2025'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Política de Privacidade
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
                Esta Política de Privacidade descreve como a <strong>Vibe Photo</strong> coleta, usa,
                armazena e protege suas informações pessoais quando você utiliza nossos serviços
                de geração de fotos com inteligência artificial.
              </p>
              <p className="text-gray-700">
                Estamos comprometidos em proteger sua privacidade e seguir rigorosamente a
                <strong> Lei Geral de Proteção de Dados (LGPD)</strong> e demais normas aplicáveis.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-blue-800 text-sm">
                  <strong>Importante:</strong> Ao utilizar nossos serviços, você concorda com esta política.
                  Se não concorda, não utilize nossa plataforma.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Collection */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
                2. Dados que Coletamos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-lg font-semibold">2.1 Dados Fornecidos por Você</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Informações de cadastro:</strong> nome, email, telefone</li>
                <li><strong>Dados de pagamento:</strong> informações de cobrança (processadas por parceiros seguros)</li>
                <li><strong>Fotografias:</strong> imagens faciais e corporais para treinamento de IA</li>
                <li><strong>Preferências:</strong> configurações de conta e preferências de geração</li>
              </ul>
              
              <h3 className="text-lg font-semibold">2.2 Dados Coletados Automaticamente</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Informações técnicas:</strong> IP, navegador, sistema operacional</li>
                <li><strong>Dados de uso:</strong> páginas visitadas, recursos utilizados, tempo de sessão</li>
                <li><strong>Cookies:</strong> conforme nossa <Link href="/legal/cookies" className="text-[#667EEA] hover:underline">Política de Cookies</Link></li>
              </ul>

              <div className="bg-amber-50 p-4 rounded-lg border-l-4 border-amber-500">
                <h4 className="font-medium text-amber-800 mb-2 text-sm">Dados Biométricos - Consentimento Especial</h4>
                <p className="text-amber-700 text-sm">
                  Suas fotografias são consideradas dados biométricos pela LGPD. Coletamos e processamos 
                  esses dados APENAS com seu consentimento explícito e exclusivamente para gerar seu 
                  modelo de IA personalizado.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Usage */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
3. Como Utilizamos seus Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-lg font-semibold">Finalidades do Tratamento</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-[#667eea] mb-2 text-sm">Execução do Serviço</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Treinamento de modelos de IA</li>
                    <li>Geração de imagens personalizadas</li>
                    <li>Armazenamento de resultados</li>
                  </ul>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-[#667eea] mb-2 text-sm">Gestão da Conta</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Autenticação e segurança</li>
                    <li>Processamento de pagamentos</li>
                    <li>Suporte ao cliente</li>
                  </ul>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-[#667eea] mb-2 text-sm">Melhorias do Produto</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Análise de uso (dados anonimizados)</li>
                    <li>Otimização de algoritmos</li>
                    <li>Desenvolvimento de recursos</li>
                  </ul>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-[#667eea] mb-2 text-sm">Obrigações Legais</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Cumprimento da LGPD</li>
                    <li>Resposta a autoridades</li>
                    <li>Prevenção de fraudes</li>
                  </ul>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                <h4 className="font-medium text-green-800 mb-2 text-sm">Base Legal (LGPD Art. 7º)</h4>
                <p className="text-green-700 text-sm">
                  Processamos seus dados com base em: <strong>consentimento</strong> (para dados biométricos), 
                  <strong>execução de contrato</strong> (para prestação do serviço), 
                  <strong>interesse legítimo</strong> (para melhorias de produto) e 
                  <strong>cumprimento de obrigação legal</strong>.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Sharing */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
4. Compartilhamento de Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                <h4 className="font-medium text-red-800 mb-2 text-sm">Nunca Compartilhamos</h4>
                <p className="text-red-700 text-sm">
                  Suas fotografias pessoais nunca são compartilhadas, vendidas ou utilizadas 
                  para outros fins além da geração do seu modelo personalizado.
                </p>
              </div>

              <h3 className="text-lg font-semibold">Compartilhamento Limitado</h3>
              <p>Compartilhamos dados apenas nas seguintes situações:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Processadores de pagamento:</strong> para processar cobranças (dados bancários criptografados)</li>
                <li><strong>Provedores de infraestrutura:</strong> para armazenamento seguro e processamento (AWS, etc.)</li>
                <li><strong>Ordem judicial:</strong> quando legalmente obrigatório</li>
                <li><strong>Proteção de direitos:</strong> para prevenir fraudes ou atividades ilegais</li>
              </ul>

              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <h4 className="font-medium text-blue-800 mb-2 text-sm">Contratos de Processamento</h4>
                <p className="text-blue-700 text-sm">
                  Todos os fornecedores assinam contratos de processamento de dados conforme LGPD, 
                  garantindo o mesmo nível de proteção dos seus dados.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Data Security */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
5. Segurança dos Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold">Medidas Técnicas</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Criptografia de dados em trânsito e repouso</li>
                    <li>Servidores seguros com certificação SSL</li>
                    <li>Backups automatizados e seguros</li>
                    <li>Monitoramento 24/7 de segurança</li>
                    <li>Controle de acesso baseado em funções</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Medidas Administrativas</h3>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Treinamento regular da equipe</li>
                    <li>Políticas internas de segurança</li>
                    <li>Auditorias periódicas</li>
                    <li>Plano de resposta a incidentes</li>
                    <li>Contratos de confidencialidade</li>
                  </ul>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
                <h4 className="font-medium text-purple-800 mb-2 text-sm">Compromisso com a Segurança</h4>
                <p className="text-purple-700 text-sm">
                  Implementamos as melhores práticas da indústria para proteger seus dados. 
                  Em caso de incidente, você será notificado conforme exige a LGPD.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* User Rights */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
6. Seus Direitos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Conforme a LGPD, você possui os seguintes direitos sobre seus dados pessoais:</p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-[#667eea] mb-2 text-sm">Acesso e Informação</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Confirmar se processamos seus dados</li>
                    <li>Acessar seus dados pessoais</li>
                    <li>Saber com quem compartilhamos</li>
                  </ul>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-[#667eea] mb-2 text-sm">Correção e Atualização</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Corrigir dados incompletos/inexatos</li>
                    <li>Atualizar informações desatualizadas</li>
                    <li>Completar dados faltantes</li>
                  </ul>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-[#667eea] mb-2 text-sm">Exclusão</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Solicitar exclusão de dados</li>
                    <li>Cancelar conta e dados</li>
                    <li>Revogar consentimento</li>
                  </ul>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-[#667eea] mb-2 text-sm">Portabilidade</h4>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Exportar seus dados</li>
                    <li>Receber em formato estruturado</li>
                    <li>Transmitir para outro fornecedor</li>
                  </ul>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <h4 className="font-medium text-blue-800 mb-2 text-sm">Como Exercer seus Direitos</h4>
                <p className="text-blue-700 text-sm mb-2">
                  Para exercer qualquer direito, entre em contato conosco através:
                </p>
                <ul className="text-blue-700 text-sm list-disc list-inside space-y-1">
                  <li><strong>Email:</strong> dpo@vibephoto.com</li>
                  <li><strong>Formulário:</strong> Configurações da conta → Privacidade</li>
                  <li><strong>Prazo de resposta:</strong> Até 15 dias conforme LGPD</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Data Retention */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">7. Retenção de Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas:</p>
              
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-[#667eea] mb-2 text-sm">Dados de Treinamento (Fotos)</h4>
                  <p className="text-sm text-gray-600">
                    <strong>Durante a conta ativa:</strong> Mantemos para gerar novos modelos<br/>
                    <strong>Após cancelamento:</strong> Excluídos em até 30 dias
                  </p>
                </div>
                
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-[#667eea] mb-2 text-sm">Modelos de IA Gerados</h4>
                  <p className="text-sm text-gray-600">
                    <strong>Durante a conta ativa:</strong> Disponíveis para geração<br/>
                    <strong>Após cancelamento:</strong> Excluídos em até 30 dias
                  </p>
                </div>
                
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-[#667eea] mb-2 text-sm">Imagens Geradas</h4>
                  <p className="text-sm text-gray-600">
                    <strong>Propriedade sua:</strong> Mantemos até você solicitar exclusão<br/>
                    <strong>Backup disponível:</strong> Para download por até 90 dias após cancelamento
                  </p>
                </div>
                
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-[#667eea] mb-2 text-sm">Dados de Conta e Pagamento</h4>
                  <p className="text-sm text-gray-600">
                    <strong>Obrigação legal:</strong> 5 anos (legislação fiscal)<br/>
                    <strong>Dados anonimizados:</strong> Para análises e melhorias
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-gray-400">
                <h4 className="font-medium text-gray-800 mb-2 text-sm">Exclusão Automática</h4>
                <p className="text-gray-700 text-sm">
                  Implementamos processos automatizados para exclusão de dados conforme os prazos estabelecidos, 
                  garantindo que nenhum dado seja mantido além do necessário.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Updates */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">8. Alterações nesta Política</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Podemos atualizar esta Política de Privacidade periodicamente para refletir mudanças 
                em nossas práticas ou por outros motivos operacionais, legais ou regulatórios.
              </p>
              
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <h4 className="font-medium text-blue-800 mb-2 text-sm">Como você será notificado</h4>
                <ul className="text-blue-700 text-sm list-disc list-inside space-y-1">
                  <li><strong>Email:</strong> Para mudanças significativas</li>
                  <li><strong>Notificação na plataforma:</strong> Ao fazer login</li>
                  <li><strong>Prazo:</strong> 30 dias antes das alterações entrarem em vigor</li>
                </ul>
              </div>

              <p className="text-sm text-gray-600">
                Recomendamos que você revise esta política periodicamente para se manter informado 
                sobre como protegemos suas informações.
              </p>
            </CardContent>
          </Card>


          {/* Contact CTA */}
          <div className="mt-8">
            <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30">
              <CardContent className="text-center py-6">
                <CardTitle className="text-base font-medium text-white mb-3">
                  Dúvidas sobre sua privacidade?
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