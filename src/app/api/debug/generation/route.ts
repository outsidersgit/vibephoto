import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getModelById } from '@/lib/db/models'
import { getAIProvider } from '@/lib/ai'
import { AI_CONFIG } from '@/lib/ai/config'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { modelId } = await request.json()
    
    // Debug information collection
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      user: {
        id: session.user.id,
        plan: (session.user as any).plan || 'FREE'
      },
      environment: {
        aiProvider: AI_CONFIG.provider,
        nodeEnv: process.env.NODE_ENV,
        hasReplicateToken: !!process.env.REPLICATE_API_TOKEN,
        hasWebhookUrl: !!process.env.NEXTAUTH_URL
      },
      aiConfig: {
        fluxModels: {
          generation: AI_CONFIG.replicate.models.flux.generation,
          dev: AI_CONFIG.replicate.models.flux.dev,
          pro: AI_CONFIG.replicate.models.flux.pro
        },
        replicateUsername: AI_CONFIG.replicate.modelNaming.baseUsername
      }
    }

    // Check AI provider status
    try {
      const aiProvider = getAIProvider()
      debugInfo.aiProvider = {
        type: AI_CONFIG.provider,
        initialized: true
      }
      
      // Test basic model list
      if (AI_CONFIG.provider === 'replicate') {
        try {
          const models = await aiProvider.getAvailableModels()
          debugInfo.aiProvider.availableModels = models.length
        } catch (modelError) {
          debugInfo.aiProvider.modelListError = modelError instanceof Error ? modelError.message : 'Unknown error'
        }
      }
    } catch (providerError) {
      debugInfo.aiProvider = {
        type: AI_CONFIG.provider,
        initialized: false,
        error: providerError instanceof Error ? providerError.message : 'Unknown error'
      }
    }

    // Check specific model if provided
    if (modelId) {
      try {
        const model = await getModelById(modelId, session.user.id)
        debugInfo.model = {
          found: !!model,
          status: model?.status,
          hasModelUrl: !!model?.modelUrl,
          modelUrl: model?.modelUrl ? `${model.modelUrl.substring(0, 20)}...` : null,
          createdAt: model?.createdAt,
          trainedAt: model?.trainedAt
        }

        // Validate model URL if exists
        if (model?.modelUrl && AI_CONFIG.provider === 'replicate') {
          try {
            const aiProvider = getAIProvider()
            const isValid = await (aiProvider as any).validateModel(model.modelUrl)
            debugInfo.model.validation = {
              valid: isValid,
              testedAt: new Date().toISOString()
            }
          } catch (validationError) {
            debugInfo.model.validation = {
              valid: false,
              error: validationError instanceof Error ? validationError.message : 'Unknown error'
            }
          }
        }
      } catch (modelError) {
        debugInfo.model = {
          found: false,
          error: modelError instanceof Error ? modelError.message : 'Unknown error'
        }
      }
    }

    // Test Replicate API connectivity
    if (AI_CONFIG.provider === 'replicate' && process.env.REPLICATE_API_TOKEN) {
      try {
        const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell', {
          headers: {
            'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        })
        
        debugInfo.replicateApi = {
          accessible: response.ok,
          status: response.status,
          statusText: response.statusText
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          debugInfo.replicateApi.error = errorData
        }
      } catch (apiError) {
        debugInfo.replicateApi = {
          accessible: false,
          error: apiError instanceof Error ? apiError.message : 'Unknown error'
        }
      }
    }

    // Database connectivity check
    try {
      const { prisma } = await import('@/lib/db')
      await prisma.$queryRaw`SELECT 1`
      debugInfo.database = { accessible: true }
    } catch (dbError) {
      debugInfo.database = {
        accessible: false,
        error: dbError instanceof Error ? dbError.message : 'Unknown error'
      }
    }

    return NextResponse.json({
      success: true,
      debug: debugInfo
    })

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}