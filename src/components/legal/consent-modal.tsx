'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { X, Shield, Cookie, BarChart3, Settings, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface ConsentModalProps {
  isOpen: boolean
  onClose: () => void
  onConsentGiven: (consents: ConsentPreferences) => void
}

interface ConsentPreferences {
  essential: boolean
  functional: boolean
  analytics: boolean
  marketing: boolean
}

const defaultPreferences: ConsentPreferences = {
  essential: true,
  functional: false,
  analytics: false,
  marketing: false
}

export function ConsentModal({ isOpen, onClose, onConsentGiven }: ConsentModalProps) {
  const [preferences, setPreferences] = useState<ConsentPreferences>(defaultPreferences)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleAcceptAll = () => {
    const allAccepted = {
      essential: true,
      functional: true,
      analytics: true,
      marketing: false // We don't use marketing cookies
    }
    setPreferences(allAccepted)
    onConsentGiven(allAccepted)
    onClose()
  }

  const handleAcceptSelected = () => {
    onConsentGiven(preferences)
    onClose()
  }

  const handleRejectAll = () => {
    const essentialOnly = {
      essential: true,
      functional: false,
      analytics: false,
      marketing: false
    }
    setPreferences(essentialOnly)
    onConsentGiven(essentialOnly)
    onClose()
  }

  const updatePreference = (key: keyof ConsentPreferences, value: boolean) => {
    if (key === 'essential') return // Essential cookies cannot be disabled
    setPreferences(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-xl max-h-[85vh] overflow-y-auto shadow-2xl border-0">
        <CardHeader className="relative bg-white border-b border-gray-200">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 hover:bg-gray-100 rounded transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>


          <CardTitle className="text-lg text-gray-900">Consentimento para Cookies e Privacidade</CardTitle>

          <p className="text-gray-600 text-sm">
            Respeitamos sua privacidade e seguimos a Lei Geral de Proteção de Dados (LGPD).
            Escolha como deseja que seus dados sejam utilizados.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Quick Actions */}
          {!showDetails && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-2 rounded border border-blue-200">
                <p className="text-blue-800 text-xs">
                  Suas fotos são processadas exclusivamente para criar seu modelo personalizado.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Consentimentos Necessários:</h3>

                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-2 bg-red-50 rounded border border-red-200">
                    <Checkbox checked={true} disabled />
                    <div className="flex-1">
                      <p className="font-medium text-red-900 text-sm">Processamento de Dados Biométricos (Obrigatório)</p>
                      <p className="text-xs text-red-800">
                        Processamento de suas fotos para criar modelo personalizado de IA.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                    <Checkbox checked={true} disabled />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Cookies Essenciais</p>
                      <p className="text-xs text-gray-600">
                        Login, segurança e funcionamento básico.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => setShowDetails(true)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Personalizar
                </Button>
              </div>
            </div>
          )}

          {/* Detailed Settings */}
          {showDetails && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Configurações Detalhadas</h3>
                <Button
                  onClick={() => setShowDetails(false)}
                  variant="ghost"
                  size="sm"
                >
                  Voltar
                </Button>
              </div>

              <div className="space-y-3">
                {/* Essential */}
                <div className="flex items-start gap-2 p-3 border rounded bg-red-50 border-red-200">
                  <Checkbox checked={true} disabled />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-red-600" />
                      <p className="font-medium">Cookies Essenciais</p>
                      <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      Login, segurança, carrinho de compras. Não podem ser desabilitados.
                    </p>
                  </div>
                </div>

                {/* Functional */}
                <div className="flex items-start gap-2 p-3 border rounded">
                  <Checkbox 
                    checked={preferences.functional}
                    onCheckedChange={(checked) => updatePreference('functional', !!checked)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Settings className="w-4 h-4 text-blue-600" />
                      <p className="font-medium">Cookies Funcionais</p>
                      <Badge variant="secondary" className="text-xs">Opcional</Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      Lembrar suas preferências (tema, idioma, configurações de visualização).
                    </p>
                  </div>
                </div>

                {/* Analytics */}
                <div className="flex items-start gap-2 p-3 border rounded">
                  <Checkbox 
                    checked={preferences.analytics}
                    onCheckedChange={(checked) => updatePreference('analytics', !!checked)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="w-4 h-4 text-green-600" />
                      <p className="font-medium">Cookies de Análise</p>
                      <Badge variant="secondary" className="text-xs">Opcional</Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      Entender como você usa nosso site para melhorar a experiência (dados anônimos).
                    </p>
                  </div>
                </div>

                {/* Marketing - Disabled */}
                <div className="flex items-start gap-2 p-3 border rounded bg-gray-50 opacity-50">
                  <Checkbox checked={false} disabled />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Cookie className="w-4 h-4 text-gray-400" />
                      <p className="font-medium">Cookies de Marketing</p>
                      <Badge variant="outline" className="text-xs">Não utilizamos</Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      Não utilizamos cookies de marketing ou publicidade.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleAcceptAll}
                className="flex-1 bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#5a6fd8] hover:to-[#6a4190] text-white border-0 transition-all duration-200 transform hover:scale-105 shadow-lg"
                size="sm"
              >
                Aceitar Todos
              </Button>
              <Button
                onClick={handleAcceptSelected}
                variant="outline"
                className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                size="sm"
              >
                Aceitar Selecionados
              </Button>
            </div>
            <Button 
              onClick={handleRejectAll}
              variant="ghost"
              className="w-full text-gray-600 hover:text-gray-800"
              size="sm"
            >
              Apenas Essenciais
            </Button>
          </div>

          {/* Footer */}
          <div className="text-xs text-gray-500 pt-3 border-t">
            <div className="flex flex-wrap gap-3">
              <Link href="/legal/privacy" className="text-[#667eea] hover:underline hover:text-[#764ba2] transition-colors">
                Política de Privacidade
              </Link>
              <Link href="/legal/cookies" className="text-[#667eea] hover:underline hover:text-[#764ba2] transition-colors">
                Política de Cookies
              </Link>
              <Link href="/legal/terms" className="text-[#667eea] hover:underline hover:text-[#764ba2] transition-colors">
                Termos de Uso
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}