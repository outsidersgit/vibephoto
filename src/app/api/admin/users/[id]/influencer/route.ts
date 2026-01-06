import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

async function ensureAdmin() {
  const session = await getServerSession(authOptions)
  const role = String(((session?.user as any)?.role) || '').toUpperCase()
  if (!session || role !== 'ADMIN') return null
  return session
}

const walletIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const UpdateInfluencerSchema = z.object({
  createInfluencer: z.boolean().optional(),
  walletId: z.string().regex(walletIdRegex, 'Wallet ID inválido (formato UUID esperado)').optional(),
  couponCode: z.string().optional(),
  commissionPercentage: z.number().min(0).max(100).optional(),
  commissionFixedValue: z.number().min(0).optional()
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ok = await ensureAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await request.json()
    const parsed = UpdateInfluencerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: { influencerProfile: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const data = parsed.data

    // CRIAR NOVO INFLUENCER
    if (data.createInfluencer && !user.influencerProfile) {
      if (!data.walletId || !data.couponCode) {
        return NextResponse.json(
          { error: 'Wallet ID e Código do Cupom são obrigatórios para criar influencer' },
          { status: 400 }
        )
      }

      const normalizedWallet = data.walletId.trim().toLowerCase()
      const normalizedCoupon = data.couponCode.trim().toUpperCase()

      // Verificar duplicação
      const [existingWallet, existingCoupon] = await Promise.all([
        prisma.influencer.findUnique({ where: { asaasWalletId: normalizedWallet } }),
        prisma.influencer.findUnique({ where: { couponCode: normalizedCoupon } })
      ])

      if (existingWallet) {
        return NextResponse.json(
          { error: 'Este Wallet ID já está vinculado a outro influenciador' },
          { status: 409 }
        )
      }

      if (existingCoupon) {
        return NextResponse.json(
          { error: 'Este código de cupom já está em uso' },
          { status: 409 }
        )
      }

      // Validar comissão
      if (data.commissionPercentage && data.commissionFixedValue) {
        return NextResponse.json(
          { error: 'Escolha apenas um tipo de comissão (percentual ou valor fixo)' },
          { status: 400 }
        )
      }

      if (!data.commissionPercentage && !data.commissionFixedValue) {
        return NextResponse.json(
          { error: 'Informe a comissão (percentual ou valor fixo)' },
          { status: 400 }
        )
      }

      // Criar influencer
      const newInfluencer = await prisma.influencer.create({
        data: {
          userId: user.id,
          couponCode: normalizedCoupon,
          asaasWalletId: normalizedWallet,
          commissionPercentage: data.commissionPercentage || 0,
          commissionFixedValue: data.commissionFixedValue || null
        }
      })

      console.log(`✅ [Admin] Novo influencer criado: ${normalizedCoupon} para usuário ${user.email}`)

      return NextResponse.json({
        success: true,
        influencer: {
          id: newInfluencer.id,
          couponCode: newInfluencer.couponCode,
          asaasWalletId: newInfluencer.asaasWalletId,
          commissionPercentage: newInfluencer.commissionPercentage,
          commissionFixedValue: newInfluencer.commissionFixedValue
        }
      })
    }

    // ATUALIZAR INFLUENCER EXISTENTE
    if (!user.influencerProfile) {
      return NextResponse.json(
        { error: 'Este usuário não é um influencer' },
        { status: 400 }
      )
    }

    // Se está atualizando o walletId, verificar se já não está em uso
    if (data.walletId) {
      const normalizedWallet = data.walletId.trim().toLowerCase()

      const existingWallet = await prisma.influencer.findUnique({
        where: { asaasWalletId: normalizedWallet }
      })

      if (existingWallet && existingWallet.id !== user.influencerProfile.id) {
        return NextResponse.json(
          { error: 'Este Wallet ID já está vinculado a outro influenciador' },
          { status: 409 }
        )
      }

      // Atualizar o wallet ID
      await prisma.influencer.update({
        where: { id: user.influencerProfile.id },
        data: { asaasWalletId: normalizedWallet }
      })

      console.log(`✅ [Admin] Wallet ID atualizado para influencer ${user.influencerProfile.couponCode}`)
    }

    // Retornar dados atualizados
    const updated = await prisma.influencer.findUnique({
      where: { id: user.influencerProfile.id },
      select: {
        id: true,
        couponCode: true,
        asaasWalletId: true,
        commissionPercentage: true,
        commissionFixedValue: true
      }
    })

    return NextResponse.json({ influencer: updated })
  } catch (error: any) {
    console.error('❌ [Admin Update Influencer] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar influencer' },
      { status: 500 }
    )
  }
}
