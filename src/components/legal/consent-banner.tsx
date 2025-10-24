'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Shield, 
  Eye, 
  Lock, 
  FileText, 
  Settings, 
  X,
  ExternalLink,
  Check,
  Info
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ConsentPreferences {
  necessary: boolean
  analytics: boolean
  marketing: boolean
  personalization: boolean
}

interface ConsentBannerProps {
  onConsentChange?: (consents: ConsentPreferences) => void
  showBanner?: boolean
  position?: 'bottom' | 'top'
}

const consentTypes = {
  necessary: {
    name: 'Cookies Necessários',
    description: 'Essenciais para o funcionamento do site e não podem ser desabilitados',
    icon: Shield,
    required: true,
    examples: ['Autenticação', 'Sessão do usuário', 'Carrinho de compras', 'Preferências de idioma']
  },
  analytics: {
    name: 'Cookies de Análise',
    description: 'Nos ajudam a entender como você usa nosso site para melhorarmos a experiência',
    icon: Eye,
    required: false,
    examples: ['Google Analytics', 'Métricas de desempenho', 'Estatísticas de uso', 'Relatórios de erro']
  },
  marketing: {
    name: 'Cookies de Marketing',
    description: 'Usados para exibir anúncios relevantes e medir a eficácia das campanhas',
    icon: FileText,
    required: false,
    examples: ['Facebook Pixel', 'Google Ads', 'Remarketing', 'Campanhas personalizadas']
  },
  personalization: {
    name: 'Cookies de Personalização',
    description: 'Permitem uma experiência personalizada com base nas suas preferências',
    icon: Settings,
    required: false,
    examples: ['Tema preferido', 'Configurações da interface', 'Recomendações personalizadas']
  }
}

const CONSENT_COOKIE_NAME = 'vibe-consent-preferences'
const CONSENT_BANNER_COOKIE = 'vibe-consent-banner-shown'

export function ConsentBanner({ onConsentChange, showBanner = true, position = 'bottom' }: ConsentBannerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    personalization: false
  })

  useEffect(() => {
    // Check if user has already given consent
    const existingConsent = localStorage.getItem(CONSENT_COOKIE_NAME)
    const bannerShown = localStorage.getItem(CONSENT_BANNER_COOKIE)
    
    if (!existingConsent && !bannerShown && showBanner) {
      setIsVisible(true)
    } else if (existingConsent) {
      try {
        const savedPreferences = JSON.parse(existingConsent)
        setPreferences(savedPreferences)
        if (onConsentChange) {
          onConsentChange(savedPreferences)
        }
      } catch (error) {
        console.error('Error parsing consent preferences:', error)
      }
    }
  }, [showBanner, onConsentChange])

  const handleAcceptAll = () => {
    const allAccepted: ConsentPreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      personalization: true
    }
    
    saveConsent(allAccepted)
    setIsVisible(false)
  }

  const handleRejectOptional = () => {
    const onlyNecessary: ConsentPreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      personalization: false
    }
    
    saveConsent(onlyNecessary)
    setIsVisible(false)
  }

  const handleSavePreferences = () => {
    saveConsent(preferences)
    setIsVisible(false)
    setShowDetails(false)
  }

  const saveConsent = (consents: ConsentPreferences) => {
    localStorage.setItem(CONSENT_COOKIE_NAME, JSON.stringify(consents))
    localStorage.setItem(CONSENT_BANNER_COOKIE, 'true')
    setPreferences(consents)
    
    if (onConsentChange) {
      onConsentChange(consents)
    }

    // Trigger consent events for analytics/marketing tools
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('consentUpdated', { 
        detail: consents 
      }))
    }
  }

  const handlePreferenceChange = (type: keyof ConsentPreferences, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      [type]: value
    }))
  }

  const getActiveConsentsCount = () => {
    return Object.values(preferences).filter(Boolean).length
  }

  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: position === 'bottom' ? 100 : -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: position === 'bottom' ? 100 : -100, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={`fixed ${position === 'bottom' ? 'bottom-0' : 'top-0'} left-0 right-0 z-50 p-4`}
      >
        <Card className="max-w-4xl mx-auto shadow-2xl border-2">
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Sua privacidade é importante</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Usamos cookies e tecnologias similares para melhorar sua experiência, 
                    personalizar conteúdo e analisar nosso tráfego.
                  </p>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsVisible(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* LGPD Compliance Notice */}
            <div className="flex items-center space-x-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-4 w-4 text-blue-600" />
              <div className="text-sm">
                <span className="font-medium text-blue-800">LGPD:</span>
                <span className="text-blue-700 ml-1">
                  De acordo com a Lei Geral de Proteção de Dados, você tem controle sobre seus dados pessoais.
                </span>
              </div>
            </div>

            {!showDetails ? (
              /* Simple Banner */
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <Check className="h-3 w-3 mr-1" />
                    Necessários
                  </Badge>
                  <Badge variant="outline">Análise</Badge>
                  <Badge variant="outline">Marketing</Badge>
                  <Badge variant="outline">Personalização</Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleAcceptAll} className="flex-1 sm:flex-none">
                    Aceitar Todos
                  </Button>
                  
                  <Button variant="outline" onClick={handleRejectOptional} className="flex-1 sm:flex-none">
                    Apenas Necessários
                  </Button>
                  
                  <Dialog open={showDetails} onOpenChange={setShowDetails}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1 sm:flex-none">
                        <Settings className="h-4 w-4 mr-2" />
                        Personalizar
                      </Button>
                    </DialogTrigger>
                    
                    <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Preferências de Cookies</DialogTitle>
                        <DialogDescription>
                          Escolha quais tipos de cookies você permite. Você pode alterar essas configurações a qualquer momento.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-6 mt-6">
                        {Object.entries(consentTypes).map(([key, config]) => {
                          const Icon = config.icon
                          const isEnabled = preferences[key as keyof ConsentPreferences]
                          
                          return (
                            <div key={key} className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="p-2 bg-primary/10 rounded-lg">
                                    <Icon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <h4 className="font-medium">{config.name}</h4>
                                      {config.required && (
                                        <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                                          Obrigatório
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {config.description}
                                    </p>
                                  </div>
                                </div>
                                
                                <Checkbox
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => 
                                    handlePreferenceChange(key as keyof ConsentPreferences, checked as boolean)
                                  }
                                  disabled={config.required}
                                />
                              </div>
                              
                              <div className="ml-12 text-xs text-muted-foreground">
                                <strong>Exemplos:</strong> {config.examples.join(', ')}
                              </div>
                              
                              {key !== 'personalization' && <Separator />}
                            </div>
                          )
                        })}
                      </div>
                      
                      <div className="flex justify-between items-center pt-6">
                        <div className="text-sm text-muted-foreground">
                          {getActiveConsentsCount()} de {Object.keys(consentTypes).length} tipos ativados
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button variant="outline" onClick={() => setShowDetails(false)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleSavePreferences}>
                            Salvar Preferências
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="text-xs text-muted-foreground">
                  Ao continuar, você concorda com nossa{' '}
                  <a href="/legal/privacy" className="underline hover:text-primary" target="_blank">
                    Política de Privacidade
                  </a>{' '}
                  e{' '}
                  <a href="/legal/cookies" className="underline hover:text-primary" target="_blank">
                    Política de Cookies
                  </a>.
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}

// Hook for accessing consent preferences
export function useConsent() {
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    personalization: false
  })

  useEffect(() => {
    const loadPreferences = () => {
      try {
        const saved = localStorage.getItem(CONSENT_COOKIE_NAME)
        if (saved) {
          setPreferences(JSON.parse(saved))
        }
      } catch (error) {
        console.error('Error loading consent preferences:', error)
      }
    }

    loadPreferences()

    // Listen for consent updates
    const handleConsentUpdate = (event: CustomEvent) => {
      setPreferences(event.detail)
    }

    window.addEventListener('consentUpdated', handleConsentUpdate as EventListener)
    
    return () => {
      window.removeEventListener('consentUpdated', handleConsentUpdate as EventListener)
    }
  }, [])

  const updatePreferences = (newPreferences: ConsentPreferences) => {
    localStorage.setItem(CONSENT_COOKIE_NAME, JSON.stringify(newPreferences))
    setPreferences(newPreferences)
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('consentUpdated', { 
        detail: newPreferences 
      }))
    }
  }

  const hasConsent = (type: keyof ConsentPreferences): boolean => {
    return preferences[type]
  }

  const isConsentGiven = (): boolean => {
    return !!localStorage.getItem(CONSENT_COOKIE_NAME)
  }

  return {
    preferences,
    updatePreferences,
    hasConsent,
    isConsentGiven
  }
}