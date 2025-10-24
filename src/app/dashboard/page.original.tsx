import { requireActiveSubscription } from '@/lib/subscription'
import { prisma } from '@/lib/db'
import { withRetry, withFallback, dbCircuitBreaker } from '@/lib/db/utils'
import { redirect } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreditsOverview } from '@/components/dashboard/credits-overview'
import { AnalyticsDashboard } from '@/components/dashboard/analytics-dashboard'
import { 
  BarChart3, 
  Coins, 
  Image as ImageIcon, 
  Users, 
  TrendingUp,
  Plus,
  Zap,
  Calendar
} from 'lucide-react'
import Link from 'next/link'

async function fetchUserData(userId: string) {
  return await withRetry(
    () => dbCircuitBreaker.execute(() =>
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          creditsUsed: true,
          creditsLimit: true,
          createdAt: true
        }
      })
    ),
    { maxRetries: 2, baseDelay: 2000 }
  ).catch(error => {
    console.error('Failed to fetch user data after retries:', error)
    return null
  })
}

async function fetchModels(userId: string) {
  return await withFallback(
    () => dbCircuitBreaker.execute(() =>
      prisma.aIModel.findMany({
        where: { userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          qualityScore: true,
          createdAt: true,
          _count: {
            select: {
              generations: true
            }
          }
        }
      })
    ),
    [] // fallback to empty array
  )
}

async function fetchRecentGenerations(userId: string) {
  return await withFallback(
    () => dbCircuitBreaker.execute(() =>
      prisma.generation.findMany({
        where: { userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          prompt: true,
          status: true,
          imageUrls: true,
          createdAt: true,
          model: {
            select: {
              name: true
            }
          }
        }
      })
    ),
    [] // fallback to empty array
  )
}

async function fetchRecentActivity(userId: string) {
  return await withFallback(
    () => dbCircuitBreaker.execute(() =>
      prisma.usageLog.findMany({
        where: { userId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          action: true,
          creditsUsed: true,
          details: true,
          createdAt: true
        }
      })
    ),
    [] // fallback to empty array
  )
}

async function getCompletedGenerationsCount(userId: string) {
  return await withFallback(
    () => dbCircuitBreaker.execute(() =>
      prisma.generation.count({ 
        where: { userId, status: 'COMPLETED' } 
      })
    ),
    0 // fallback to zero
  )
}

export default async function DashboardPage() {
  const session = await requireActiveSubscription()
  const userId = session.user.id

  if (!userId) {
    redirect('/auth/signin')
  }

  // Fetch user data with individual error handling for better resilience
  const [user, models, recentGenerations, recentActivity] = await Promise.allSettled([
    fetchUserData(userId),
    fetchModels(userId),
    fetchRecentGenerations(userId),
    fetchRecentActivity(userId)
  ])

  // Extract resolved values with fallbacks
  const userData = user.status === 'fulfilled' ? user.value : null
  const modelsData = models.status === 'fulfilled' ? models.value : []
  const generationsData = recentGenerations.status === 'fulfilled' ? recentGenerations.value : []
  const activityData = recentActivity.status === 'fulfilled' ? recentActivity.value : []

  // Get completed generations count separately with error handling
  const completedGenerations = await getCompletedGenerationsCount(userId)

  // Get quick stats from user record with safe fallbacks
  const stats = {
    totalModels: (userData as any)?.totalModels || modelsData.length || 0,
    totalGenerations: (userData as any)?.totalGenerations || generationsData.length || 0,
    completedGenerations,
    totalCreditsUsed: (userData as any)?.totalCreditsUsed || (userData?.creditsUsed || 0)
  }

  // Use session data as fallback for critical user info
  const displayUser = userData || {
    id: userId,
    name: session.user.name,
    email: session.user.email,
    plan: session.user.plan || 'FREE',
    creditsUsed: session.user.creditsUsed || 0,
    creditsLimit: session.user.creditsLimit || 10,
    createdAt: new Date()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READY':
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'TRAINING':
      case 'PROCESSING':
        return 'bg-yellow-100 text-yellow-800'
      case 'ERROR':
      case 'FAILED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const successRate = stats.totalGenerations > 0 
    ? Math.round((stats.completedGenerations / stats.totalGenerations) * 100)
    : 0

  // Check if we have any database connection issues
  const hasConnectionIssues = user.status === 'rejected' || 
                              models.status === 'rejected' || 
                              recentGenerations.status === 'rejected' || 
                              recentActivity.status === 'rejected'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/5 via-white to-[#764BA2]/5">
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Development Mode Warning */}
        {session.subscriptionInfo?.isInDevelopmentMode && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Modo de Desenvolvimento:</strong> Simulando assinatura ativa para testes. <code>DEV_SIMULATE_PAID_SUBSCRIPTION=true</code>
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Connection Warning */}
        {hasConnectionIssues && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Conexão instável:</strong> Alguns dados podem estar desatualizados devido a problemas temporários de conectividade.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[#667EEA] to-[#764BA2] bg-clip-text text-transparent">
                Bem-vindo de volta, {displayUser?.name || 'Usuário'}!
              </h1>
              <p className="text-gray-600 mt-1">
                Aqui está o que está acontecendo com seus modelos de IA e gerações
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="flex items-center">
                <Coins className="w-4 h-4 mr-1" />
                {(displayUser?.creditsLimit || 0) - (displayUser?.creditsUsed || 0)} créditos
              </Badge>
              <Badge variant="outline">
                Plano {displayUser?.plan}
              </Badge>
              <Button asChild>
                <Link href="/models/create">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Modelo
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="border-none shadow-md hover:shadow-lg transition-all bg-gradient-to-br from-[#667EEA]/10 to-[#667EEA]/5 border-l-4 border-l-[#667EEA]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Total de Modelos</CardTitle>
              <Users className="h-4 w-4 text-[#667EEA]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#667EEA]">{stats.totalModels}</div>
              <p className="text-xs text-gray-600">
                Modelos de IA criados
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md hover:shadow-lg transition-all bg-gradient-to-br from-[#764BA2]/10 to-[#764BA2]/5 border-l-4 border-l-[#764BA2]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Gerações</CardTitle>
              <ImageIcon className="h-4 w-4 text-[#764BA2]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#764BA2]">{stats.totalGenerations}</div>
              <p className="text-xs text-gray-600">
                Imagens geradas
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md hover:shadow-lg transition-all bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-l-4 border-l-emerald-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Taxa de Sucesso</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-500">{successRate}%</div>
              <p className="text-xs text-gray-600">
                Gerações bem-sucedidas
              </p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md hover:shadow-lg transition-all bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-l-4 border-l-amber-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">Créditos Usados</CardTitle>
              <Zap className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-500">{stats.totalCreditsUsed || 0}</div>
              <p className="text-xs text-gray-600">
                Total de créditos gastos
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-gray-100/50 p-1 rounded-lg">
            <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#667EEA] data-[state=active]:to-[#764BA2] data-[state=active]:text-white">Visão Geral</TabsTrigger>
            <TabsTrigger value="credits" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#667EEA] data-[state=active]:to-[#764BA2] data-[state=active]:text-white">Créditos e Uso</TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#667EEA] data-[state=active]:to-[#764BA2] data-[state=active]:text-white">Análises</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">

            <div className="grid gap-6 md:grid-cols-2">
              {/* Recent Models */}
              <Card className="border-none shadow-md hover:shadow-lg transition-all bg-gradient-to-br from-white to-gray-50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between bg-gradient-to-r from-[#667EEA] to-[#764BA2] bg-clip-text text-transparent">
                    Modelos Recentes
                    <Button variant="outline" size="sm" asChild className="border-[#667EEA] text-[#667EEA] hover:bg-[#667EEA] hover:text-white">
                      <Link href="/models">Ver Todos</Link>
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {modelsData.length > 0 ? (
                    <div className="space-y-3">
                      {modelsData.map((model) => (
                        <div key={model.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900">{model.name}</div>
                            <div className="text-sm text-gray-500">
                              {model._count.generations} gerações
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {model.qualityScore && (
                              <Badge variant="outline" className="text-xs">
                                {model.qualityScore}%
                              </Badge>
                            )}
                            <Badge variant="secondary" className={getStatusColor(model.status)}>
                              {model.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="mb-2">{models.status === 'rejected' ? 'Erro ao carregar modelos' : 'Nenhum modelo ainda'}</p>
                      <Button asChild size="sm">
                        <Link href="/models/create">Criar Seu Primeiro Modelo</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Generations */}
              <Card className="border-none shadow-md hover:shadow-lg transition-all bg-gradient-to-br from-white to-gray-50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between bg-gradient-to-r from-[#667EEA] to-[#764BA2] bg-clip-text text-transparent">
                    Gerações Recentes
                    <Button variant="outline" size="sm" asChild className="border-[#764BA2] text-[#764BA2] hover:bg-[#764BA2] hover:text-white">
                      <Link href="/gallery">Ver Todas</Link>
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {generationsData.length > 0 ? (
                    <div className="space-y-3">
                      {generationsData.map((generation) => (
                        <div key={generation.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="text-sm text-gray-900 line-clamp-2">
                              {generation.prompt}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {generation.model?.name} • {new Date(generation.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="ml-3 flex items-center space-x-2">
                            {generation.imageUrls.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {generation.imageUrls.length} imagens
                              </Badge>
                            )}
                            <Badge variant="secondary" className={getStatusColor(generation.status)}>
                              {generation.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="mb-2">{recentGenerations.status === 'rejected' ? 'Erro ao carregar gerações' : 'Nenhuma geração ainda'}</p>
                      <Button asChild size="sm">
                        <Link href="/generate">Gerar Sua Primeira Imagem</Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="border-none shadow-md hover:shadow-lg transition-all bg-gradient-to-br from-white to-gray-50">
              <CardHeader>
                <CardTitle className="flex items-center bg-gradient-to-r from-[#667EEA] to-[#764BA2] bg-clip-text text-transparent">
                  <Calendar className="w-5 h-5 mr-2 text-[#667EEA]" />
                  Atividade Recente
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activityData.length > 0 ? (
                  <div className="space-y-3">
                    {activityData.map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${
                            activity.creditsUsed < 0 ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {(activity.details as any)?.description || activity.action}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(activity.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className={`font-medium ${
                          activity.creditsUsed < 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {activity.creditsUsed < 0 ? '+' : ''}{Math.abs(activity.creditsUsed)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <p>{recentActivity.status === 'rejected' ? 'Erro ao carregar atividades' : 'Nenhuma atividade recente'}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credits" className="space-y-6">
            <CreditsOverview userPlan={(displayUser?.plan || 'STARTER') as any} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}