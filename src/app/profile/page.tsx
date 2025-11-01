'use client'

import { useSession, signIn } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Check,
  X
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { AccountDeletionModal } from '@/components/settings/account-deletion-modal'
import { ProtectedPageScript } from '@/components/auth/protected-page-script'
import { useAuthGuard } from '@/hooks/useAuthGuard'


export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  
  // CRITICAL: Verificar autenticação ANTES de renderizar conteúdo
  const isAuthorized = useAuthGuard()
  
  // CRITICAL: Bloquear renderização se não autorizado
  if (isAuthorized === false || status === 'unauthenticated') {
    return (
      <>
        <ProtectedPageScript />
        <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Redirecionando para login...</p>
          </div>
        </div>
      </>
    )
  }
  
  // CRITICAL: Bloquear renderização durante verificação de autenticação
  if (isAuthorized === null || status === 'loading') {
    return (
      <>
        <ProtectedPageScript />
        <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verificando autenticação...</p>
          </div>
        </div>
      </>
    )
  }
  
  // Verificação adicional de sessão (redundante mas seguro)
  if (!session?.user) {
    return (
      <>
        <ProtectedPageScript />
        <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Redirecionando para login...</p>
          </div>
        </div>
      </>
    )
  }

  // Estados do formulário
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: session?.user?.email || ''
  })

  // Estados do modal de exclusão
  const [showDeletionModal, setShowDeletionModal] = useState(false)
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true)

  // Atualizar formData quando session mudar
  useEffect(() => {
    if (session?.user?.name) {
      const nameParts = session.user.name.split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      setFormData(prev => ({
        ...prev,
        firstName,
        lastName,
        email: session.user.email || ''
      }))
    }
  }, [session])

  // Verificar status da assinatura
  useEffect(() => {
    async function checkSubscription() {
      try {
        const response = await fetch('/api/payments/subscription/status')
        if (response.ok) {
          const data = await response.json()
          console.log('Subscription status:', data) // Debug log
          const isActive = data.hasActiveSubscription || data.isActive || false
          setHasActiveSubscription(isActive)
          console.log('Has active subscription:', isActive) // Debug log
        }
      } catch (error) {
        console.error('Error checking subscription:', error)
      } finally {
        setIsLoadingSubscription(false)
      }
    }

    if (session) {
      checkSubscription()
    }
  }, [session])

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#667EEA] mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando perfil...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Acesso Restrito</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600">Você precisa estar logado para acessar seu perfil.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setSaveStatus('idle')
  }


  const handleSave = async () => {
    setSaveStatus('saving')

    try {
      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao salvar')
      }

      const result = await response.json()
      setSaveStatus('saved')

      // Atualizar a sessão para refletir o novo nome na UI
      try {
        await update({
          ...session,
          user: {
            ...session?.user,
            name: `${formData.firstName} ${formData.lastName}`.trim()
          }
        })
      } catch (updateError) {
        console.log('Sessão atualizada via update callback')
      }

      // Resetar status após 2 segundos e recarregar para garantir atualização
      setTimeout(() => {
        setSaveStatus('idle')
        // Recarregar a página para garantir que a UI seja atualizada
        window.location.reload()
      }, 2000)

    } catch (error) {
      console.error('Erro ao salvar perfil:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const handleDeleteAccount = () => {
    setShowDeletionModal(true)
  }


  return (
    <>
      <ProtectedPageScript />
      <div className="min-h-screen bg-gradient-to-br from-[#667EEA]/10 via-white to-[#764BA2]/10" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
        {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Perfil
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          
          {/* Status de salvamento */}
          {saveStatus === 'saved' && (
            <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
              <div className="flex items-center">
                <span className="text-green-400">Suas alterações foram salvas com sucesso!</span>
              </div>
            </div>
          )}

          {saveStatus === 'error' && (
            <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
              <div className="flex items-center">
                <span className="text-red-400">Ocorreu um erro ao salvar. Tente novamente.</span>
              </div>
            </div>
          )}

          {/* Editar Dados */}
          <Card className="bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#475569] border border-slate-600/30 shadow-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-white text-lg">
                Editar dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-white">Nome</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="Seu nome"
                  className="h-11 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                />
              </div>

              {/* Sobrenome */}
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-white">Sobrenome</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Seu sobrenome"
                  className="h-11 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                />
              </div>

              {/* Email (somente leitura) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email (informativo)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  readOnly
                  disabled
                  placeholder="seu.email@exemplo.com"
                  className="h-11 bg-slate-800 border-slate-700 text-slate-400 placeholder-slate-500 cursor-not-allowed"
                />
                <p className="text-xs text-slate-400">O email não pode ser alterado</p>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-600/30">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteAccount}
                  className="h-8 px-3 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-400/5 border border-red-400/20 hover:border-red-400/40 rounded-lg"
                >
                  Excluir conta
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={saveStatus === 'saving'}
                  size="sm"
                  className={`h-9 px-6 text-sm ${
                    saveStatus === 'saved'
                      ? 'bg-green-600 hover:bg-green-700'
                      : saveStatus === 'error'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5A6FDB] hover:to-[#6B4493]'
                  }`}
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Salvando...
                    </>
                  ) : saveStatus === 'saved' ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Salvo!
                    </>
                  ) : saveStatus === 'error' ? (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Erro
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Account Deletion Modal */}
      <AccountDeletionModal
        isOpen={showDeletionModal}
        onClose={() => setShowDeletionModal(false)}
        hasActiveSubscription={hasActiveSubscription}
      />
    </div>
    </>
  )
}