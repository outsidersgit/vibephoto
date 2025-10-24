import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Iniciando correção de gerações de pacotes...')

    // Buscar gerações que têm userPackageId mas não packageId
    const orphanGenerations = await prisma.generation.findMany({
      where: {
        packageId: null,
        userPackageId: { not: null },
        status: 'COMPLETED'
      },
      include: {
        userPackage: true
      }
    })

    console.log(`📦 Encontradas ${orphanGenerations.length} gerações órfãs`)

    let fixed = 0

    // Corrigir uma por uma
    for (const generation of orphanGenerations) {
      if (generation.userPackage?.packageId) {
        await prisma.generation.update({
          where: { id: generation.id },
          data: { packageId: generation.userPackage.packageId }
        })
        fixed++
        console.log(`✅ Geração ${generation.id} corrigida`)
      }
    }

    // Verificar resultado
    const stats = await prisma.generation.groupBy({
      by: ['packageId'],
      where: { status: 'COMPLETED' },
      _count: true
    })

    const fotosGeradas = stats.find(s => s.packageId === null)?._count || 0
    const pacotes = stats.filter(s => s.packageId !== null).reduce((sum, s) => sum + s._count, 0)

    return NextResponse.json({
      success: true,
      message: `${fixed} gerações foram movidas para a tab de pacotes`,
      fixed,
      stats: {
        fotosGeradas,
        pacotes,
        total: fotosGeradas + pacotes
      }
    })

  } catch (error) {
    console.error('❌ Erro ao corrigir gerações:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}