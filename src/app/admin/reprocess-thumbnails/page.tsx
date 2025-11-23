'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Play, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function ReprocessThumbnailsPage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)

  const handleReprocess = async (dryRun: boolean) => {
    setLoading(true)
    setResults(null)

    try {
      const params = new URLSearchParams()
      if (dryRun) params.append('dry-run', 'true')
      
      const response = await fetch(`/api/admin/reprocess-thumbnails?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setResults(data.summary)
      } else {
        alert(`Erro: ${data.error}`)
      }
    } catch (error) {
      console.error('Error reprocessing thumbnails:', error)
      alert('Erro ao reprocessar thumbnails. Veja o console para detalhes.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <Card>
        <CardHeader>
          <CardTitle>🎬 Reprocessar Thumbnails de Vídeo</CardTitle>
          <CardDescription>
            Otimiza thumbnails antigas (2-3 MB) para ~50-100 KB, melhorando significativamente a performance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={() => handleReprocess(true)}
              disabled={loading}
              variant="outline"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Simular (Dry Run)
                </>
              )}
            </Button>

            <Button
              onClick={() => handleReprocess(false)}
              disabled={loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Executar Reprocessamento
                </>
              )}
            </Button>
          </div>

          {/* Results */}
          {results && (
            <div className="space-y-4 mt-6">
              {/* Summary Card */}
              <Card className="bg-gray-50">
                <CardHeader>
                  <CardTitle className="text-lg">📊 Resumo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Total de Vídeos</div>
                      <div className="text-2xl font-bold">{results.total}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Processados</div>
                      <div className="text-2xl font-bold text-green-600">{results.processed}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Pulados</div>
                      <div className="text-2xl font-bold text-gray-600">{results.skipped}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Falharam</div>
                      <div className="text-2xl font-bold text-red-600">{results.failed}</div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">Tamanho Antes</div>
                        <div className="text-xl font-bold">{results.totalSizeBeforeMB} MB</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Tamanho Depois</div>
                        <div className="text-xl font-bold text-green-600">{results.totalSizeAfterMB} MB</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Economia</div>
                        <div className="text-xl font-bold text-blue-600">
                          {results.totalSavedMB} MB ({results.savingsPercent}%)
                        </div>
                      </div>
                    </div>
                  </div>

                  {results.dryRun && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-800">
                        ⚠️ <strong>Simulação (Dry Run)</strong> - Nenhuma alteração foi feita. 
                        Clique em "Executar Reprocessamento" para aplicar as mudanças.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Video List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📹 Detalhes por Vídeo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {results.videos.map((video: any, index: number) => (
                      <div
                        key={video.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-mono text-gray-500">
                            {video.index}/{video.total}
                          </div>
                          
                          {video.status === 'processed' && (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                          {video.status === 'would-process' && (
                            <AlertCircle className="w-5 h-5 text-yellow-600" />
                          )}
                          {video.status === 'skipped' && (
                            <div className="w-5 h-5 text-gray-400">⏭️</div>
                          )}
                          {video.status === 'failed' && (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}

                          <div className="flex-1">
                            <div className="text-sm font-mono">{video.id}</div>
                            {video.reason && (
                              <div className="text-xs text-gray-500">{video.reason}</div>
                            )}
                            {video.error && (
                              <div className="text-xs text-red-600">{video.error}</div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {video.currentSizeKB && (
                            <Badge variant="outline">
                              {video.currentSizeKB} KB
                            </Badge>
                          )}
                          {video.newSizeKB && (
                            <>
                              <span className="text-gray-400">→</span>
                              <Badge className="bg-green-100 text-green-800">
                                {video.newSizeKB} KB
                              </Badge>
                              {video.savingsPercent && (
                                <Badge className="bg-blue-100 text-blue-800">
                                  -{video.savingsPercent}%
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

