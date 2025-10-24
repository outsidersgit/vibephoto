import { NextRequest, NextResponse } from 'next/server'
import { AutoStorageService } from '@/lib/services/auto-storage-service'

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Auto storage start API called')
    
    // Only allow in development mode for safety
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { success: false, error: 'Auto storage service only available in development mode' },
        { status: 403 }
      )
    }

    // Start the auto storage service
    const service = AutoStorageService.getInstance()
    service.startMonitoring()

    return NextResponse.json({ 
      success: true, 
      message: 'Auto storage service started successfully' 
    })

  } catch (error) {
    console.error('❌ Error starting auto storage service:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}