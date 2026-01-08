'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, AlertCircle, RefreshCw, Download, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface ClientError {
  id: string
  userId: string | null
  action: string
  status: string
  details: {
    errorType: string
    errorMessage: string
    errorStack?: string
    url?: string
    browser?: string
    device?: string
    userAgent?: string
    additionalData?: any
    timestamp?: string
    userEmail?: string
  }
  ipAddress: string | null
  createdAt: string
  user?: {
    email: string
    name: string | null
  }
}

interface Stats {
  total: number
  byBrowser: Record<string, number>
  byDevice: Record<string, number>
  byErrorType: Record<string, number>
}

export function ClientErrorsView() {
  const [logs, setLogs] = useState<ClientError[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<ClientError | null>(null)

  // Filters
  const [browserFilter, setBrowserFilter] = useState<string>('')
  const [deviceFilter, setDeviceFilter] = useState<string>('')
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>('')
  const [hoursFilter, setHoursFilter] = useState<string>('24')
  const [searchTerm, setSearchTerm] = useState<string>('')

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '100',
        hours: hoursFilter
      })

      if (browserFilter) params.set('browser', browserFilter)
      if (deviceFilter) params.set('device', deviceFilter)
      if (errorTypeFilter) params.set('errorType', errorTypeFilter)

      const response = await fetch(`/api/admin/client-errors?${params}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.logs)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [browserFilter, deviceFilter, errorTypeFilter, hoursFilter])

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      log.details.errorMessage?.toLowerCase().includes(search) ||
      log.details.errorType?.toLowerCase().includes(search) ||
      log.user?.email?.toLowerCase().includes(search) ||
      log.details.url?.toLowerCase().includes(search)
    )
  })

  const exportToCSV = () => {
    const csv = [
      ['Data', 'Tipo', 'Mensagem', 'Navegador', 'Device', 'Usuário', 'URL'].join(','),
      ...filteredLogs.map(log => [
        new Date(log.createdAt).toLocaleString(),
        log.details.errorType,
        `"${log.details.errorMessage?.replace(/"/g, '""')}"`,
        log.details.browser,
        log.details.device,
        log.user?.email || 'anonymous',
        log.details.url
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `client-errors-${new Date().toISOString()}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client-Side Errors</h1>
          <p className="text-sm text-gray-500 mt-1">
            Logs de erros capturados no navegador dos usuários
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={fetchLogs} variant="outline" size="sm" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total de Erros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Top Browser</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.entries(stats.byBrowser).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
              </div>
              <div className="text-sm text-gray-500">
                {Object.entries(stats.byBrowser).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} erros
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Top Device</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.entries(stats.byDevice).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
              </div>
              <div className="text-sm text-gray-500">
                {Object.entries(stats.byDevice).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} erros
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Top Erro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-bold">
                {Object.entries(stats.byErrorType).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
              </div>
              <div className="text-sm text-gray-500">
                {Object.entries(stats.byErrorType).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} erros
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Período</label>
              <Select value={hoursFilter} onValueChange={setHoursFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Última hora</SelectItem>
                  <SelectItem value="6">Últimas 6h</SelectItem>
                  <SelectItem value="24">Últimas 24h</SelectItem>
                  <SelectItem value="72">Últimos 3 dias</SelectItem>
                  <SelectItem value="168">Última semana</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Navegador</label>
              <Select value={browserFilter} onValueChange={setBrowserFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="Safari">Safari</SelectItem>
                  <SelectItem value="Chrome">Chrome</SelectItem>
                  <SelectItem value="Firefox">Firefox</SelectItem>
                  <SelectItem value="Edge">Edge</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Device</label>
              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="iPhone">iPhone</SelectItem>
                  <SelectItem value="iPad">iPad</SelectItem>
                  <SelectItem value="Android">Android</SelectItem>
                  <SelectItem value="desktop">Desktop</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Tipo de Erro</label>
              <Select value={errorTypeFilter} onValueChange={setErrorTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="PATTERN_VALIDATION_ERROR">Pattern Validation</SelectItem>
                  <SelectItem value="Error">Error</SelectItem>
                  <SelectItem value="TypeError">TypeError</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Mensagem, email, URL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Logs ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Nenhum erro encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={log.details.errorType?.includes('PATTERN') ? 'destructive' : 'secondary'}>
                          {log.details.errorType || 'Error'}
                        </Badge>
                        {log.details.browser && (
                          <Badge variant="outline">{log.details.browser}</Badge>
                        )}
                        {log.details.device && (
                          <Badge variant="outline">{log.details.device}</Badge>
                        )}
                      </div>

                      <p className="font-medium text-gray-900 truncate">
                        {log.details.errorMessage}
                      </p>

                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span>{log.user?.email || 'Anonymous'}</span>
                        <span>•</span>
                        <span>{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                        {log.details.url && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-xs">{log.details.url}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedLog(null)}>
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Detalhes do Erro</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-gray-600 mb-1">Tipo de Erro</h3>
                <Badge variant="destructive">{selectedLog.details.errorType}</Badge>
              </div>

              <div>
                <h3 className="font-semibold text-sm text-gray-600 mb-1">Mensagem</h3>
                <p className="text-sm bg-gray-50 p-3 rounded border">{selectedLog.details.errorMessage}</p>
              </div>

              {selectedLog.details.errorStack && (
                <div>
                  <h3 className="font-semibold text-sm text-gray-600 mb-1">Stack Trace</h3>
                  <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
                    {selectedLog.details.errorStack}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-sm text-gray-600 mb-1">Navegador</h3>
                  <p className="text-sm">{selectedLog.details.browser || 'N/A'}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-gray-600 mb-1">Device</h3>
                  <p className="text-sm">{selectedLog.details.device || 'N/A'}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-gray-600 mb-1">Usuário</h3>
                  <p className="text-sm">{selectedLog.user?.email || 'Anonymous'}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-gray-600 mb-1">Data/Hora</h3>
                  <p className="text-sm">{new Date(selectedLog.createdAt).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              {selectedLog.details.url && (
                <div>
                  <h3 className="font-semibold text-sm text-gray-600 mb-1">URL</h3>
                  <p className="text-sm bg-gray-50 p-2 rounded break-all">{selectedLog.details.url}</p>
                </div>
              )}

              {selectedLog.details.userAgent && (
                <div>
                  <h3 className="font-semibold text-sm text-gray-600 mb-1">User Agent</h3>
                  <p className="text-xs bg-gray-50 p-2 rounded break-all">{selectedLog.details.userAgent}</p>
                </div>
              )}

              {selectedLog.details.additionalData && (
                <div>
                  <h3 className="font-semibold text-sm text-gray-600 mb-1">Dados Adicionais</h3>
                  <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedLog.details.additionalData, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
