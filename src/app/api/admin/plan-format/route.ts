import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAPI } from '@/lib/auth'
import { getActivePlanFormat, setActivePlanFormat } from '@/lib/services/system-config-service'

/**
 * GET /api/admin/plan-format
 * Retorna o formato de plano ativo
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminAPI()

    const format = await getActivePlanFormat()

    return NextResponse.json({
      success: true,
      format
    })
  } catch (error: any) {
    console.error('Error fetching plan format:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Erro ao buscar formato de plano' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/plan-format
 * Altera o formato de plano ativo
 *
 * Body: { format: 'TRADITIONAL' | 'MEMBERSHIP' }
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdminAPI()

    const body = await req.json()
    const { format } = body

    // Validar formato
    if (!format || !['TRADITIONAL', 'MEMBERSHIP'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Formato inválido. Use TRADITIONAL ou MEMBERSHIP.' },
        { status: 400 }
      )
    }

    // Alterar formato
    const success = await setActivePlanFormat(format)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Erro ao alterar formato de plano' },
        { status: 500 }
      )
    }

    console.log(`✅ [ADMIN] Formato de plano alterado para: ${format}`)

    return NextResponse.json({
      success: true,
      format,
      message: `Formato alterado para ${format}`
    })
  } catch (error: any) {
    console.error('Error changing plan format:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Acesso negado' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Erro ao alterar formato de plano' },
      { status: 500 }
    )
  }
}
