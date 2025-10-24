'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  History, 
  Trash2, 
  Eye, 
  Download,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useEditHistory } from '@/hooks/useEditHistory'

interface EditHistoryProps {
  onLoadSession?: (sessionId: string) => void
  className?: string
}

export function EditHistory({ onLoadSession, className = '' }: EditHistoryProps) {
  const { history, clearHistory, removeSession } = useEditHistory()
  const [isExpanded, setIsExpanded] = useState(false)

  if (history.length === 0) {
    return null
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Agora mesmo'
    if (diffMins < 60) return `${diffMins}min atrás`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h atrás`
    return date.toLocaleDateString('pt-BR')
  }

  const getOperationLabel = (operation: string) => {
    const labels: Record<string, string> = {
      'edit': 'Editar',
      'add': 'Adicionar',
      'remove': 'Remover',
      'style': 'Estilo',
      'blend': 'Blend',
      'combine': 'Combinar'
    }
    return labels[operation] || operation
  }

  const getOperationColor = (operation: string) => {
    const colors: Record<string, string> = {
      'edit': 'bg-blue-100 text-blue-800',
      'add': 'bg-green-100 text-green-800',
      'remove': 'bg-red-100 text-red-800',
      'style': 'bg-purple-100 text-purple-800',
      'blend': 'bg-orange-100 text-orange-800',
      'combine': 'bg-pink-100 text-pink-800'
    }
    return colors[operation] || 'bg-gray-100 text-gray-800'
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <History className="w-5 h-5 mr-2" />
            Histórico de Edições ({history.length})
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Ocultar
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Mostrar
                </>
              )}
            </Button>
            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {history.map((session) => (
              <div
                key={session.id}
                className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                {/* Thumbnail */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                    {session.result?.resultImage ? (
                      <img
                        src={
                          session.result.resultImage.startsWith('http')
                            ? session.result.resultImage
                            : `data:image/png;base64,${session.result.resultImage}`
                        }
                        alt="Edit result"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Eye className="w-6 h-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Session Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <Badge
                      variant="secondary"
                      className={getOperationColor(session.operation)}
                    >
                      {getOperationLabel(session.operation)}
                    </Badge>
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTimestamp(session.timestamp)}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 truncate" title={session.prompt}>
                    {session.prompt}
                  </p>
                  
                  <div className="flex items-center space-x-2 mt-2">
                    {onLoadSession && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onLoadSession(session.id)}
                        className="h-7 text-xs"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Carregar
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (session.result?.resultImage) {
                          const link = document.createElement('a')
                          link.href = session.result.resultImage.startsWith('http')
                            ? session.result.resultImage
                            : `data:image/png;base64,${session.result.resultImage}`
                          link.download = `edited_${session.operation}_${Date.now()}.png`
                          link.click()
                        }
                      }}
                      className="h-7 text-xs"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Baixar
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSession(session.id)}
                      className="h-7 text-xs text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}