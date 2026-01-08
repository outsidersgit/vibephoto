import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'

// CRITICAL: Configurações para suportar múltiplas imagens em base64
// Nano Banana Pro suporta até 14 imagens, cada uma com até 10MB
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Aumentar limite de body para 100MB (App Router)
export const maxDuration = 300 // 5 minutos timeout

async function urlToFile(imageInput: string, filename: string): Promise<File> {
  try {
    // Validate input
    if (!imageInput || typeof imageInput !== 'string') {
      throw new Error('Invalid image input provided')
    }

    // Handle data URLs
    if (imageInput.startsWith('data:')) {
      console.log('Converting data URL to file...')

      const arr = imageInput.split(',')
      if (arr.length !== 2) {
        throw new Error('Invalid data URL format - missing comma separator')
      }

      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
      const base64Data = arr[1]

      // Validate base64 string
      if (!base64Data || base64Data.length === 0) {
        throw new Error('Empty base64 data')
      }

      // Clean base64 string (remove whitespace and invalid characters)
      const cleanBase64 = base64Data.replace(/[^A-Za-z0-9+/=]/g, '')

      // Validate base64 format
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64)) {
        throw new Error('Invalid base64 characters')
      }

      const bstr = atob(cleanBase64)
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }
      return new File([u8arr], filename, { type: mime })
    }

    // Handle regular URLs - fetch and convert to file
    if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      console.log('Fetching image from URL:', imageInput.substring(0, 100) + '...')

      const response = await fetch(imageInput)
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()
      const mimeType = blob.type || 'image/jpeg'

      return new File([blob], filename, { type: mimeType })
    }

    throw new Error('Invalid image input - must be data URL or HTTP(S) URL')

  } catch (error) {
    console.error('urlToFile error:', error)
    throw new Error(`Failed to convert image to file: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthAPI()
    const userId = session.user.id

    // Parse JSON body (images are now pre-uploaded to R2, only URLs sent)
    const body = await request.json()

    const operation = body.operation as string
    const prompt = body.prompt as string
    const aspectRatio = body.aspectRatio as string
    const resolution = body.resolution as string
    const imageUrls = (body.imageUrls || []) as string[]

    // Validate input - prompt is required, images can be empty for generation from scratch
    if (!operation || !prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Operação e prompt são obrigatórios' },
        { status: 400 }
      )
    }

    // Validate operation type
    const validOperations = ['edit', 'add', 'remove', 'style', 'blend']
    if (!validOperations.includes(operation)) {
      return NextResponse.json(
        { error: 'Operação inválida' },
        { status: 400 }
      )
    }

    // Validate images based on operation
    // For blend, we need at least 2 images
    if (operation === 'blend' && imageUrls.length < 2) {
      return NextResponse.json(
        { error: 'Operação blend requer pelo menos 2 imagens' },
        { status: 400 }
      )
    }

    // For other operations, images can be empty (generation from scratch) or have up to 14 images (edit)
    if (['edit', 'add', 'remove', 'style'].includes(operation) && imageUrls.length > 14) {
      return NextResponse.json(
        { error: 'Operação requer no máximo 14 imagens' },
        { status: 400 }
      )
    }

    // Create FormData with image URLs for forwarding to operation handler
    const forwardFormData = new FormData()
    forwardFormData.append('prompt', prompt)
    if (aspectRatio) {
      forwardFormData.append('aspectRatio', aspectRatio)
    }
    if (resolution) {
      forwardFormData.append('resolution', resolution) // 'standard' ou '4k'
    }

    // Add image URLs to FormData
    if (imageUrls.length > 0) {
      if (imageUrls.length > 1) {
        // Multiple images
        imageUrls.forEach((url, index) => {
          forwardFormData.append(`imageUrl${index}`, url)
        })
        forwardFormData.append('multipleImages', 'true')
        forwardFormData.append('imageCount', imageUrls.length.toString())
      } else {
        // Single image
        forwardFormData.append('imageUrl', imageUrls[0])
      }
    }
    // For generation from scratch (no images), no image URL is appended

    // Route to specific operation handler
    const baseUrl = new URL(request.url).origin
    const operationUrl = `${baseUrl}/api/image-editor/${operation}`

    const response = await fetch(operationUrl, {
      method: 'POST',
      headers: {
        'Cookie': request.headers.get('cookie') || ''
      },
      body: forwardFormData
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error(`Image editor operation ${operation} failed:`, errorData)

      try {
        const jsonError = JSON.parse(errorData)
        return NextResponse.json(jsonError, { status: response.status })
      } catch {
        return NextResponse.json(
          { error: `Erro na operação ${operation}: ${response.statusText}` },
          { status: response.status }
        )
      }
    }

    const result = await response.json()
    return NextResponse.json({
      success: true,
      resultUrl: result.data?.resultImage || result.resultImage,
      ...result
    })

  } catch (error) {
    console.error('Image editor API error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}