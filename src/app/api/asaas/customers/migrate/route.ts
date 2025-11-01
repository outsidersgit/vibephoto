import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { asaas, formatCustomerForAsaas, validateCustomerData } from '@/lib/payments/asaas'
import { prisma } from '@/lib/prisma'

/**
 * Endpoint para migrar usuários existentes (que já têm plano mas não têm asaasCustomerId)
 * Este endpoint cria o cliente no Asaas e vincula ao usuário existente
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
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
        asaasCustomerId: true,
        plan: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Validar: usuário já tem customer ID
    if (user.asaasCustomerId) {
      return NextResponse.json({
        success: false,
        error: 'Usuário já possui customer ID no Asaas',
        customerId: user.asaasCustomerId,
        message: 'Este usuário já está vinculado a um cliente Asaas'
      }, { status: 400 })
    }

    // Validar: dados obrigatórios
    if (!user.name || !user.cpfCnpj) {
      return NextResponse.json({
        success: false,
        error: 'Dados incompletos',
        message: 'Nome e CPF/CNPJ são obrigatórios para criar cliente no Asaas',
        missingFields: {
          name: !user.name,
          cpfCnpj: !user.cpfCnpj
        },
        action: 'COMPLETE_PROFILE',
        redirectTo: '/profile'
      }, { status: 400 })
    }

    try {
      // 1. Verificar se já existe no Asaas por email
      console.log('Verificando se cliente já existe no Asaas...')
      const existingByEmail = await asaas.getCustomers({
        email: user.email
      })

      if (existingByEmail?.data && existingByEmail.data.length > 0) {
        const existing = existingByEmail.data[0]

        console.log('Cliente encontrado no Asaas:', existing.id)

        // Salvar ID existente no banco
        await prisma.user.update({
          where: { id: user.id },
          data: { asaasCustomerId: existing.id }
        })

        // Log da vinculação
        await prisma.usageLog.create({
          data: {
            userId: user.id,
            action: 'ASAAS_CUSTOMER_LINKED',
            creditsUsed: 0,
            details: {
              asaasCustomerId: existing.id,
              method: 'FOUND_BY_EMAIL',
              customerData: {
                name: existing.name,
                email: existing.email
              }
            }
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Cliente já existia no Asaas. ID vinculado com sucesso!',
          customerId: existing.id,
          method: 'LINKED_EXISTING',
          customer: {
            id: existing.id,
            name: existing.name,
            email: existing.email
          }
        })
      }

      // 2. Se não existe, verificar por CPF/CNPJ
      const existingByCpf = await asaas.getCustomers({
        cpfCnpj: user.cpfCnpj.replace(/\D/g, '')
      })

      if (existingByCpf?.data && existingByCpf.data.length > 0) {
        const existing = existingByCpf.data[0]

        console.log('Cliente encontrado no Asaas por CPF:', existing.id)

        // Salvar ID existente
        await prisma.user.update({
          where: { id: user.id },
          data: { asaasCustomerId: existing.id }
        })

        // Log da vinculação
        await prisma.usageLog.create({
          data: {
            userId: user.id,
            action: 'ASAAS_CUSTOMER_LINKED',
            creditsUsed: 0,
            details: {
              asaasCustomerId: existing.id,
              method: 'FOUND_BY_CPF',
              customerData: {
                name: existing.name,
                cpfCnpj: existing.cpfCnpj
              }
            }
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Cliente já existia no Asaas (encontrado por CPF). ID vinculado com sucesso!',
          customerId: existing.id,
          method: 'LINKED_EXISTING_BY_CPF',
          customer: {
            id: existing.id,
            name: existing.name,
            email: existing.email,
            cpfCnpj: existing.cpfCnpj
          }
        })
      }

      // 3. Cliente não existe, criar novo
      console.log('Cliente não encontrado, criando novo no Asaas...')

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

      // Validar dados antes de enviar
      const validation = validateCustomerData(customerData)
      if (!validation.isValid) {
        return NextResponse.json({
          success: false,
          error: 'Dados inválidos',
          message: validation.errors.join(', '),
          validationErrors: validation.errors
        }, { status: 400 })
      }

      console.log('Criando cliente no Asaas com dados:', customerData)

      const asaasCustomer = await asaas.createCustomer(customerData)

      console.log('Cliente criado com sucesso:', asaasCustomer.id)

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
            customerData: customerData,
            userPlan: user.plan
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Cliente criado no Asaas com sucesso!',
        customerId: asaasCustomer.id,
        method: 'CREATED_NEW',
        customer: {
          id: asaasCustomer.id,
          name: asaasCustomer.name,
          email: asaasCustomer.email,
          cpfCnpj: asaasCustomer.cpfCnpj
        }
      })

    } catch (asaasError: any) {
      console.error('Erro ao criar/buscar cliente no Asaas:', asaasError)

      // Log do erro
      await prisma.usageLog.create({
        data: {
          userId: user.id,
          action: 'ASAAS_CUSTOMER_MIGRATION_FAILED',
          creditsUsed: 0,
          details: {
            error: asaasError.message,
            stack: asaasError.stack,
            userData: {
              name: user.name,
              email: user.email,
              hasCpf: !!user.cpfCnpj
            }
          }
        }
      })

      return NextResponse.json({
        success: false,
        error: 'Falha ao criar/vincular cliente no Asaas',
        message: asaasError.message || 'Erro desconhecido',
        details: asaasError.message
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Erro na migração de cliente:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    }, { status: 500 })
  }
}