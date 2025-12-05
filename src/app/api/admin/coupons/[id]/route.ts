import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/coupons/[id]
 * Busca detalhes de um cupom específico
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

    const coupon = await prisma.discountCoupon.findUnique({
      where: { id: params.id },
      include: {
        influencer: {
          select: {
            id: true,
            couponCode: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            usages: true
          }
        }
      }
    })

    if (!coupon) {
      return NextResponse.json(
        { error: 'Cupom não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ coupon })

  } catch (error: any) {
    console.error('Error fetching coupon:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar cupom' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/coupons/[id]
 * Atualiza um cupom existente
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

    const body = await req.json()
    const {
      code,
      type,
      discountType,
      discountValue,
      influencerId,
      applicablePlans,
      isActive,
      validFrom,
      validUntil,
      maxUses,
      maxUsesPerUser
    } = body

    // Verificar se cupom existe
    const existing = await prisma.discountCoupon.findUnique({
      where: { id: params.id }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Cupom não encontrado' },
        { status: 404 }
      )
    }

    // Se código foi alterado, verificar se novo código já existe
    if (code && code !== existing.code) {
      const normalizedCode = code.trim().toUpperCase()
      const codeExists = await prisma.discountCoupon.findUnique({
        where: { code: normalizedCode }
      })

      if (codeExists) {
        return NextResponse.json(
          { error: 'Código de cupom já existe' },
          { status: 400 }
        )
      }
    }

    // Validar tipo HYBRID tem influencer
    if (type === 'HYBRID' && !influencerId) {
      return NextResponse.json(
        { error: 'Cupom HÍBRIDO requer um influenciador vinculado' },
        { status: 400 }
      )
    }

    // Atualizar cupom
    const coupon = await prisma.discountCoupon.update({
      where: { id: params.id },
      data: {
        code: code ? code.trim().toUpperCase() : undefined,
        type: type || undefined,
        discountType: discountType || undefined,
        discountValue: discountValue !== undefined ? parseFloat(discountValue) : undefined,
        influencerId: influencerId !== undefined ? (influencerId || null) : undefined,
        applicablePlans: applicablePlans !== undefined ? applicablePlans : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validUntil: validUntil !== undefined ? (validUntil ? new Date(validUntil) : null) : undefined,
        maxUses: maxUses !== undefined ? (maxUses ? parseInt(maxUses) : null) : undefined,
        maxUsesPerUser: maxUsesPerUser !== undefined ? (maxUsesPerUser ? parseInt(maxUsesPerUser) : 1) : undefined
      },
      include: {
        influencer: {
          select: {
            id: true,
            couponCode: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({ coupon })

  } catch (error: any) {
    console.error('Error updating coupon:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar cupom' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/coupons/[id]
 * Deleta um cupom
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

    // Verificar se cupom existe
    const existing = await prisma.discountCoupon.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            usages: true
          }
        }
      }
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Cupom não encontrado' },
        { status: 404 }
      )
    }

    // Se já foi usado, apenas desativar ao invés de deletar
    if (existing._count.usages > 0) {
      await prisma.discountCoupon.update({
        where: { id: params.id },
        data: { isActive: false }
      })

      return NextResponse.json({
        message: 'Cupom desativado (possui histórico de uso)',
        deactivated: true
      })
    }

    // Deletar cupom se nunca foi usado
    await prisma.discountCoupon.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      message: 'Cupom deletado com sucesso',
      deleted: true
    })

  } catch (error: any) {
    console.error('Error deleting coupon:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao deletar cupom' },
      { status: 500 }
    )
  }
}
