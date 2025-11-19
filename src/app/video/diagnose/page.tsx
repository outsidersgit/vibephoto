'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertCircle, Loader2, Copy, Search, Film } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface DiagnosticStage {
  stage: string
  status: 'OK' | 'WARNING' | 'ERROR' | 'MISSING'
  message: string
  timestamp: string
  data?: any
}

interface DiagnosticResult {
  videoId: string
  jobId: string | null
  overallStatus: 'HEALTHY' | 'BROKEN' | 'INCOMPLETE'
  stages: DiagnosticStage[]
  summary: {
    totalStages: number
    passed: number
    warnings: number
    errors: number
    missing: number
  }
  recommendations: string[]
}

interface RecentVideo {
  id: string
  jobId: string | null
  status: string
  prompt: string
  createdAt: string
  videoUrl: string | null
}

export default function VideoDiagnosePage() {
  const { addToast } = useToast()
  const [videoId, setVideoId] = useState('')
  const [jobId, setJobId] = useState('')
  const [searchByJobId, setSearchByJobId] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingRecent, setLoadingRecent] = useState(false)
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([])

  // Carregar vídeos recentes ao montar o componente
  useEffect(() => {
    loadRecentVideos()
  }, [])

  const loadRecentVideos = async () => {
    setLoadingRecent(true)
    try {
      const response = await fetch('/api/gallery/videos?limit=10&page=1')
      if (response.ok) {
        const data = await response.json()
        setRecentVideos(data.videos || [])
      }
    } catch (err) {
      console.error('Erro ao carregar vídeos recentes:', err)
    } finally {
      setLoadingRecent(false)
    }
  }

  const handleDiagnose = async () => {
    const idToSearch = searchByJobId ? jobId.trim() : videoId.trim()
    
    if (!idToSearch) {
      setError(`Por favor, informe o ${searchByJobId ? 'Job ID' : 'ID do vídeo'}`)
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // Se buscar por jobId, primeiro encontrar o videoId
      let finalVideoId = idToSearch
      
      if (searchByJobId) {
        const findResponse = await fetch(`/api/video/find-by-job-id?jobId=${encodeURIComponent(idToSearch)}`)
        if (findResponse.ok) {
          const findData = await findResponse.json()
          if (findData.videoId) {
            finalVideoId = findData.videoId
          } else {
            throw new Error('Vídeo não encontrado para este Job ID')
          }
        } else {
          throw new Error('Erro ao buscar vídeo por Job ID')
        }
      }

      const response = await fetch(`/api/video/diagnose/${finalVideoId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao executar diagnóstico')
      }

      if (data.success && data.diagnostic) {
        setResult(data.diagnostic)
      } else {
        throw new Error('Resposta inválida do servidor')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    addToast({
      type: 'success',
      title: 'Copiado!',
      description: 'ID copiado para a área de transferência'
    })
  }

  const selectVideo = (id: string) => {
    setVideoId(id)
    setSearchByJobId(false)
    setError(null)
    setResult(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'ERROR':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'MISSING':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'HEALTHY':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'BROKEN':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'INCOMPLETE':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK':
      case 'HEALTHY':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'WARNING':
      case 'INCOMPLETE':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />
      case 'ERROR':
      case 'BROKEN':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'MISSING':
        return <AlertCircle className="w-5 h-5 text-orange-600" />
      default:
        return null
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🔍 Diagnóstico de Fluxo de Vídeo
        </h1>
        <p className="text-gray-600">
          Execute uma verificação completa para identificar exatamente onde o fluxo está quebrando
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Executar Diagnóstico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="videoId">ID do Vídeo</Label>
              <Input
                id="videoId"
                type="text"
                placeholder="Ex: cmixxxxxx"
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) {
                    handleDiagnose()
                  }
                }}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleDiagnose}
                disabled={loading || !videoId.trim()}
                className="min-w-[140px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  'Executar Diagnóstico'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="mb-6 border-red-300 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-800">
              <XCircle className="w-5 h-5" />
              <span className="font-semibold">Erro:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* Resumo Geral */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Resumo do Diagnóstico</CardTitle>
                <Badge className={getStatusColor(result.overallStatus)}>
                  {getStatusIcon(result.overallStatus)}
                  <span className="ml-2 font-semibold">{result.overallStatus}</span>
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{result.summary.totalStages}</div>
                  <div className="text-sm text-gray-600">Total de Estágios</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{result.summary.passed}</div>
                  <div className="text-sm text-gray-600">Passou</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{result.summary.warnings}</div>
                  <div className="text-sm text-gray-600">Avisos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{result.summary.errors}</div>
                  <div className="text-sm text-gray-600">Erros</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{result.summary.missing}</div>
                  <div className="text-sm text-gray-600">Faltando</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">Informações:</div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div><strong>Video ID:</strong> {result.videoId}</div>
                  {result.jobId && <div><strong>Job ID:</strong> {result.jobId}</div>}
                </div>
              </div>

              {result.recommendations.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm font-semibold text-blue-900 mb-2">💡 Recomendações:</div>
                  <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                    {result.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detalhes dos Estágios */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhes dos Estágios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {result.stages.map((stage, idx) => (
                  <div
                    key={idx}
                    className={`p-4 border rounded-lg ${getStatusColor(stage.status)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(stage.status)}
                        <span className="font-semibold">{stage.stage}</span>
                      </div>
                      <Badge className={getStatusColor(stage.status)}>
                        {stage.status}
                      </Badge>
                    </div>
                    <div className="text-sm mt-2">{stage.message}</div>
                    {stage.data && (
                      <details className="mt-3">
                        <summary className="text-sm font-semibold cursor-pointer hover:text-gray-700">
                          Ver detalhes
                        </summary>
                        <pre className="mt-2 p-3 bg-white/50 rounded text-xs overflow-auto max-h-40">
                          {JSON.stringify(stage.data, null, 2)}
                        </pre>
                      </details>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(stage.timestamp).toLocaleString('pt-BR')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Instruções */}
      <Card className="mt-6 bg-gray-50">
        <CardHeader>
          <CardTitle className="text-lg">ℹ️ Como usar</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <p>1. Cole o <strong>ID do vídeo</strong> (ex: <code className="bg-gray-200 px-1 rounded">cmixxxxxx</code>) no campo acima</p>
          <p>2. Clique em <strong>"Executar Diagnóstico"</strong></p>
          <p>3. Analise os resultados para identificar onde o fluxo está quebrando</p>
          <p>4. Use as recomendações para corrigir os problemas encontrados</p>
          <p className="mt-4 text-xs text-gray-500">
            <strong>Dica:</strong> Você pode encontrar o ID do vídeo na URL da galeria ou no banco de dados na tabela <code className="bg-gray-200 px-1 rounded">video_generations</code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

