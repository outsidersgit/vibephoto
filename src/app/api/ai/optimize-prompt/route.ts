import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth/server-utils'
import { GeminiProvider } from '@/lib/ai/providers/gemini'

/**
 * POST /api/ai/optimize-prompt
 * Optimize user prompts using Gemini 2.5 Flash Lite
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await requireAuthAPI()

    const body = await request.json()
    const { prompt, type = 'image' } = body

    // Validate input
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt é obrigatório' },
        { status: 400 }
      )
    }

    if (prompt.length > 1000) {
      return NextResponse.json(
        { error: 'Prompt muito longo (máximo 1000 caracteres)' },
        { status: 400 }
      )
    }

    if (type !== 'image' && type !== 'video') {
      return NextResponse.json(
        { error: 'Tipo inválido. Use "image" ou "video"' },
        { status: 400 }
      )
    }

    console.log(`✨ Optimizing ${type} prompt for user ${session.user.email}`)

    // Initialize Gemini provider
    const gemini = new GeminiProvider()

    // Optimize the prompt
    const optimizedPrompt = await gemini.optimizePrompt(prompt.trim(), type)

    return NextResponse.json({
      success: true,
      data: {
        original: prompt.trim(),
        optimized: optimizedPrompt,
        type
      }
    })

  } catch (error) {
    console.error('❌ Prompt optimization API error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Erro ao otimizar prompt'

    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
}
