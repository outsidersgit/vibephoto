import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Route Handler leve para verificação rápida de autenticação
 * Usado pelo script inline para verificar sessão antes do React hidratar
 * 
 * Referência: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar token JWT (rápido, sem consulta ao banco)
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    })

    if (!token || !token.sub) {
      return NextResponse.json(
        { authenticated: false },
        { 
          status: 401,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache'
          }
        }
      )
    }

    return NextResponse.json(
      { 
        authenticated: true,
        userId: token.sub 
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      }
    )
  } catch (error) {
    console.error('Error verifying auth:', error)
    return NextResponse.json(
      { authenticated: false },
      { 
        status: 401,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache'
        }
      }
    )
  }
}

