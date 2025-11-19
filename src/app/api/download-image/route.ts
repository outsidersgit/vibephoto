import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, filename, videoUrl } = await request.json()

    // Support both image and video downloads
    const url = imageUrl || videoUrl
    const isVideo = !!videoUrl

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Fetch the media from the external URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || (isVideo ? 'video/mp4' : 'image/jpeg')
    const buffer = await response.arrayBuffer()

    // Determine default filename based on content type
    const defaultFilename = filename || (isVideo ? 'download.mp4' : 'download.jpg')

    // Return the media as a blob with proper headers for download
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${defaultFilename}"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    })

  } catch (error) {
    console.error('Download proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to download media' },
      { status: 500 }
    )
  }
}