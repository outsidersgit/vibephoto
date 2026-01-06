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
  walletId: z.string().regex(walletIdRegex, 'Wallet ID inválido (formato UUID esperado)').optional()
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

    // Verificar se o usuário existe e tem perfil de influencer
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: { influencerProfile: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    if (!user.influencerProfile) {
      return NextResponse.json(
        { error: 'Este usuário não é um influencer' },
        { status: 400 }
      )
    }

    const data = parsed.data

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
