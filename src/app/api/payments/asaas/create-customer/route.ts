import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateUserAsaasCustomerId } from '@/lib/db/subscriptions'
import { SubscriptionService } from '@/lib/services/subscription-service'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!session.user.id) {
      return NextResponse.json(
        { error: 'User ID not found in session' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, email, cpfCnpj, phone, address } = body

    // Create or get existing customer in Asaas (prevents duplicates)
    const subscriptionService = new SubscriptionService()

    const result = await subscriptionService.getOrCreateAsaasCustomer(
      {
        name: name || session.user.name || '',
        email: email || session.user.email || '',
        cpfCnpj,
        phone,
        mobilePhone: phone,
        address: address?.address,
        addressNumber: address?.addressNumber,
        complement: address?.complement,
        province: address?.province,
        city: address?.city,
        state: address?.state,
        postalCode: address?.postalCode
      },
      session.user.id
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Update user with Asaas customer ID only if it's different or not set
    const currentUser = session.user as any
    if (!currentUser.asaasCustomerId || currentUser.asaasCustomerId !== result.customerId) {
      await updateUserAsaasCustomerId(session.user.id, result.customerId!)
    }

    return NextResponse.json({
      success: true,
      customerId: result.customerId,
      method: result.method, // 'EXISTING' ou 'CREATED'
      message: result.method === 'EXISTING'
        ? 'Cliente já existe no Asaas'
        : 'Cliente criado com sucesso no Asaas'
    })

  } catch (error: any) {
    console.error('Error creating Asaas customer:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create customer' },
      { status: 500 }
    )
  }
}