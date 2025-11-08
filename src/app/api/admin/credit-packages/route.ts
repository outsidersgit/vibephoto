/**
 * API para gerenciamento de pacotes de créditos no painel admin
 * GET - Lista todos os pacotes (ativos e inativos)
 * POST - Cria novo pacote
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// Schema de validação para criação de pacote
const createPackageSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  creditAmount: z.number().int().positive(),
  price: z.number().positive(),
  bonusCredits: z.number().int().nonnegative().default(0),
  validityMonths: z.number().int().positive().default(12),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().nonnegative().default(0)
})

// GET /api/admin/credit-packages - Lista todos os pacotes
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const packages = await prisma.creditPackage.findMany({
      orderBy: { sortOrder: 'asc' }
    })

    return NextResponse.json({
      success: true,
      packages
    })
  } catch (error: any) {
    console.error('❌ [ADMIN] Erro ao buscar pacotes de crédito:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar pacotes' },
      { status: 500 }
    )
  }
}

// POST /api/admin/credit-packages - Cria novo pacote
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await request.json()

    // Validar dados
    const validatedData = createPackageSchema.parse(body)

    // Verificar se ID já existe
    const existing = await prisma.creditPackage.findUnique({
      where: { id: validatedData.id }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Um pacote com este ID já existe' },
        { status: 400 }
      )
    }

    // Criar pacote
    const newPackage = await prisma.creditPackage.create({
      data: {
        id: validatedData.id,
        name: validatedData.name,
        description: validatedData.description,
        creditAmount: validatedData.creditAmount,
        price: validatedData.price,
        bonusCredits: validatedData.bonusCredits,
        validityMonths: validatedData.validityMonths,
        isActive: validatedData.isActive,
        sortOrder: validatedData.sortOrder
      }
    })

    // Invalidar cache
    await revalidateTag('credit-packages')

    return NextResponse.json({
      success: true,
      message: 'Pacote criado com sucesso',
      package: newPackage
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('❌ [ADMIN] Erro ao criar pacote de crédito:', error)
    return NextResponse.json(
      { error: 'Erro ao criar pacote' },
      { status: 500 }
    )
  }
}

