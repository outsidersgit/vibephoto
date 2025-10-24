import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'Nome é obrigatório').max(50, 'Nome muito longo'),
  lastName: z.string().min(1, 'Sobrenome é obrigatório').max(50, 'Sobrenome muito longo')
})

export async function PUT(request: NextRequest) {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Validar dados do corpo da requisição
    const body = await request.json()
    const result = updateProfileSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: result.error.issues },
        { status: 400 }
      )
    }

    const { firstName, lastName } = result.data
    const fullName = `${firstName} ${lastName}`.trim()

    // Atualizar usuário no banco de dados
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: fullName,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      user: updatedUser
    })

  } catch (error) {
    console.error('Erro ao atualizar perfil:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}