import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Primeiro, vamos identificar gerações suspeitas (com múltiplas variações)
    const suspiciousGenerations = await prisma.generation.findMany({
      where: {
        packageId: null,
        status: 'COMPLETED',
        variations: { gt: 1 }, // Múltiplas variações são suspeitas de serem de pacotes
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    console.log(`🔍 Encontradas ${suspiciousGenerations.length} gerações suspeitas (múltiplas variações sem packageId)`)

    // Também verificar gerações que têm userPackageId mas não packageId
    const orphanGenerations = await prisma.generation.findMany({
      where: {
        packageId: null,
        userPackageId: { not: null },
        status: 'COMPLETED'
      },
      include: {
        userPackage: {
          include: {
            package: true
          }
        }
      },
      take: 50,
      orderBy: { createdAt: 'desc' }
    })

    console.log(`🔍 Encontradas ${orphanGenerations.length} gerações órfãs (com userPackageId mas sem packageId)`)

    const toFix = orphanGenerations.filter(gen => gen.userPackage?.packageId)

    if (toFix.length > 0) {
      console.log('🔧 Corrigindo gerações órfãs...')

      // Corrigir uma por uma
      for (const gen of toFix) {
        await prisma.generation.update({
          where: { id: gen.id },
          data: { packageId: gen.userPackage!.packageId }
        })
        console.log(`✅ Geração ${gen.id} movida para pacote ${gen.userPackage!.package.name}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: toFix.length > 0
        ? `${toFix.length} gerações foram movidas para a tab de pacotes`
        : 'Nenhuma correção necessária',
      fixed: toFix.length,
      suspicious: suspiciousGenerations.length,
      orphans: orphanGenerations.length,
      details: {
        fixed: toFix.map(gen => ({
          id: gen.id,
          prompt: gen.prompt.substring(0, 60) + '...',
          packageName: gen.userPackage!.package.name
        })),
        suspicious: suspiciousGenerations.map(gen => ({
          id: gen.id,
          prompt: gen.prompt.substring(0, 60) + '...',
          variations: gen.variations
        }))
      }
    })

  } catch (error) {
    console.error('❌ Erro ao verificar/corrigir gerações:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}