'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ArrowRight, CheckCircle, Upload, User, Users, Heart, Shield, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { ModelCreationStep1 } from '@/components/models/creation/step-1-photos'
import { ModelCreationStep2HalfBody } from '@/components/models/creation/step-2-half-body'
import { ModelCreationStep3FullBody } from '@/components/models/creation/step-3-full-body'
import { ModelCreationStep4 } from '@/components/models/creation/step-4-review'
import { SubscriptionGate } from '@/components/subscription/subscription-gate'
import { useToast } from '@/hooks/use-toast'
import { ProtectedPageScript } from '@/components/auth/protected-page-script'
import { useAuthGuard } from '@/hooks/useAuthGuard'

export default function CreateModelPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { addToast } = useToast()
  
  // Hooks DEVEM vir antes de qualquer early return para não violar regras do React
  const isAuthorized = useAuthGuard()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [modelCostInfo, setModelCostInfo] = useState<any>(null)

  const [modelData, setModelData] = useState({
    name: '',
    class: 'MAN' as 'MAN' | 'WOMAN' | 'BOY' | 'GIRL' | 'ANIMAL',
    facePhotos: [] as File[],
    halfBodyPhotos: [] as File[],
    fullBodyPhotos: [] as File[]
  })

  const [consentAccepted, setConsentAccepted] = useState(false)

  // Fetch model cost info on mount
  useEffect(() => {
    const fetchModelCostInfo = async () => {
      try {
        const response = await fetch('/api/models/cost-info')
        if (response.ok) {
          const data = await response.json()
          setModelCostInfo(data)
        }
      } catch (error) {
        console.error('Error fetching model cost info:', error)
      }
    }
    fetchModelCostInfo()
  }, [])

  const steps = [
    {
      number: 1,
      title: 'Fotos do Rosto',
      description: '5-10 fotos claras do rosto',
      completed: modelData.facePhotos.length >= 5
    },
    {
      number: 2,
      title: 'Fotos de Meio Corpo',
      description: '5-10 fotos de meio corpo',
      completed: modelData.halfBodyPhotos.length >= 5
    },
    {
      number: 3,
      title: 'Fotos de Corpo Inteiro',
      description: '5-10 fotos de corpo inteiro',
      completed: modelData.fullBodyPhotos.length >= 5
    },
    {
      number: 4,
      title: 'Revisar e Treinar',
      description: 'Revisar e iniciar treinamento',
      completed: false
    }
  ]

  // useEffect para scroll automático sempre que a etapa mudar
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentStep])

  const handleNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)

    addToast({
      title: "Iniciando treinamento",
      description: "Enviando fotos e configurando modelo de IA...",
      type: "info"
    })

    try {
      console.log('🚀 Creating model with data:', {
        name: modelData.name,
        class: modelData.class,
        facePhotosCount: modelData.facePhotos.length,
        halfBodyPhotosCount: modelData.halfBodyPhotos.length,
        fullBodyPhotosCount: modelData.fullBodyPhotos.length
      })

      // 1) Presign request
      const allFiles = [
        ...modelData.facePhotos.map(f => ({ file: f, category: 'face' })),
        ...modelData.halfBodyPhotos.map(f => ({ file: f, category: 'half-body' })),
        ...modelData.fullBodyPhotos.map(f => ({ file: f, category: 'full-body' }))
      ]

      const presignRes = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session?.user?.id,
          files: allFiles.map(({ file, category }) => ({ name: file.name, type: file.type, category }))
        })
      })
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}))
        throw new Error(err?.error || 'Falha ao pré-assinar uploads')
      }
      const presignData = await presignRes.json()

      // 2) Upload direto para S3 (PUT)
      const uploads = presignData.uploads as Array<{ uploadUrl: string; publicUrl: string; key: string; contentType: string }>
      if (!uploads || uploads.length !== allFiles.length) {
        throw new Error('Resposta de presign inválida')
      }

      await Promise.all(uploads.map((u, idx) => {
        const { file } = allFiles[idx]
        return fetch(u.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file
        }).then(res => {
          if (!res.ok) throw new Error(`Falha ao subir arquivo: ${file.name}`)
        })
      }))

      // 3) Separar URLs por categoria
      const facePhotoUrls: string[] = []
      const halfBodyPhotoUrls: string[] = []
      const fullBodyPhotoUrls: string[] = []
      uploads.forEach((u, idx) => {
        const category = allFiles[idx].category
        if (category === 'face') facePhotoUrls.push(u.publicUrl)
        else if (category === 'half-body') halfBodyPhotoUrls.push(u.publicUrl)
        else if (category === 'full-body') fullBodyPhotoUrls.push(u.publicUrl)
      })

      // 3.5) Validar URLs antes de criar o modelo
      const validateRes = await fetch('/api/uploads/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facePhotoUrls,
          halfBodyPhotoUrls,
          fullBodyPhotoUrls,
          enforceDomain: true
        })
      })
      if (!validateRes.ok) {
        const err = await validateRes.json().catch(() => ({}))
        throw new Error(err?.error || 'Falha ao validar URLs')
      }
      const validateData = await validateRes.json()
      if (!validateData.valid) {
        console.warn('URL validation errors:', validateData.errors)
        addToast({
          title: 'URLs inválidas',
          description: 'Algumas fotos não passaram na validação. Verifique e tente novamente.',
          type: 'error'
        })
        setIsSubmitting(false)
        return
      }

      console.log('📤 Sending request to /api/models with URLs...')

      // 4) Criar modelo com URLs
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modelData.name,
          class: modelData.class,
          facePhotoUrls,
          halfBodyPhotoUrls,
          fullBodyPhotoUrls
        })
      })

      const result = await response.json()

      if (!response.ok) {
        // Check if error is due to insufficient credits (status 402)
        if (response.status === 402 && result.needsCredits) {
          console.log('💰 Insufficient credits for model creation')

          // Show error with credit purchase call to action
          addToast({
            title: "Créditos insuficientes",
            description: result.error || 'Você precisa de mais créditos para criar modelos adicionais.',
            type: "error",
            action: {
              label: "Comprar Créditos",
              onClick: () => {
                // Trigger credit purchase modal by clicking on the credits badge
                const creditsButton = document.querySelector('[data-credits-button]')
                if (creditsButton instanceof HTMLElement) {
                  creditsButton.click()
                } else {
                  // Fallback: redirect to credits page
                  router.push('/credits')
                }
              }
            }
          })

          setIsSubmitting(false)
          return
        }

        throw new Error(result.error || 'Failed to create model')
      }

      console.log('✅ Model creation response:', result)

      addToast({
        title: "Modelo criado com sucesso",
        description: "Treinamento iniciado! Tempo estimado: 40 minutos. Você receberá uma notificação quando estiver pronto.",
        type: "success"
      })

      router.push('/models?created=true')
    } catch (error) {
      console.error('❌ Error creating model:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'

      addToast({
        title: "Erro no treinamento",
        description: errorMessage,
        type: "error"
      })
      setIsSubmitting(false)
    }
  }

  const canProceedToNext = () => {
    switch (currentStep) {
      case 1:
        return modelData.name && modelData.class && modelData.facePhotos.length >= 5
      case 2:
        return modelData.halfBodyPhotos.length >= 5
      case 3:
        return modelData.fullBodyPhotos.length >= 5
      case 4:
        return true
      default:
        return false
    }
  }

  // Early returns APÓS todos os hooks
  if (isAuthorized === false || status === 'unauthenticated' || !session?.user) {
    return null
  }

  if (isAuthorized === null || status === 'loading') {
    return null
  }

  if (!session) {
    return <div>Loading...</div>
  }

  return (
    <>
    <ProtectedPageScript />
    <SubscriptionGate feature="criação de modelos de IA">
      <div className="min-h-screen bg-gray-50" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
        {/* Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-6">
              <div>
                <Button variant="ghost" size="sm" asChild className="mb-4">
                  <Link href="/models">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar aos Modelos
                  </Link>
                </Button>
                <h1 className="text-3xl font-bold text-gray-900" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>Novo Modelo de IA</h1>
              </div>
              <Badge variant="secondary" style={{fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif'}}>
                Etapa {currentStep} de 4
              </Badge>
            </div>
          </div>
        </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">


        {/* Step Content */}
        <div className="mb-8">
          {currentStep === 1 && (
            <ModelCreationStep1
              modelData={modelData}
              setModelData={setModelData}
              modelCostInfo={modelCostInfo}
            />
          )}

          {currentStep === 2 && (
            <ModelCreationStep2HalfBody
              modelData={modelData}
              setModelData={setModelData}
            />
          )}

          {currentStep === 3 && (
            <ModelCreationStep3FullBody
              modelData={modelData}
              setModelData={setModelData}
            />
          )}

          {currentStep === 4 && (
            <ModelCreationStep4
              modelData={modelData}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
              onPrevStep={handlePrevStep}
            />
          )}
        </div>

        {/* Navigation */}
        {currentStep < 4 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  {currentStep > 1 && (
                    <Button variant="outline" onClick={handlePrevStep}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Anterior
                    </Button>
                  )}
                </div>

                <div className="flex items-center space-x-3">
                  <Button
                    onClick={handleNextStep}
                    disabled={!canProceedToNext()}
                    className="bg-gradient-to-r from-[#667EEA] to-[#764BA2] hover:from-[#667EEA]/90 hover:to-[#764BA2]/90 text-white border-0"
                  >
                    Próximo
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </SubscriptionGate>
    </>
  )
}