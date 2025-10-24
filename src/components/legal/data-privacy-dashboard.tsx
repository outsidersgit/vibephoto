'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { 
  Shield, 
  Download, 
  Trash2, 
  Eye, 
  Edit, 
  AlertTriangle,
  CheckCircle2,
  FileText,
  Database,
  Clock,
  User,
  CreditCard,
  Image,
  Brain,
  Settings
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatFileSize } from '@/lib/utils'

interface DataPrivacyDashboardProps {
  userId: string
}

interface UserData {
  personalInfo: {
    name: string
    email: string
    phone?: string
    cpfCnpj?: string
    address?: string
    createdAt: string
    lastLogin: string
  }
  generatedImages: {
    count: number
    totalSize: number
    oldestDate: string
    newestDate: string
  }
  trainedModels: {
    count: number
    totalSize: number
    trainingPhotos: number
  }
  paymentData: {
    transactionCount: number
    subscriptionActive: boolean
    paymentMethods: number
    lastPayment: string
  }
  usageData: {
    sessionCount: number
    totalCreditsUsed: number
    featuresUsed: string[]
    dataRetentionDays: number
  }
}

interface DataExportRequest {
  id: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  requestedAt: string
  completedAt?: string
  downloadUrl?: string
  expiresAt?: string
}

interface DataDeletionRequest {
  id: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED'
  requestedAt: string
  scheduledFor: string
  deletionType: 'ACCOUNT' | 'DATA_ONLY'
}

const dataCategories = {
  personalInfo: {
    name: 'Informações Pessoais',
    icon: User,
    description: 'Nome, email, telefone, CPF/CNPJ e dados de contato',
    retention: '5 anos após inatividade da conta'
  },
  generatedImages: {
    name: 'Imagens Geradas',
    icon: Image,
    description: 'Todas as imagens criadas usando nossos modelos de IA',
    retention: '2 anos ou até exclusão manual'
  },
  trainedModels: {
    name: 'Modelos Treinados',
    icon: Brain,
    description: 'Seus modelos de IA personalizados e fotos de treinamento',
    retention: '1 ano após cancelamento da conta'
  },
  paymentData: {
    name: 'Dados de Pagamento',
    icon: CreditCard,
    description: 'Histórico de transações e métodos de pagamento',
    retention: '7 anos para conformidade fiscal'
  },
  usageData: {
    name: 'Dados de Uso',
    icon: Database,
    description: 'Logs de atividade, preferências e estatísticas de uso',
    retention: '6 meses para análise e melhorias'
  }
}

export function DataPrivacyDashboard({ userId }: DataPrivacyDashboardProps) {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [exportRequests, setExportRequests] = useState<DataExportRequest[]>([])
  const [deletionRequests, setDeletionRequests] = useState<DataDeletionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const { toast } = useToast()

  useEffect(() => {
    loadPrivacyData()
  }, [userId])

  const loadPrivacyData = async () => {
    try {
      setLoading(true)
      
      // Load user data summary
      const dataResponse = await fetch('/api/privacy/data-summary')
      if (dataResponse.ok) {
        const data = await dataResponse.json()
        setUserData(data)
      }

      // Load export requests
      const exportResponse = await fetch('/api/privacy/export-requests')
      if (exportResponse.ok) {
        const exports = await exportResponse.json()
        setExportRequests(exports.requests)
      }

      // Load deletion requests
      const deleteResponse = await fetch('/api/privacy/deletion-requests')
      if (deleteResponse.ok) {
        const deletions = await deleteResponse.json()
        setDeletionRequests(deletions.requests)
      }

    } catch (error) {
      console.error('Error loading privacy data:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados de privacidade',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRequestDataExport = async (categories: string[] = ['all']) => {
    try {
      const response = await fetch('/api/privacy/export-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories })
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: 'Solicitação Enviada',
          description: 'Sua solicitação de exportação foi enviada. Você receberá um email quando estiver pronta.',
        })
        await loadPrivacyData()
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao solicitar exportação',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão',
        variant: 'destructive'
      })
    }
  }

  const handleRequestDataDeletion = async (deletionType: 'ACCOUNT' | 'DATA_ONLY' = 'ACCOUNT') => {
    try {
      const response = await fetch('/api/privacy/delete-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletionType })
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: 'Solicitação de Exclusão Enviada',
          description: deletionType === 'ACCOUNT' 
            ? 'Sua conta será excluída em 30 dias. Você pode cancelar até lá.' 
            : 'Seus dados serão excluídos em 7 dias.',
        })
        await loadPrivacyData()
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Erro ao solicitar exclusão',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão',
        variant: 'destructive'
      })
    }
  }

  const handleDownloadExport = async (exportId: string) => {
    try {
      const response = await fetch(`/api/privacy/download-export/${exportId}`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `meus-dados-${new Date().toISOString().split('T')[0]}.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast({
          title: 'Download Iniciado',
          description: 'O download dos seus dados foi iniciado.'
        })
      } else {
        const result = await response.json()
        toast({
          title: 'Erro',
          description: result.error || 'Erro no download',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro de conexão',
        variant: 'destructive'
      })
    }
  }

  const calculateDataScore = (): number => {
    if (!userData) return 0
    
    let score = 0
    const maxScore = 100
    
    // Personal info completeness (30 points)
    if (userData.personalInfo.name) score += 10
    if (userData.personalInfo.email) score += 10
    if (userData.personalInfo.phone) score += 5
    if (userData.personalInfo.cpfCnpj) score += 5
    
    // Data activity (40 points)
    if (userData.generatedImages.count > 0) score += 20
    if (userData.trainedModels.count > 0) score += 20
    
    // Account security (30 points)
    if (userData.paymentData.subscriptionActive) score += 15
    if (userData.usageData.sessionCount > 0) score += 15
    
    return Math.min(score, maxScore)
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-48"></div>
              <div className="h-4 bg-gray-200 rounded w-64"></div>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!userData) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Não foi possível carregar os dados de privacidade</p>
          <Button onClick={loadPrivacyData} className="mt-4">
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  const dataScore = calculateDataScore()

  return (
    <div className="space-y-6">
      {/* Privacy Score Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-primary" />
              <span>Painel de Privacidade - LGPD</span>
            </CardTitle>
            <CardDescription>
              Gerencie seus dados pessoais e exercite seus direitos conforme a LGPD
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-2xl font-bold">{dataScore}%</h3>
                <p className="text-sm text-muted-foreground">Completude dos Dados</p>
              </div>
              <div className="w-32">
                <Progress value={dataScore} className="h-2" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-lg font-semibold">{userData.generatedImages.count}</p>
                <p className="text-xs text-muted-foreground">Imagens Geradas</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{userData.trainedModels.count}</p>
                <p className="text-xs text-muted-foreground">Modelos Treinados</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{userData.paymentData.transactionCount}</p>
                <p className="text-xs text-muted-foreground">Transações</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{userData.usageData.dataRetentionDays}</p>
                <p className="text-xs text-muted-foreground">Dias de Retenção</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="data">Meus Dados</TabsTrigger>
          <TabsTrigger value="requests">Solicitações</TabsTrigger>
          <TabsTrigger value="rights">Direitos LGPD</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumo dos Seus Dados</CardTitle>
              <CardDescription>
                Visão geral de todas as informações que temos sobre você
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>Informações Pessoais</span>
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Nome:</span>
                      <span>{userData.personalInfo.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Email:</span>
                      <span>{userData.personalInfo.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Conta criada em:</span>
                      <span>{formatDate(userData.personalInfo.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Último acesso:</span>
                      <span>{formatDate(userData.personalInfo.lastLogin)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium flex items-center space-x-2">
                    <Database className="h-4 w-4" />
                    <span>Atividade da Conta</span>
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Imagens geradas:</span>
                      <span>{userData.generatedImages.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Modelos treinados:</span>
                      <span>{userData.trainedModels.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Créditos utilizados:</span>
                      <span>{userData.usageData.totalCreditsUsed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sessões ativas:</span>
                      <span>{userData.usageData.sessionCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => handleRequestDataExport()}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Meus Dados
                </Button>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      Ver Detalhes
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Detalhes dos Dados Armazenados</DialogTitle>
                      <DialogDescription>
                        Informações completas sobre os dados que processamos
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      {Object.entries(dataCategories).map(([key, category]) => {
                        const Icon = category.icon
                        return (
                          <div key={key} className="flex items-start space-x-3 p-3 border rounded-lg">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium">{category.name}</h4>
                              <p className="text-sm text-muted-foreground mb-2">
                                {category.description}
                              </p>
                              <Badge variant="secondary" className="text-xs">
                                Retenção: {category.retention}
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <div className="grid gap-6">
            {Object.entries(dataCategories).map(([key, category], index) => {
              const Icon = category.icon
              let dataInfo = ''
              
              switch (key) {
                case 'personalInfo':
                  dataInfo = `${userData.personalInfo.name} (${userData.personalInfo.email})`
                  break
                case 'generatedImages':
                  dataInfo = `${userData.generatedImages.count} imagens (${formatFileSize(userData.generatedImages.totalSize)})`
                  break
                case 'trainedModels':
                  dataInfo = `${userData.trainedModels.count} modelos (${userData.trainedModels.trainingPhotos} fotos)`
                  break
                case 'paymentData':
                  dataInfo = `${userData.paymentData.transactionCount} transações`
                  break
                case 'usageData':
                  dataInfo = `${userData.usageData.sessionCount} sessões`
                  break
              }

              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <span>{category.name}</span>
                      </CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{dataInfo}</p>
                          <p className="text-sm text-muted-foreground">
                            Retenção: {category.retention}
                          </p>
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            Ver
                          </Button>
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Exportar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <div className="grid gap-6">
            {/* Export Requests */}
            <Card>
              <CardHeader>
                <CardTitle>Solicitações de Exportação</CardTitle>
                <CardDescription>
                  Histórico de solicitações para baixar seus dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {exportRequests.length > 0 ? (
                  <div className="space-y-3">
                    {exportRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">
                            Solicitação #{request.id.slice(-8)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Solicitado em {formatDate(request.requestedAt)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant={request.status === 'COMPLETED' ? 'default' : 'secondary'}
                          >
                            {request.status}
                          </Badge>
                          {request.status === 'COMPLETED' && request.downloadUrl && (
                            <Button 
                              size="sm" 
                              onClick={() => handleDownloadExport(request.id)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Baixar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma solicitação de exportação encontrada
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Deletion Requests */}
            <Card>
              <CardHeader>
                <CardTitle>Solicitações de Exclusão</CardTitle>
                <CardDescription>
                  Histórico de solicitações para excluir seus dados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {deletionRequests.length > 0 ? (
                  <div className="space-y-3">
                    {deletionRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">
                            {request.deletionType === 'ACCOUNT' ? 'Exclusão de Conta' : 'Exclusão de Dados'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Solicitado em {formatDate(request.requestedAt)}
                            {request.scheduledFor && (
                              <span> • Agendado para {formatDate(request.scheduledFor)}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant={request.status === 'COMPLETED' ? 'default' : 'secondary'}
                          >
                            {request.status}
                          </Badge>
                          {request.status === 'PENDING' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              // onClick={() => handleCancelDeletion(request.id)}
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma solicitação de exclusão encontrada
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rights" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Seus Direitos Conforme a LGPD</CardTitle>
              <CardDescription>
                Como titular dos dados, você possui os seguintes direitos garantidos pela Lei Geral de Proteção de Dados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  {
                    title: 'Direito de Acesso',
                    description: 'Você pode solicitar informações sobre o tratamento dos seus dados pessoais.',
                    action: 'Ver Meus Dados',
                    icon: Eye
                  },
                  {
                    title: 'Direito de Portabilidade',
                    description: 'Você pode solicitar a transferência dos seus dados para outro fornecedor.',
                    action: 'Exportar Dados',
                    icon: Download
                  },
                  {
                    title: 'Direito de Correção',
                    description: 'Você pode solicitar a correção de dados incompletos, inexatos ou desatualizados.',
                    action: 'Editar Perfil',
                    icon: Edit
                  },
                  {
                    title: 'Direito de Exclusão',
                    description: 'Você pode solicitar a exclusão dos seus dados quando não forem mais necessários.',
                    action: 'Excluir Dados',
                    icon: Trash2,
                    dangerous: true
                  }
                ].map((right, index) => {
                  const Icon = right.icon
                  return (
                    <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{right.title}</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          {right.description}
                        </p>
                        {right.dangerous ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                {right.action}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Dados</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. Você pode escolher excluir apenas seus dados ou sua conta completa.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRequestDataDeletion('DATA_ONLY')}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir Apenas Dados
                                </AlertDialogAction>
                                <AlertDialogAction
                                  onClick={() => handleRequestDataDeletion('ACCOUNT')}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir Conta Completa
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Button variant="outline" size="sm">
                            {right.action}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}