/**
 * API para gerenciamento individual de pacotes de créditos no painel admin
 * GET - Busca pacote por ID
 * PUT - Atualiza pacote
 * DELETE - Remove pacote (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Schema de validação para atualização de pacote (todos campos opcionais)
const updatePackageSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  creditAmount: z.number().int().positive().optional(),
  price: z.number().positive().optional(),
  bonusCredits: z.number().int().nonnegative().optional(),
  validityMonths: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional()
})

// GET /api/admin/credit-packages/[id] - Busca pacote por ID
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
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

    const { id } = await params

    const pkg = await prisma.creditPackage.findUnique({
      where: { id }
    })

    if (!pkg) {
      return NextResponse.json(
        { error: 'Pacote não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      package: pkg
    })
  } catch (error: any) {
    console.error('❌ [ADMIN] Erro ao buscar pacote:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar pacote' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/credit-packages/[id] - Atualiza pacote
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
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

    const { id } = await params
    const body = await request.json()

    // Verificar se pacote existe
    const existing = await prisma.creditPackage.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Pacote não encontrado' },
        { status: 404 }
      )
    }

    // Validar dados (apenas campos enviados)
    const validatedData = updatePackageSchema.parse(body)

    // Construir objeto de atualização apenas com campos modificados
    const updateData: any = {}
    if (validatedData.name !== undefined) updateData.name = validatedData.name
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.creditAmount !== undefined) updateData.creditAmount = validatedData.creditAmount
    if (validatedData.price !== undefined) updateData.price = validatedData.price
    if (validatedData.bonusCredits !== undefined) updateData.bonusCredits = validatedData.bonusCredits
    if (validatedData.validityMonths !== undefined) updateData.validityMonths = validatedData.validityMonths
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive
    if (validatedData.sortOrder !== undefined) updateData.sortOrder = validatedData.sortOrder

    // Se não há campos para atualizar, retornar sucesso sem alterar
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma alteração detectada',
        package: existing
      })
    }

    // Atualizar pacote
    const updated = await prisma.creditPackage.update({
      where: { id },
      data: updateData
    })

    // Invalidar cache
    // await revalidateTag('credit-packages')

    return NextResponse.json({
      success: true,
      message: 'Pacote atualizado com sucesso',
      package: updated
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('❌ [ADMIN] Erro ao atualizar pacote:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar pacote' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/credit-packages/[id] - Remove pacote (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
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

    const { id } = await params

    // Verificar se pacote existe
    const existing = await prisma.creditPackage.findUnique({
      where: { id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Pacote não encontrado' },
        { status: 404 }
      )
    }

    // Soft delete: apenas desativar
    const deleted = await prisma.creditPackage.update({
      where: { id },
      data: { isActive: false }
    })

    // Invalidar cache
    // await revalidateTag('credit-packages')

    return NextResponse.json({
      success: true,
      message: 'Pacote removido com sucesso',
      package: deleted
    })
  } catch (error: any) {
    console.error('❌ [ADMIN] Erro ao remover pacote:', error)
    return NextResponse.json(
      { error: 'Erro ao remover pacote' },
      { status: 500 }
    )
  }
}

