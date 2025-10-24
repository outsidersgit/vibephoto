import { requireAuth } from '@/lib/auth'
import { getModelById, getModelStats } from '@/lib/db/models'
import { getGenerationsByUserId } from '@/lib/db/generations'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Play, Eye, Download, Trash2, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'

interface ModelPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ModelPage({ params }: ModelPageProps) {
  const session = await requireAuth()
  const { id: modelId } = await params

  const model = await getModelById(modelId, session.user.id)
  
  if (!model) {
    notFound()
  }

  const [modelStats, recentGenerations] = await Promise.all([
    getModelStats(modelId),
    getGenerationsByUserId(session.user.id, 1, 10, modelId)
  ])

  const getStatusIcon = () => {
    switch (model.status) {
      case 'READY':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'TRAINING':
      case 'PROCESSING':
      case 'UPLOADING':
        return <Clock className="w-5 h-5 text-yellow-500" />
      case 'ERROR':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = () => {
    switch (model.status) {
      case 'READY':
        return 'bg-green-100 text-green-800'
      case 'TRAINING':
      case 'PROCESSING':
      case 'UPLOADING':
        return 'bg-yellow-100 text-yellow-800'
      case 'ERROR':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }


  return (
    <div className="min-h-screen bg-gray-50" style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/models">
                  Voltar aos Modelos
                </Link>
              </Button>
              <div>
                <h1 className="text-4xl font-semibold text-gray-900" style={{fontFamily: '"-apple-system", "SF Pro Display", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif'}}>{model.name}</h1>
              </div>
            </div>
            
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column - Cards principais */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Detalhes */}
              <Card className="bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 text-white shadow-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-white text-xl font-semibold">Detalhes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 text-sm">
                    <div className="flex justify-between items-center py-2 border-b border-slate-600/50">
                      <span className="text-slate-300">Título</span>
                      <span className="font-semibold text-white">{model.name}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-600/50">
                      <span className="text-slate-300">Classe</span>
                      <span className="font-semibold capitalize text-white">{model.class.toLowerCase()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-600/50">
                      <span className="text-slate-300">Total de Gerações</span>
                      <span className="font-semibold text-white">{modelStats.totalGenerations}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-600/50">
                      <span className="text-slate-300">Criado</span>
                      <span className="font-semibold text-white">{formatDate(model.createdAt)}</span>
                    </div>
                    {model.qualityScore && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-slate-300">Pontuação de Qualidade</span>
                        <span className="font-semibold text-white">{Math.round(model.qualityScore * 100)}%</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Dados de Treinamento */}
              <Card className="bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 text-white shadow-xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-white text-xl font-semibold">Dados de Treinamento</CardTitle>
                  <CardDescription className="text-slate-300">
                    Fotos usadas para treinar este modelo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-slate-600/50">
                    <span className="text-sm text-slate-300">Total de Fotos</span>
                    <span className="font-semibold text-white">{model.totalPhotos}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-600/50">
                    <span className="text-sm text-slate-300">Fotos do Rosto</span>
                    <span className="font-semibold text-white">{model.facePhotos?.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-600/50">
                    <span className="text-sm text-slate-300">Fotos de Meio Corpo</span>
                    <span className="font-semibold text-white">{model.halfBodyPhotos?.length || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-slate-300">Fotos de Corpo Inteiro</span>
                    <span className="font-semibold text-white">{model.fullBodyPhotos?.length || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Training Progress - Full width */}
            {['TRAINING', 'PROCESSING', 'UPLOADING'].includes(model.status) && (
              <Card className="mt-6 bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 text-white shadow-xl">
                <CardHeader>
                  <CardTitle className="text-white text-xl font-semibold">Progresso do Treinamento</CardTitle>
                  <CardDescription className="text-slate-300">
                    Seu modelo está sendo treinado atualmente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm text-slate-300 mb-2">
                        <span>Progresso</span>
                        <span>{model.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-600 rounded-full h-3">
                        <div
                          className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${model.progress}%` }}
                        />
                      </div>
                    </div>

                    {model.estimatedTime && (
                      <p className="text-sm text-slate-300">
                        Tempo estimado restante: ~{model.estimatedTime} minutos
                      </p>
                    )}

                    <div className="bg-slate-600 border border-slate-500 rounded-lg p-4">
                      <p className="text-slate-200 text-sm">
                        <strong>O que está acontecendo:</strong> Suas fotos estão sendo processadas e o modelo de IA está aprendendo suas características únicas. Você receberá um email quando o treinamento estiver completo.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error State */}
            {model.status === 'ERROR' && (
              <Card className="mt-6 bg-gradient-to-br from-red-700 to-red-800 border border-red-600 text-white shadow-xl">
                <CardHeader>
                  <CardTitle className="text-white text-xl font-semibold">Erro no Treinamento</CardTitle>
                  <CardDescription className="text-red-200">
                    Houve um problema ao treinar seu modelo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-red-600 border border-red-500 rounded-lg p-4 mb-4">
                    <p className="text-red-100 text-sm">
                      {model.errorMessage || 'Um erro desconhecido ocorreu durante o treinamento.'}
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <Button variant="outline" className="border-red-400 text-red-100 hover:bg-red-600">
                      Tentar Novamente
                    </Button>
                    <Button variant="outline" className="border-red-400 text-red-100 hover:bg-red-600">
                      Contatar Suporte
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sample Images - Full width */}
            {model.sampleImages && model.sampleImages.length > 0 && (
              <Card className="mt-6 bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 text-white shadow-xl">
                <CardHeader>
                  <CardTitle className="text-white text-xl font-semibold">Resultados de Exemplo</CardTitle>
                  <CardDescription className="text-slate-300">
                    Exemplos de fotos geradas com este modelo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(model.sampleImages as string[]).map((image: string, index: number) => (
                      <div key={`${model.id}-sample-${index}`} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={image}
                          alt={`Exemplo ${index + 1}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 text-white shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-white text-xl font-semibold">Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {model.status === 'READY' && (
                  <>
                    <Button asChild className="w-full bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-800 font-semibold py-3 shadow-sm border border-slate-200 transition-all duration-200 justify-start">
                      <Link href={`/generate?model=${model.id}`} className="flex items-center">
                        <Play className="w-4 h-4 mr-2 text-slate-700" />
                        Gerar Fotos
                      </Link>
                    </Button>

                    <Button variant="outline" asChild className="w-full border-2 border-slate-300 text-slate-100 bg-slate-700 hover:bg-slate-600 hover:border-slate-200 py-3 font-medium transition-all duration-200 shadow-sm justify-start">
                      <Link href={`/gallery?model=${model.id}`} className="flex items-center">
                        <Eye className="w-4 h-4 mr-2" />
                        Ver Galeria
                      </Link>
                    </Button>
                  </>
                )}

                <Button variant="outline" className="w-full border-2 border-slate-300 text-slate-100 bg-slate-700 hover:bg-slate-600 hover:border-slate-200 py-3 font-medium transition-all duration-200 shadow-sm justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar Modelo
                </Button>

                <Button variant="destructive" className="w-full bg-red-600 hover:bg-red-500 text-white border-2 border-red-500 hover:border-red-400 py-3 font-medium transition-all duration-200 shadow-sm justify-start">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Deletar Modelo
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}