import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * API endpoint para receber logs de erros do client-side
 *
 * Útil para capturar erros que acontecem apenas em navegadores específicos
 * ou em dispositivos específicos dos usuários
 *
 * POST /api/logs/client-error
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    const body = await request.json()

    const {
      errorMessage,
      errorStack,
      errorType,
      userAgent,
      url,
      componentStack,
      additionalData,
      timestamp
    } = body

    // Log no console do servidor
    console.error('🔴 [CLIENT_ERROR] ===== CLIENT-SIDE ERROR RECEIVED =====')
    console.error('🔴 User ID:', session?.user?.id || 'anonymous')
    console.error('🔴 User Email:', session?.user?.email || 'anonymous')
    console.error('🔴 Error Type:', errorType)
    console.error('🔴 Error Message:', errorMessage)
    console.error('🔴 URL:', url)
    console.error('🔴 User Agent:', userAgent)
    console.error('🔴 Timestamp:', timestamp || new Date().toISOString())

    if (errorStack) {
      console.error('🔴 Stack Trace:', errorStack)
    }

    if (componentStack) {
      console.error('🔴 Component Stack:', componentStack)
    }

    if (additionalData) {
      console.error('🔴 Additional Data:', JSON.stringify(additionalData, null, 2))
    }
    console.error('🔴 ================================================')

    // Salvar no banco de dados
    try {
      await prisma.systemLog.create({
        data: {
          userId: session?.user?.id || null,
          action: 'CLIENT_ERROR',
          status: 'ERROR',
          details: {
            errorType: errorType || 'UnknownError',
            errorMessage,
            errorStack,
            url,
            userAgent,
            componentStack,
            additionalData,
            timestamp: timestamp || new Date().toISOString(),
            userEmail: session?.user?.email || 'anonymous',
            browser: detectBrowser(userAgent),
            device: detectDevice(userAgent)
          },
          ipAddress: request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown'
        }
      })
    } catch (dbError) {
      console.error('❌ Failed to save client error to database:', dbError)
      // Não falhar a request mesmo se o banco falhar
    }

    return NextResponse.json({
      success: true,
      message: 'Error logged successfully'
    })

  } catch (error) {
    console.error('❌ Error processing client error log:', error)

    // Mesmo em caso de erro, retornar 200 para não afetar a experiência do usuário
    return NextResponse.json({
      success: false,
      message: 'Failed to log error, but request acknowledged'
    })
  }
}

/**
 * Detecta navegador do user agent
 */
function detectBrowser(userAgent: string): string {
  if (!userAgent) return 'unknown'

  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    return 'Safari'
  } else if (userAgent.includes('Chrome') && !userAgent.includes('Edge')) {
    return 'Chrome'
  } else if (userAgent.includes('Firefox')) {
    return 'Firefox'
  } else if (userAgent.includes('Edge')) {
    return 'Edge'
  } else {
    return 'other'
  }
}

/**
 * Detecta tipo de device do user agent
 */
function detectDevice(userAgent: string): string {
  if (!userAgent) return 'unknown'

  if (userAgent.includes('iPhone')) {
    return 'iPhone'
  } else if (userAgent.includes('iPad')) {
    return 'iPad'
  } else if (userAgent.includes('Android')) {
    return 'Android'
  } else if (userAgent.includes('Mobile')) {
    return 'mobile'
  } else {
    return 'desktop'
  }
}
