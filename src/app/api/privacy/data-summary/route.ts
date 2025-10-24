import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Verify user authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Get user personal information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        mobilePhone: true,
        cpfCnpj: true,
        address: true,
        addressNumber: true,
        complement: true,
        city: true,
        state: true,
        postalCode: true,
        createdAt: true,
        lastLoginAt: true,
        creditsUsed: true,
        subscriptionStatus: true,
        _count: {
          select: {
            aiModels: true,
            generations: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Get AI models data
    const aiModels = await prisma.aIModel.findMany({
      where: { userId },
      select: {
        id: true,
        createdAt: true,
        status: true,
        trainingImages: {
          select: {
            id: true,
            fileSize: true
          }
        }
      }
    })

    // Calculate total training photos and size
    let totalTrainingPhotos = 0
    let totalModelSize = 0
    
    aiModels.forEach(model => {
      totalTrainingPhotos += model.trainingImages.length
      model.trainingImages.forEach(image => {
        totalModelSize += image.fileSize || 0
      })
    })

    // Get generated images data
    const generatedImages = await prisma.generation.findMany({
      where: { userId },
      select: {
        id: true,
        createdAt: true,
        results: {
          select: {
            id: true,
            fileSize: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    // Calculate total generated images size
    let totalGeneratedSize = 0
    let totalGeneratedCount = 0
    
    generatedImages.forEach(generation => {
      totalGeneratedCount += generation.results.length
      generation.results.forEach(result => {
        totalGeneratedSize += result.fileSize || 0
      })
    })

    const oldestGeneration = generatedImages[0]
    const newestGeneration = generatedImages[generatedImages.length - 1]

    // Get payment data
    const paymentData = await prisma.payment.aggregate({
      where: { userId },
      _count: { id: true }
    })

    const paymentMethods = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        asaasCustomerId: true
      }
    })

    const lastPayment = await prisma.payment.findFirst({
      where: { 
        userId,
        status: 'CONFIRMED'
      },
      orderBy: { confirmedDate: 'desc' },
      select: { confirmedDate: true }
    })

    // Get usage statistics
    const usageLogs = await prisma.usageLog.findMany({
      where: { userId },
      select: {
        action: true,
        creditsUsed: true,
        createdAt: true
      }
    })

    // Calculate unique sessions (group by day)
    const sessionDays = new Set(
      usageLogs.map(log => 
        log.createdAt.toISOString().split('T')[0]
      )
    ).size

    // Get unique features used
    const featuresUsed = Array.from(new Set(
      usageLogs.map(log => log.action)
    )).filter(action => 
      !action.startsWith('CREDITS_') && 
      !action.startsWith('AUTH_')
    )

    // Calculate data retention days (how long we keep the data)
    const dataRetentionDays = 365 // 1 year for most data

    return NextResponse.json({
      personalInfo: {
        name: user.name || '',
        email: user.email,
        phone: user.phone || user.mobilePhone || '',
        cpfCnpj: user.cpfCnpj || '',
        address: [
          user.address,
          user.addressNumber,
          user.complement,
          user.city,
          user.state,
          user.postalCode
        ].filter(Boolean).join(', '),
        createdAt: user.createdAt.toISOString(),
        lastLogin: (user.lastLoginAt || user.createdAt).toISOString()
      },
      
      generatedImages: {
        count: totalGeneratedCount,
        totalSize: totalGeneratedSize,
        oldestDate: oldestGeneration?.createdAt.toISOString() || null,
        newestDate: newestGeneration?.createdAt.toISOString() || null
      },
      
      trainedModels: {
        count: aiModels.length,
        totalSize: totalModelSize,
        trainingPhotos: totalTrainingPhotos
      },
      
      paymentData: {
        transactionCount: paymentData._count.id,
        subscriptionActive: user.subscriptionStatus === 'ACTIVE',
        paymentMethods: paymentMethods?.asaasCustomerId ? 1 : 0,
        lastPayment: lastPayment?.confirmedDate?.toISOString() || null
      },
      
      usageData: {
        sessionCount: sessionDays,
        totalCreditsUsed: user.creditsUsed || 0,
        featuresUsed,
        dataRetentionDays
      }
    })

  } catch (error: any) {
    console.error('Data summary error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST method for updating data retention preferences
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { dataRetentionPreferences } = body

    // Update user preferences for data retention
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        // Store preferences in a JSON field if available, or create a separate table
        // For now, we'll log this action
      }
    })

    // Log the preference update
    await prisma.usageLog.create({
      data: {
        userId: session.user.id,
        action: 'PRIVACY_PREFERENCES_UPDATED',
        creditsUsed: 0,
        details: {
          dataRetentionPreferences,
          updatedAt: new Date().toISOString()
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Preferências de privacidade atualizadas'
    })

  } catch (error: any) {
    console.error('Update privacy preferences error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}