import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import archiver from 'archiver'
import { createWriteStream, promises as fs } from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { categories = ['all'] } = body
    const userId = session.user.id

    // Check if user already has a pending export request
    const existingRequest = await prisma.dataExportRequest.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'PROCESSING'] }
      }
    })

    if (existingRequest) {
      return NextResponse.json(
        { 
          error: 'Você já possui uma solicitação de exportação em andamento',
          existingRequestId: existingRequest.id
        },
        { status: 400 }
      )
    }

    // Create new export request
    const exportRequest = await prisma.dataExportRequest.create({
      data: {
        userId,
        categories: categories.includes('all') ? ['all'] : categories,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    })

    // Process export asynchronously
    processDataExport(exportRequest.id, userId, categories)
      .catch(error => {
        console.error('Export processing error:', error)
        // Update status to failed
        prisma.dataExportRequest.update({
          where: { id: exportRequest.id },
          data: { 
            status: 'FAILED',
            error: error.message
          }
        }).catch(console.error)
      })

    return NextResponse.json({
      success: true,
      requestId: exportRequest.id,
      message: 'Solicitação de exportação criada. Você receberá um email quando estiver pronta.',
      estimatedTime: '15-30 minutos'
    })

  } catch (error: any) {
    console.error('Export data error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET method to check export status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')

    if (requestId) {
      // Get specific request
      const exportRequest = await prisma.dataExportRequest.findFirst({
        where: {
          id: requestId,
          userId: session.user.id
        }
      })

      if (!exportRequest) {
        return NextResponse.json(
          { error: 'Solicitação não encontrada' },
          { status: 404 }
        )
      }

      return NextResponse.json(exportRequest)
    } else {
      // Get all user's export requests
      const requests = await prisma.dataExportRequest.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        take: 10
      })

      return NextResponse.json({ requests })
    }

  } catch (error: any) {
    console.error('Get export requests error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

async function processDataExport(requestId: string, userId: string, categories: string[]) {
  try {
    // Update status to processing
    await prisma.dataExportRequest.update({
      where: { id: requestId },
      data: { status: 'PROCESSING' }
    })

    const exportData: any = {}
    const includeAll = categories.includes('all')

    // Personal Information
    if (includeAll || categories.includes('personalInfo')) {
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
          province: true,
          city: true,
          state: true,
          postalCode: true,
          plan: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          creditsBalance: true,
          creditsUsed: true,
          creditsLimit: true
        }
      })

      exportData.personalInfo = {
        ...user,
        exportedAt: new Date().toISOString(),
        note: 'Dados pessoais conforme LGPD Art. 9°'
      }
    }

    // AI Models and Training Data
    if (includeAll || categories.includes('trainedModels')) {
      const aiModels = await prisma.aIModel.findMany({
        where: { userId },
        include: {
          trainingImages: {
            select: {
              id: true,
              url: true,
              category: true,
              fileSize: true,
              createdAt: true
            }
          }
        }
      })

      exportData.trainedModels = {
        models: aiModels.map(model => ({
          ...model,
          trainingImages: model.trainingImages.map(img => ({
            ...img,
            note: 'Imagem de treinamento - Art. 7°, IX LGPD'
          }))
        })),
        totalModels: aiModels.length,
        exportedAt: new Date().toISOString()
      }
    }

    // Generated Images
    if (includeAll || categories.includes('generatedImages')) {
      const generations = await prisma.generation.findMany({
        where: { userId },
        include: {
          results: {
            select: {
              id: true,
              url: true,
              prompt: true,
              fileSize: true,
              createdAt: true
            }
          },
          model: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      exportData.generatedImages = {
        generations: generations.map(gen => ({
          id: gen.id,
          prompt: gen.prompt,
          createdAt: gen.createdAt,
          model: gen.model,
          results: gen.results
        })),
        totalGenerations: generations.length,
        exportedAt: new Date().toISOString()
      }
    }

    // Payment Data
    if (includeAll || categories.includes('paymentData')) {
      const payments = await prisma.payment.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          status: true,
          billingType: true,
          value: true,
          description: true,
          createdAt: true,
          confirmedDate: true,
          dueDate: true,
          installmentCount: true,
          creditAmount: true
        }
      })

      const creditPurchases = await prisma.creditPurchase.findMany({
        where: { userId },
        select: {
          id: true,
          packageName: true,
          creditAmount: true,
          value: true,
          status: true,
          purchasedAt: true,
          confirmedAt: true,
          validUntil: true
        }
      })

      exportData.paymentData = {
        payments,
        creditPurchases,
        totalPayments: payments.length,
        totalCreditPurchases: creditPurchases.length,
        exportedAt: new Date().toISOString(),
        note: 'Dados financeiros mantidos por 7 anos para conformidade fiscal'
      }
    }

    // Usage and Activity Data
    if (includeAll || categories.includes('usageData')) {
      const usageLogs = await prisma.usageLog.findMany({
        where: { userId },
        select: {
          id: true,
          action: true,
          creditsUsed: true,
          createdAt: true,
          details: true
        },
        orderBy: { createdAt: 'desc' },
        take: 1000 // Limit to last 1000 entries
      })

      exportData.usageData = {
        usageLogs,
        totalEntries: usageLogs.length,
        exportedAt: new Date().toISOString(),
        note: 'Dados de uso mantidos por 6 meses para melhorias do serviço'
      }
    }

    // Generate export file
    const exportFileName = `dados-pessoais-${userId}-${Date.now()}.json`
    const exportPath = path.join(process.cwd(), 'tmp', exportFileName)
    
    // Ensure tmp directory exists
    await fs.mkdir(path.join(process.cwd(), 'tmp'), { recursive: true })
    
    // Write export data to file
    await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2), 'utf-8')

    // Create ZIP archive
    const zipFileName = `dados-pessoais-${userId}-${Date.now()}.zip`
    const zipPath = path.join(process.cwd(), 'tmp', zipFileName)
    
    await new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', () => resolve())
      archive.on('error', (err) => reject(err))

      archive.pipe(output)
      
      // Add main data file
      archive.file(exportPath, { name: 'meus-dados.json' })
      
      // Add README
      const readme = `# Exportação dos Seus Dados - LGPD

Este arquivo contém todos os dados pessoais que temos sobre você, conforme seu direito à portabilidade garantido pela Lei Geral de Proteção de Dados (LGPD).

## Conteúdo do arquivo:
- **personalInfo**: Informações pessoais básicas (nome, email, etc.)
- **trainedModels**: Modelos de IA treinados e imagens de treinamento
- **generatedImages**: Imagens geradas pelos modelos
- **paymentData**: Histórico de pagamentos e compras de créditos
- **usageData**: Logs de atividade e uso do sistema

## Formato dos dados:
Os dados estão em formato JSON, facilmente legível por humanos e importável em outros sistemas.

## Seus direitos LGPD:
- Direito de acesso aos dados
- Direito de correção de dados incorretos
- Direito de exclusão de dados desnecessários
- Direito de portabilidade dos dados
- Direito de oposição ao tratamento

## Contato:
Para questões sobre privacidade e proteção de dados, entre em contato conosco através do email: privacidade@vibephoto.com

Exportação gerada em: ${new Date().toLocaleString('pt-BR')}
`
      
      archive.append(readme, { name: 'LEIA-ME.txt' })
      archive.finalize()
    })

    // Clean up temporary JSON file
    await fs.unlink(exportPath)

    // Update export request with download info
    const downloadUrl = `/api/privacy/download-export/${requestId}`
    
    await prisma.dataExportRequest.update({
      where: { id: requestId },
      data: {
        status: 'COMPLETED',
        filePath: zipPath,
        downloadUrl,
        completedAt: new Date()
      }
    })

    // Log the export completion
    await prisma.usageLog.create({
      data: {
        userId,
        action: 'DATA_EXPORTED',
        creditsUsed: 0,
        details: {
          requestId,
          categories,
          fileSize: (await fs.stat(zipPath)).size,
          exportedAt: new Date().toISOString()
        }
      }
    })

    console.log(`Data export completed for user ${userId}, request ${requestId}`)

  } catch (error) {
    console.error('Export processing error:', error)
    
    await prisma.dataExportRequest.update({
      where: { id: requestId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }).catch(console.error)
    
    throw error
  }
}