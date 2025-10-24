import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface ConsentPreferences {
  essential: boolean
  functional: boolean
  analytics: boolean
  marketing: boolean
}

interface ConsentRequestBody {
  preferences: ConsentPreferences
  timestamp: string
  version: string
}

// POST /api/consent - Save user consent preferences
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const body: ConsentRequestBody = await request.json()

    // Validate request body
    if (!body.preferences || !body.timestamp || !body.version) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get IP address for logging
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(/, /)[0] : request.headers.get('x-real-ip')

    // Create consent record
    const consentData = {
      userId: session?.user?.id || null,
      ipAddress: ip || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      essential: body.preferences.essential,
      functional: body.preferences.functional,
      analytics: body.preferences.analytics,
      marketing: body.preferences.marketing,
      version: body.version,
      consentedAt: new Date(body.timestamp),
    }

    // Save to database (we'll create this table in the next step)
    const consent = await prisma.userConsent.create({
      data: consentData
    })

    // Log the consent for audit purposes
    console.log('Consent saved:', {
      id: consent.id,
      userId: consent.userId,
      preferences: body.preferences,
      timestamp: body.timestamp
    })

    return NextResponse.json({
      success: true,
      message: 'Consent preferences saved successfully'
    })

  } catch (error) {
    console.error('Error saving consent:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/consent - Get user consent preferences
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Get latest consent record for user
    const consent = await prisma.userConsent.findFirst({
      where: {
        userId: session.user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (!consent) {
      return NextResponse.json({
        hasConsent: false,
        preferences: null
      })
    }

    return NextResponse.json({
      hasConsent: true,
      preferences: {
        essential: consent.essential,
        functional: consent.functional,
        analytics: consent.analytics,
        marketing: consent.marketing
      },
      version: consent.version,
      timestamp: consent.consentedAt.toISOString()
    })

  } catch (error) {
    console.error('Error fetching consent:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/consent - Revoke consent (LGPD right to withdraw consent)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Create a revocation record
    await prisma.userConsent.create({
      data: {
        userId: session.user.id,
        ipAddress: request.headers.get('x-forwarded-for')?.split(', ')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        essential: true,  // Essential cookies always remain
        functional: false,
        analytics: false,
        marketing: false,
        version: '1.0',
        consentedAt: new Date(),
        isRevocation: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Consent revoked successfully'
    })

  } catch (error) {
    console.error('Error revoking consent:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}