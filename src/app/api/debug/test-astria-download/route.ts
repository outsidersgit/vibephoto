import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Test downloading from a recent Astria URL
    const testUrl = 'https://mp.astria.ai/rxhduxk6yrsv268uslr5iw4qqdjc'

    console.log('🧪 Testing Astria URL download...')
    console.log('Test URL:', testUrl)

    // Test 1: Simple fetch without authentication
    console.log('📥 Test 1: Simple fetch...')
    let simpleTest
    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'VibePhoto/1.0',
          'Accept': 'image/*'
        }
      })

      simpleTest = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
        headers: Object.fromEntries(response.headers.entries())
      }

      if (response.ok) {
        const buffer = await response.arrayBuffer()
        simpleTest.downloadedBytes = buffer.byteLength
        console.log('✅ Downloaded successfully:', simpleTest.downloadedBytes, 'bytes')
      } else {
        const text = await response.text()
        simpleTest.errorBody = text
        console.error('❌ Download failed:', response.status, text)
      }
    } catch (error) {
      simpleTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : null
      }
      console.error('❌ Fetch error:', error)
    }

    // Test 2: Fetch with Astria API key (if provided)
    console.log('📥 Test 2: Fetch with Astria authentication...')
    let authTest
    const astriaApiKey = process.env.ASTRIA_API_KEY

    if (astriaApiKey) {
      try {
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'VibePhoto/1.0',
            'Accept': 'image/*',
            'Authorization': `Bearer ${astriaApiKey}`
          }
        })

        authTest = {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type')
        }

        if (response.ok) {
          const buffer = await response.arrayBuffer()
          authTest.downloadedBytes = buffer.byteLength
          console.log('✅ Downloaded with auth:', authTest.downloadedBytes, 'bytes')
        }
      } catch (error) {
        authTest = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        console.error('❌ Auth fetch error:', error)
      }
    } else {
      authTest = {
        success: false,
        error: 'ASTRIA_API_KEY not configured'
      }
    }

    // Test 3: Check if URL is expired
    console.log('🕐 Test 3: Checking URL expiration...')
    const urlExpirationTest = {
      url: testUrl,
      message: 'Astria URLs may have expiration. If simple fetch fails with 403/404, URL might be expired.'
    }

    return NextResponse.json({
      success: true,
      testUrl,
      tests: {
        simpleDownload: simpleTest,
        authenticatedDownload: authTest,
        urlExpiration: urlExpirationTest
      },
      diagnosis: {
        canDownload: simpleTest.success || authTest.success,
        needsAuthentication: !simpleTest.success && authTest.success,
        urlExpired: !simpleTest.success && !authTest.success,
        recommendation: simpleTest.success
          ? '✅ Downloads working - issue might be elsewhere'
          : authTest.success
            ? '⚠️ Needs authentication - add ASTRIA_API_KEY to download headers'
            : '❌ URLs expired or blocked - need immediate S3 upload after generation'
      }
    })
  } catch (error) {
    console.error('❌ Astria download test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : null
    }, { status: 500 })
  }
}
