'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { User, Mail, Shield, Key, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { AccountDeletionModal } from '@/components/settings/account-deletion-modal'

export default function AccountSettingsPage() {
  const { data: session } = useSession()
  const [showDeletionModal, setShowDeletionModal] = useState(false)
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true)

  useEffect(() => {
    async function checkSubscription() {
      try {
        const response = await fetch('/api/payments/subscription/status')
        if (response.ok) {
          const data = await response.json()
          const isActive = data.hasActiveSubscription || data.isActive || false
          setHasActiveSubscription(isActive)
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

  if (!session) {
    return <div>Loading...</div>
  }

  const handleDeleteAccount = () => {
    setShowDeletionModal(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Dashboard
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Configurações da Conta</h1>
                <p className="text-gray-600 mt-1">
                  Gerencie suas informações pessoais e configurações de login
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Informações do Perfil
              </CardTitle>
              <CardDescription>
                Suas informações pessoais básicas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome
                  </label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                    {session.user?.name || 'Não informado'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                    {session.user?.email || 'Não informado'}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plano Atual
                </label>
                <Badge variant="secondary" className="text-sm">
                  {(session.user as any)?.plan || 'STARTER'}
                </Badge>
              </div>
              <Button disabled className="mt-4">
                Editar Perfil (Em breve)
              </Button>
            </CardContent>
          </Card>

          {/* Login & Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Login & Segurança
              </CardTitle>
              <CardDescription>
                Gerencie suas configurações de login e segurança
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center">
                  <Key className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="font-medium">Senha</p>
                    <p className="text-sm text-gray-600">Altere sua senha</p>
                  </div>
                </div>
                <Button variant="outline" disabled>
                  Alterar (Em breve)
                </Button>
              </div>
              
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center">
                  <Mail className="w-5 h-5 text-gray-400 mr-3" />
                  <div>
                    <p className="font-medium">Email de Login</p>
                    <p className="text-sm text-gray-600">Altere seu email de acesso</p>
                  </div>
                </div>
                <Button variant="outline" disabled>
                  Alterar (Em breve)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Zona Perigosa</CardTitle>
              <CardDescription>
                Ações irreversíveis da conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium text-red-900">Excluir Conta</p>
                    <p className="text-sm text-red-600">
                      Exclua permanentemente sua conta e todos os dados
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={isLoadingSubscription}
                  >
                    {isLoadingSubscription ? 'Carregando...' : 'Excluir Conta'}
                  </Button>
                </div>
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
  )
}