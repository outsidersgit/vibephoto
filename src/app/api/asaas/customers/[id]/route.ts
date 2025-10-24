import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { asaas, formatCustomerForAsaas } from '@/lib/payments/asaas'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: {
    id: string
  }
}

// GET - Buscar cliente específico
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Buscar no banco local
    const user = await prisma.user.findUnique({
      where: { id },
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
        asaasCustomerId: true,
        plan: true,
        createdAt: true,
        lastLoginAt: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    let asaasCustomer = null

    // Se tem customer ID, buscar dados no Asaas
    if (user.asaasCustomerId) {
      try {
        asaasCustomer = await asaas.getCustomer(user.asaasCustomerId)
      } catch (error) {
        console.error('Error fetching Asaas customer:', error)
        // Continue sem dados do Asaas se falhar
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        localData: user,
        asaasData: asaasCustomer
      }
    })

  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar cliente
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()

    // Verificar se o usuário pode atualizar este cliente
    // (para segurança, usuários só podem atualizar a si mesmos, a menos que sejam admin)
    if (id !== session.user.id) {
      // TODO: Implementar verificação de admin
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const {
      name,
      cpfCnpj,
      phone,
      mobilePhone,
      address,
      addressNumber,
      complement,
      province,
      city,
      state,
      postalCode
    } = body

    // Buscar dados atuais
    const user = await prisma.user.findUnique({
      where: { id },
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
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Preparar dados para atualização local
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (cpfCnpj !== undefined) updateData.cpfCnpj = cpfCnpj.replace(/\D/g, '')
    if (phone !== undefined) updateData.phone = phone.replace(/\D/g, '')
    if (mobilePhone !== undefined) updateData.mobilePhone = mobilePhone.replace(/\D/g, '')
    if (address !== undefined) updateData.address = address
    if (addressNumber !== undefined) updateData.addressNumber = addressNumber
    if (complement !== undefined) updateData.complement = complement
    if (province !== undefined) updateData.province = province
    if (city !== undefined) updateData.city = city
    if (state !== undefined) updateData.state = state?.toUpperCase()
    if (postalCode !== undefined) updateData.postalCode = postalCode.replace(/\D/g, '')

    // Atualizar no banco local
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
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

    let asaasUpdateResult = null

    // Se tem customer ID no Asaas, atualizar também lá
    if (user.asaasCustomerId) {
      try {
        const customerData = formatCustomerForAsaas({
          name: updatedUser.name || '',
          email: updatedUser.email || '',
          cpfCnpj: updatedUser.cpfCnpj || '',
          phone: updatedUser.phone || undefined,
          mobilePhone: updatedUser.mobilePhone || undefined,
          address: updatedUser.address || undefined,
          addressNumber: updatedUser.addressNumber || undefined,
          complement: updatedUser.complement || undefined,
          province: updatedUser.province || undefined,
          city: updatedUser.city || undefined,
          state: updatedUser.state || undefined,
          postalCode: updatedUser.postalCode || undefined,
          externalReference: updatedUser.id
        })

        asaasUpdateResult = await asaas.updateCustomer(user.asaasCustomerId, customerData)

        // Log da atualização no Asaas
        await prisma.usageLog.create({
          data: {
            userId: id,
            action: 'ASAAS_CUSTOMER_UPDATED',
            creditsUsed: 0,
            details: {
              asaasCustomerId: user.asaasCustomerId,
              updatedFields: Object.keys(updateData),
              customerData
            }
          }
        })

      } catch (asaasError: any) {
        console.error('Error updating Asaas customer:', asaasError)

        // Log do erro mas não falha a operação local
        await prisma.usageLog.create({
          data: {
            userId: id,
            action: 'ASAAS_CUSTOMER_UPDATE_FAILED',
            creditsUsed: 0,
            details: {
              error: asaasError.message,
              asaasCustomerId: user.asaasCustomerId
            }
          }
        })

        // Continue mas retorne aviso sobre falha no Asaas
        return NextResponse.json({
          success: true,
          data: updatedUser,
          warning: 'Dados atualizados localmente, mas falha ao sincronizar com Asaas',
          asaasError: asaasError.message
        })
      }
    }

    // Log da atualização local
    await prisma.usageLog.create({
      data: {
        userId: id,
        action: 'CUSTOMER_DATA_UPDATED',
        creditsUsed: 0,
        details: {
          updatedFields: Object.keys(updateData),
          asaasSync: !!asaasUpdateResult
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedUser,
      asaasData: asaasUpdateResult,
      message: 'Cliente atualizado com sucesso'
    })

  } catch (error: any) {
    console.error('Error updating customer:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// DELETE - Deletar cliente (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Verificar permissões (apenas admin deve poder deletar)
    // TODO: Implementar verificação de admin
    if (id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        asaasCustomerId: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Por enquanto, não deletar realmente o usuário, apenas marcar como inativo
    // e remover dados sensíveis
    const deactivatedUser = await prisma.user.update({
      where: { id },
      data: {
        // Limpar dados sensíveis
        cpfCnpj: null,
        phone: null,
        mobilePhone: null,
        address: null,
        addressNumber: null,
        complement: null,
        province: null,
        city: null,
        state: null,
        postalCode: null,
        asaasCustomerId: null,
        // Marcar email como deletado
        email: `deleted_${Date.now()}@deleted.com`,
        name: 'Usuário Removido'
      }
    })

    // Log da remoção
    await prisma.usageLog.create({
      data: {
        userId: id,
        action: 'CUSTOMER_DELETED',
        creditsUsed: 0,
        details: {
          originalEmail: user.email,
          originalName: user.name,
          hadAsaasCustomerId: !!user.asaasCustomerId,
          deletedAt: new Date().toISOString()
        }
      }
    })

    // TODO: Se necessário, também remover do Asaas
    // Mas geralmente é melhor manter o histórico lá

    return NextResponse.json({
      success: true,
      message: 'Cliente removido com sucesso'
    })

  } catch (error: any) {
    console.error('Error deleting customer:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}