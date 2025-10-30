import { requireAuth } from '@/lib/auth'
import { getModelsByUserId, canUserCreateModel, getModelLimitsByPlan } from '@/lib/db/models'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Users, Clock, CheckCircle, AlertCircle, XCircle, Trash2, Eye, Play, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { ModelCard } from '@/components/models/model-card'
import { ModelStats } from '@/components/models/model-stats'
import { RealtimeModelList } from '@/components/models/realtime-model-list'

export default async function ModelsPage() {
  const session = await requireAuth()
  const userId = session.user.id

  const [models] = await Promise.all([
    getModelsByUserId(userId)
  ])
  const activeModels = models.filter(m => m.status !== 'DELETED').length

  const modelsByStatus = {
    ready: models.filter(m => m.status === 'READY'),
    training: models.filter(m => ['TRAINING', 'PROCESSING', 'UPLOADING'].includes(m.status)),
    error: models.filter(m => m.status === 'ERROR'),
    deleted: models.filter(m => m.status === 'DELETED')
  }

  return (
    <div className="min-h-screen bg-gray-50" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Meus Modelos de IA</h1>
            </div>
            <div className="flex items-center space-x-4">
              {true ? (
                <Button asChild className="bg-gradient-to-br from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-[#667EEA] shadow-lg shadow-[#667EEA]/25 transition-all duration-200 px-6 py-2 h-auto">
                  <Link href="/models/create">
                    Criar Modelo
                  </Link>
                </Button>
              ) : (
                <></>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Empty State */}
        {models.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              Nenhum Modelo de IA Ainda
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
              Crie seu primeiro modelo de IA enviando fotos suas ou de outras pessoas.
              O modelo irá aprender a gerar novas fotos em diferentes estilos e cenários.
            </p>
            {true ? (
              <Button asChild size="lg" className="bg-gradient-to-br from-[#667EEA] to-[#764BA2] hover:from-[#5a6bd8] hover:to-[#6a4190] text-white border-[#667EEA] shadow-lg shadow-[#667EEA]/25 transition-all duration-200 px-8 py-3 h-auto">
                <Link href="/models/create">
                  Criar Seu Primeiro Modelo
                </Link>
              </Button>
            ) : (
              <></>
            )}
          </div>
        ) : (
          <RealtimeModelList
            initialModels={models}
            userId={userId}
          />
        )}
      </div>
    </div>
  )
}