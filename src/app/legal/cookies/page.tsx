import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function CookiesPage() {
  const lastUpdated = '26 de Agosto de 2025'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Política de Cookies
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
                1. O que são Cookies?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700">
                Cookies são pequenos arquivos de texto armazenados em seu dispositivo quando você visita um site. Eles são amplamente utilizados para fazer os sites funcionarem de forma eficiente, bem como fornecer informações aos proprietários do site.
              </p>
              <p className="text-gray-700">
                No <strong>Vibe Photo</strong>, utilizamos cookies e tecnologias similares para melhorar sua experiência, personalizar conteúdo e analisar como nossa plataforma é utilizada, sempre respeitando sua privacidade e preferências.
              </p>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-blue-800 text-sm">
                  <strong>Transparência:</strong> Esta política explica detalhadamente todos os cookies que utilizamos e como você pode controlar suas preferências.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Types of Cookies */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
2. Tipos de Cookies que Utilizamos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-base font-semibold">2.1 Cookies Essenciais (Necessários)</h3>
              <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                <p className="text-red-800 text-sm">
                  <strong>Sempre Ativos:</strong> Estes cookies são essenciais para o funcionamento do site e não podem ser desativados.
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">Cookie</th>
                      <th className="border border-gray-300 p-2 text-left">Finalidade</th>
                      <th className="border border-gray-300 p-2 text-left">Duração</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 p-2"><code>__session</code></td>
                      <td className="border border-gray-300 p-2">Gerenciamento de sessão do usuário</td>
                      <td className="border border-gray-300 p-2">Sessão</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2"><code>csrf_token</code></td>
                      <td className="border border-gray-300 p-2">Proteção contra ataques CSRF</td>
                      <td className="border border-gray-300 p-2">Sessão</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2"><code>auth_remember</code></td>
                      <td className="border border-gray-300 p-2">Lembrar login (quando solicitado)</td>
                      <td className="border border-gray-300 p-2">30 dias</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2"><code>cookie_consent</code></td>
                      <td className="border border-gray-300 p-2">Armazenar suas preferências de cookies</td>
                      <td className="border border-gray-300 p-2">1 ano</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-base font-semibold">2.2 Cookies Funcionais</h3>
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <p className="text-blue-800 text-sm">
                  <strong>Controláveis:</strong> Melhoram a funcionalidade e personalização. Você pode desativá-los.
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">Cookie</th>
                      <th className="border border-gray-300 p-2 text-left">Finalidade</th>
                      <th className="border border-gray-300 p-2 text-left">Duração</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 p-2"><code>theme_preference</code></td>
                      <td className="border border-gray-300 p-2">Lembrar tema escuro/claro preferido</td>
                      <td className="border border-gray-300 p-2">1 ano</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2"><code>language_pref</code></td>
                      <td className="border border-gray-300 p-2">Idioma preferido da interface</td>
                      <td className="border border-gray-300 p-2">6 meses</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2"><code>gallery_view</code></td>
                      <td className="border border-gray-300 p-2">Preferência de visualização da galeria</td>
                      <td className="border border-gray-300 p-2">3 meses</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2"><code>notification_settings</code></td>
                      <td className="border border-gray-300 p-2">Preferências de notificações</td>
                      <td className="border border-gray-300 p-2">1 ano</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-base font-semibold">2.3 Cookies de Análise</h3>
              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                <p className="text-green-800 text-sm">
                  <strong>Analíticos:</strong> Ajudam-nos a entender como melhorar nossos serviços. Totalmente opcionais.
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">Cookie</th>
                      <th className="border border-gray-300 p-2 text-left">Finalidade</th>
                      <th className="border border-gray-300 p-2 text-left">Duração</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 p-2"><code>_analytics_id</code></td>
                      <td className="border border-gray-300 p-2">Identificação anônima para análises</td>
                      <td className="border border-gray-300 p-2">2 anos</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2"><code>page_views</code></td>
                      <td className="border border-gray-300 p-2">Contabilizar visualizações de páginas</td>
                      <td className="border border-gray-300 p-2">1 dia</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2"><code>feature_usage</code></td>
                      <td className="border border-gray-300 p-2">Entender quais recursos são mais utilizados</td>
                      <td className="border border-gray-300 p-2">30 dias</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 p-2"><code>performance_metrics</code></td>
                      <td className="border border-gray-300 p-2">Monitorar performance do site</td>
                      <td className="border border-gray-300 p-2">7 dias</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-base font-semibold">2.4 O que NÃO utilizamos</h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-medium text-gray-800">Cookies que NÃO usamos:</p>
                <ul className="list-disc pl-6 space-y-1 text-sm text-gray-600">
                  <li>Cookies de marketing ou publicidade</li>
                  <li>Cookies de redes sociais para tracking</li>
                  <li>Cookies de terceiros para vendas</li>
                  <li>Cookies de retargeting</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Third Party */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
3. Tecnologias de Terceiros
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Algumas funcionalidades do nosso site utilizam serviços de terceiros que podem definir seus próprios cookies:
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-sm">
                    Vercel Analytics
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>Finalidade:</strong> Análises de performance e uso<br/>
                    <strong>Dados:</strong> Métricas agregadas e anônimas<br/>
                    <strong>Controle:</strong> Respeitamos suas preferências de cookies analíticos
                  </p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-sm">
                    NextAuth.js
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    <strong>Finalidade:</strong> Autenticação segura<br/>
                    <strong>Dados:</strong> Tokens de sessão criptografados<br/>
                    <strong>Controle:</strong> Essencial para login (sempre ativo)
                  </p>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                <p className="text-yellow-800">
                  <strong>Importante:</strong> Não utilizamos Google Analytics, Facebook Pixel ou outras ferramentas de tracking invasivas.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cookie Management */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
4. Como Gerenciar Suas Preferências de Cookies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-base font-semibold">4.1 Através da Nossa Plataforma</h3>
              <p>
                Você pode gerenciar suas preferências de cookies a qualquer momento:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Banner de Cookies:</strong> Aparece na primeira visita</li>
                <li><strong>Central de Preferências:</strong> Acesse através do rodapé da página</li>
                <li><strong>Configurações da Conta:</strong> Seção "Privacidade" em seu perfil</li>
              </ul>

              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                <p className="text-green-800 font-medium">
                  Controle Total: Você pode ativar ou desativar cada categoria de cookies individualmente, exceto os essenciais que são necessários para o funcionamento do site.
                </p>
              </div>

              <h3 className="text-base font-semibold">4.2 Através do Seu Navegador</h3>
              <p>
                Todos os navegadores modernos permitem gerenciar cookies:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="font-medium text-sm">Chrome</h4>
                  <p>Configurações → Privacidade → Cookies</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="font-medium text-sm">Firefox</h4>
                  <p>Opções → Privacidade → Cookies</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="font-medium text-sm">Safari</h4>
                  <p>Preferências → Privacidade → Cookies</p>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="font-medium text-sm">Edge</h4>
                  <p>Configurações → Privacidade → Cookies</p>
                </div>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
                <p className="text-orange-800 font-medium">
                  Atenção: Desativar todos os cookies pode afetar a funcionalidade do site, como manter você logado ou lembrar suas preferências.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Local Storage */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] bg-clip-text text-transparent">5. Outras Tecnologias de Armazenamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-base font-semibold">5.1 Local Storage</h3>
              <p>
                Utilizamos o Local Storage do navegador para:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Cache de interface:</strong> Acelerar carregamento de páginas</li>
                <li><strong>Dados temporários:</strong> Formulários em progresso (não sensíveis)</li>
                <li><strong>Configurações locais:</strong> Preferências de visualização</li>
              </ul>

              <h3 className="text-base font-semibold">5.2 Session Storage</h3>
              <p>
                Para dados que devem persistir apenas durante a sessão:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Estados temporários:</strong> Progresso de uploads</li>
                <li><strong>Navegação:</strong> Histórico de páginas visitadas na sessão</li>
                <li><strong>Cache temporário:</strong> Dados que aceleram a experiência</li>
              </ul>

              <p className="text-sm text-gray-600">
                <strong>Nota:</strong> Esses dados são armazenados apenas no seu dispositivo e são automaticamente limpos quando você fecha o navegador (Session Storage) ou quando limpa os dados do site (Local Storage).
              </p>
            </CardContent>
          </Card>

          {/* Updates */}
          <Card className="bg-white border border-gray-200">
            <CardHeader>
              <CardTitle className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] bg-clip-text text-transparent">6. Atualizações desta Política</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Esta Política de Cookies pode ser atualizada ocasionalmente. Quando isso acontecer:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>A data de "última atualização" será alterada</li>
                <li>Você será notificado através de um banner na próxima visita</li>
                <li>Mudanças significativas serão comunicadas por email</li>
                <li>Você poderá revisar e atualizar suas preferências</li>
              </ul>
              <p>
                Recomendamos revisar esta política periodicamente para se manter informado sobre como utilizamos cookies.
              </p>
            </CardContent>
          </Card>


          {/* Contact CTA */}
          <div className="mt-8">
            <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30">
              <CardContent className="text-center py-6">
                <CardTitle className="text-base font-medium text-white mb-3">
                  Dúvidas sobre nossa política?
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