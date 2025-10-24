import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { KlingVideoProvider } from '@/lib/ai/providers/kling'
import { createVideoGeneration, updateVideoGenerationJobId, getProcessingVideosCount } from '@/lib/db/videos'
import { calculateVideoCredits, validateVideoGenerationRequest, validateUserVideoLimits, generateEnhancedPrompt, normalizeVideoGenerationRequest } from '@/lib/ai/video/utils'
import { getVideoGenerationStats } from '@/lib/db/videos'
import { debitCreditsForVideo } from '@/lib/video/credit-manager'
import { AI_CONFIG } from '@/lib/ai/config'
import type { VideoGenerationRequest, UserPlan } from '@/lib/ai/video/config'

/**
 * POST /api/video/create
 * Create a new video from image using Kling AI
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🎬 Video API: Starting request processing')
    
    // Authenticate user
    const session = await requireAuthAPI()
    const userId = session.user.id
    const userPlan = (session.user as any)?.plan || 'STARTER'
    
    console.log('✅ Authentication successful:', { userId, userPlan })

    // Parse and normalize request body with official Kling v2.1 defaults
    const body = await request.json()
    console.log('📋 Raw request body:', JSON.stringify(body, null, 2))
    
    const videoRequest = normalizeVideoGenerationRequest(body)
    console.log('🔧 Normalized request:', JSON.stringify(videoRequest, null, 2))

    console.log(`🎬 Video creation request from user ${userId}:`, {
      prompt: videoRequest.prompt.substring(0, 100),
      duration: videoRequest.duration,
      quality: videoRequest.quality,
      aspectRatio: videoRequest.aspectRatio,
      hasImage: !!videoRequest.sourceImageUrl,
      mode: videoRequest.sourceImageUrl ? 'image-to-video' : 'text-to-video'
    })

    // Validate request
    console.log('🔍 Starting validation...')
    const validation = validateVideoGenerationRequest(videoRequest)
    if (!validation.isValid) {
      console.error('❌ Validation failed:', validation.errors)
      return NextResponse.json(
        { error: 'Invalid request parameters', details: validation.errors },
        { status: 400 }
      )
    }
    console.log('✅ Validation passed')

    // Get user statistics for limits validation
    console.log('📊 Getting user statistics...')
    let processingCount = 0
    let todayVideos = 0
    try {
      [processingCount, todayVideos] = await Promise.all([
        getProcessingVideosCount(userId),
        getVideoGenerationStats(userId).then(stats => stats.todayVideos)
      ])
      console.log('✅ User statistics retrieved:', { processingCount, todayVideos })
    } catch (statsError) {
      console.error('❌ Error getting user statistics:', statsError)
      // Use safe defaults if stats fail (already initialized above)
      console.log('⚠️ Using default statistics due to error')
    }

    // Validate user limits
    const limitsCheck = validateUserVideoLimits(
      userPlan as UserPlan,
      todayVideos,
      videoRequest.duration,
      videoRequest.quality,
      processingCount
    )

    if (!limitsCheck.canCreate) {
      return NextResponse.json(
        { 
          error: limitsCheck.reason,
          upgradeRequired: limitsCheck.upgradeRequired || false
        },
        { status: 403 }
      )
    }

    // Calculate credits needed
    const creditsNeeded = calculateVideoCredits(videoRequest.duration, videoRequest.quality)
    
    // Check user credit balance
    const userCreditsUsed = (session.user as any)?.creditsUsed || 0
    const userCreditsLimit = (session.user as any)?.creditsLimit || 500
    const availableCredits = userCreditsLimit - userCreditsUsed

    if (availableCredits < creditsNeeded) {
      return NextResponse.json(
        { 
          error: `Créditos insuficientes. Necessários: ${creditsNeeded}, Disponíveis: ${availableCredits}`,
          creditsNeeded,
          availableCredits
        },
        { status: 402 }
      )
    }

    // Enhance prompt if template is provided
    let enhancedPrompt = videoRequest.prompt
    if (videoRequest.template) {
      enhancedPrompt = generateEnhancedPrompt(
        videoRequest.prompt,
        videoRequest.template,
        videoRequest.aspectRatio
      )
    }

    // Create video generation record
    const videoGeneration = await createVideoGeneration(userId, {
      ...videoRequest,
      prompt: enhancedPrompt,
      creditsUsed: creditsNeeded,
      sourceGenerationId: body.sourceGenerationId // Optional link to original generation
    })

    // Initialize video provider
    console.log('🎬 Initializing Kling video provider...')
    let provider: any
    try {
      provider = new KlingVideoProvider()
      console.log('✅ Video provider initialized successfully')
    } catch (providerError) {
      console.error('❌ Error initializing video provider:', providerError)
      throw new Error('Failed to initialize video provider: ' + (providerError instanceof Error ? providerError.message : String(providerError)))
    }

    // Validate source image (only if provided for image-to-video)
    if (videoRequest.sourceImageUrl) {
      console.log('🔍 Validating source image URL for image-to-video...')
      try {
        const imageValidation = await provider.validateImageUrl(videoRequest.sourceImageUrl)
        if (!imageValidation.isValid) {
          console.error('❌ Image validation failed:', imageValidation.reason)
          // Update video generation with error
          await updateVideoGenerationJobId(
            videoGeneration.id,
            '',
            0
          )
          
          return NextResponse.json(
            { 
              error: `Imagem inválida: ${imageValidation.reason}`,
              videoId: videoGeneration.id
            },
            { status: 400 }
          )
        }
        console.log('✅ Source image validated successfully')
      } catch (imageError) {
        console.error('❌ Error validating image:', imageError)
        // Continue without validation if it fails (non-blocking)
        console.log('⚠️ Continuing without image validation due to error')
      }
    } else {
      console.log('ℹ️ No source image provided - text-to-video mode enabled')
    }

    try {
      // Build webhook URL
      const webhookUrl = `${AI_CONFIG.webhooks.baseUrl}/api/webhooks/video`
      console.log('📞 Webhook URL configured:', webhookUrl)
      
      // Submit to Kling AI via Replicate
      console.log('🚀 Submitting to Kling AI provider...')
      const requestToSend = {
        ...videoRequest,
        prompt: enhancedPrompt
      }
      console.log('📋 Request to provider:', JSON.stringify(requestToSend, null, 2))
      
      const providerResponse = await provider.generateVideo(requestToSend, webhookUrl)
      console.log('✅ Provider response received:', JSON.stringify(providerResponse, null, 2))

      // Update video generation with job ID
      await updateVideoGenerationJobId(
        videoGeneration.id,
        providerResponse.jobId!,
        providerResponse.estimatedTimeRemaining
      )

      console.log(`✅ Video generation ${videoGeneration.id} submitted with job ${providerResponse.jobId}`)

      // Debit credits from user account
      try {
        await debitCreditsForVideo(
          userId,
          videoGeneration.id,
          creditsNeeded,
          {
            duration: videoRequest.duration,
            quality: videoRequest.quality,
            aspectRatio: videoRequest.aspectRatio,
            prompt: enhancedPrompt
          }
        )
        console.log(`💳 Credits debited for video ${videoGeneration.id}: ${creditsNeeded}`)
      } catch (creditError) {
        console.error('❌ Failed to debit credits:', creditError)
        // Note: We don't fail the video creation if credit debit fails
        // The video will still be created, but we log the error for manual review
      }

      // Return success response with video info
      return NextResponse.json({
        success: true,
        videoId: videoGeneration.id,
        jobId: providerResponse.jobId,
        status: providerResponse.status,
        estimatedTime: providerResponse.estimatedTimeRemaining,
        creditsUsed: creditsNeeded,
        message: `Vídeo em processamento. Tempo estimado: ${Math.round((providerResponse.estimatedTimeRemaining || 90) / 60)} minutos`
      })

    } catch (providerError) {
      console.error('❌ Video provider error:', providerError)
      
      // Update video generation with error
      await updateVideoGenerationJobId(
        videoGeneration.id,
        '',
        0
      )

      // Return provider error
      return NextResponse.json(
        { 
          error: providerError instanceof Error ? providerError.message : 'Failed to start video generation',
          videoId: videoGeneration.id
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('❌ Video creation API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Error name:', error instanceof Error ? error.name : 'Unknown error type')
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    
    // Handle authentication error specifically
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error during video creation',
        details: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/video/create
 * Get video creation capabilities and limits for current user
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await requireAuthAPI()
    const userId = session.user.id
    const userPlan = (session.user as any)?.plan || 'STARTER'

    // Get user statistics
    const [stats, processingCount] = await Promise.all([
      getVideoGenerationStats(userId),
      getProcessingVideosCount(userId)
    ])

    // Get user credit info
    const userCreditsUsed = (session.user as any)?.creditsUsed || 0
    const userCreditsLimit = (session.user as any)?.creditsLimit || 500
    const availableCredits = userCreditsLimit - userCreditsUsed

    // Build capabilities response
    return NextResponse.json({
      capabilities: {
        maxVideosPerDay: {
          STARTER: 5,
          PREMIUM: 20,
          GOLD: 50
        }[userPlan] || 5,
        maxDuration: 10,
        qualityOptions: ['standard', 'pro'],
        aspectRatios: ['16:9', '9:16', '1:1'],
        maxConcurrentJobs: {
          STARTER: 2,
          PREMIUM: 3,
          GOLD: 5
        }[userPlan] || 2
      },
      currentUsage: {
        todayVideos: stats.todayVideos,
        processingVideos: processingCount,
        totalVideos: stats.totalVideos,
        completedVideos: stats.completedVideos,
        availableCredits,
        creditsUsed: userCreditsUsed,
        creditsLimit: userCreditsLimit
      },
      costs: {
        '5_standard': calculateVideoCredits(5, 'standard'),
        '5_pro': calculateVideoCredits(5, 'pro'),
        '10_standard': calculateVideoCredits(10, 'standard'),
        '10_pro': calculateVideoCredits(10, 'pro')
      }
    })

  } catch (error) {
    console.error('❌ Video creation capabilities API error:', error)
    
    // Handle authentication error specifically
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to get video creation capabilities' },
      { status: 500 }
    )
  }
}