import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { asaas, formatCustomerForAsaas } from '@/lib/payments/asaas'
import { prisma } from '@/lib/db'

// GET - Listar clientes com paginação e filtros
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''

    // Build filters
    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { cpfCnpj: { contains: search.replace(/\D/g, '') } }
      ]
    }

    // Get total count
    const total = await prisma.user.count({ where })

    // Get users with pagination
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        cpfCnpj: true,
        phone: true,
        asaasCustomerId: true,
        plan: true,
        createdAt: true,
        lastLoginAt: true
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: {
        customers: users,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    })

  } catch (error) {
    console.error('Error listing customers:', error)
    return NextResponse.json(
      { error: 'Failed to list customers' },
      { status: 500 }
    )
  }
}

// POST - Criar cliente no Asaas (para usuário atual)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Buscar dados do usuário atual
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        cpfCnpj: true,
        phone: true,
        mobilePhone: true,
        address: true,
        addressNumber: true,
        complement: true,
        province: true,
        city: true,
        state: true,
        postalCode: true,
        asaasCustomerId: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verificar se já tem customer ID
    if (user.asaasCustomerId) {
      return NextResponse.json({
        error: 'Usuário já possui customer ID no Asaas',
        customerId: user.asaasCustomerId
      }, { status: 400 })
    }

    // Validar dados obrigatórios para Asaas
    if (!user.name || !user.cpfCnpj) {
      return NextResponse.json({
        error: 'Nome e CPF/CNPJ são obrigatórios para criar cliente no Asaas'
      }, { status: 400 })
    }

    try {
      // Criar cliente no Asaas
      const customerData = formatCustomerForAsaas({
        name: user.name,
        email: user.email,
        cpfCnpj: user.cpfCnpj,
        phone: user.phone || undefined,
        mobilePhone: user.mobilePhone || undefined,
        address: user.address || undefined,
        addressNumber: user.addressNumber || undefined,
        complement: user.complement || undefined,
        province: user.province || undefined,
        city: user.city || undefined,
        state: user.state || undefined,
        postalCode: user.postalCode || undefined,
        externalReference: user.id
      })

      console.log('Creating Asaas customer with data:', customerData)

      const asaasCustomer = await asaas.createCustomer(customerData)

      // Salvar customer ID no banco
      await prisma.user.update({
        where: { id: user.id },
        data: { asaasCustomerId: asaasCustomer.id }
      })

      // Log da criação
      await prisma.usageLog.create({
        data: {
          userId: user.id,
          action: 'ASAAS_CUSTOMER_CREATED',
          creditsUsed: 0,
          details: {
            asaasCustomerId: asaasCustomer.id,
            customerData: customerData
          }
        }
      })

      return NextResponse.json({
        success: true,
        data: {
          customerId: asaasCustomer.id,
          asaasCustomer,
          message: 'Cliente criado no Asaas com sucesso'
        }
      })

    } catch (asaasError: any) {
      console.error('Error creating Asaas customer:', asaasError)

      // Log do erro
      await prisma.usageLog.create({
        data: {
          userId: user.id,
          action: 'ASAAS_CUSTOMER_CREATION_FAILED',
          creditsUsed: 0,
          details: {
            error: asaasError.message,
            customerData: formatCustomerForAsaas({
              name: user.name,
              email: user.email,
              cpfCnpj: user.cpfCnpj,
              externalReference: user.id
            })
          }
        }
      })

      return NextResponse.json({
        error: 'Falha ao criar cliente no Asaas',
        details: asaasError.message
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Error in customer creation:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}