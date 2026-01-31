import { NextResponse } from 'next/server'
import { getActivePlanFormat, setActivePlanFormat } from '@/lib/services/system-config-service'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/plan-format
 * Retorna o formato de plano ativo
 */
export async function GET() {
  try {
    await requireAdmin()

    const format = await getActivePlanFormat()

    return NextResponse.json({ format })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.error('Erro ao buscar formato de plano:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar formato de plano' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/plan-format
 * Altera o formato de plano ativo
 */
export async function POST(request: Request) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { format } = body

    if (!format || (format !== 'TRADITIONAL' && format !== 'MEMBERSHIP')) {
      return NextResponse.json(
        { error: 'Formato inválido. Use TRADITIONAL ou MEMBERSHIP' },
        { status: 400 }
      )
    }

    await setActivePlanFormat(format)

    console.log(`✅ Formato de plano alterado para: ${format}`)

    return NextResponse.json({
      success: true,
      format,
      message: `Formato alterado para ${format} com sucesso`
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.error('Erro ao alterar formato de plano:', error)
    return NextResponse.json(
      { error: 'Erro ao alterar formato de plano' },
      { status: 500 }
    )
  }
}
