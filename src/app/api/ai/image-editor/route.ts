import { NextRequest, NextResponse } from 'next/server'
import { requireAuthAPI } from '@/lib/auth'

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

    const { operation, prompt, images } = await request.json()

    // Validate input
    if (!operation || !prompt || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'Operação, prompt e imagens são obrigatórios' },
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

    // Convert base64 images to FormData
    const formData = new FormData()
    formData.append('prompt', prompt)

    // For single image operations
    if (['edit', 'add', 'remove', 'style'].includes(operation)) {
      const imageFile = await urlToFile(images[0], 'image.jpg')
      formData.append('image', imageFile)
    }
    // For blend operation (multiple images)
    else if (operation === 'blend') {
      for (let index = 0; index < images.length; index++) {
        const imageFile = await urlToFile(images[index], `image_${index}.jpg`)
        formData.append(`image${index}`, imageFile)
      }
    }

    // Route to specific operation handler
    const baseUrl = new URL(request.url).origin
    const operationUrl = `${baseUrl}/api/image-editor/${operation}`

    const response = await fetch(operationUrl, {
      method: 'POST',
      headers: {
        'Cookie': request.headers.get('cookie') || ''
      },
      body: formData
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