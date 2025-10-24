import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { asaas, formatCustomerForAsaas } from '@/lib/payments/asaas'
import { prisma } from '@/lib/prisma'

/**
 * Endpoint temporário para setup rápido - adiciona CPF e cria cliente Asaas
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { cpfCnpj } = await request.json()

    if (!cpfCnpj) {
      return NextResponse.json({
        error: 'CPF/CNPJ é obrigatório',
        message: 'Envie o CPF no formato: { "cpfCnpj": "02261410123" }'
      }, { status: 400 })
    }

    console.log('🔧 Quick setup iniciado para usuário:', session.user.id)

    // 1. Buscar usuário atual
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        asaasCustomerId: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // 2. Se já tem asaasCustomerId, retornar
    if (user.asaasCustomerId) {
      return NextResponse.json({
        success: true,
        message: 'Usuário já possui customer ID',
        customerId: user.asaasCustomerId,
        alreadyConfigured: true
      })
    }

    console.log('📝 Atualizando CPF no banco de dados...')

    // 3. Atualizar usuário com CPF (usando raw query para evitar problemas de schema)
    try {
      await prisma.$executeRaw`
        UPDATE users
        SET "cpfCnpj" = ${cpfCnpj.replace(/\D/g, '')}
        WHERE id = ${user.id}
      `
      console.log('✅ CPF atualizado com sucesso')
    } catch (dbError: any) {
      console.error('Erro ao atualizar CPF:', dbError)
      return NextResponse.json({
        error: 'Erro ao atualizar CPF no banco',
        details: dbError.message
      }, { status: 500 })
    }

    console.log('🔍 Verificando se cliente já existe no Asaas...')

    // 4. Verificar se já existe no Asaas por email
    try {
      const existingByEmail = await asaas.getCustomers({ email: user.email })

      if (existingByEmail?.data && existingByEmail.data.length > 0) {
        const existing = existingByEmail.data[0]
        console.log('✅ Cliente encontrado no Asaas:', existing.id)

        // Vincular ID existente
        await prisma.$executeRaw`
          UPDATE users
          SET "asaasCustomerId" = ${existing.id}
          WHERE id = ${user.id}
        `

        return NextResponse.json({
          success: true,
          message: 'Cliente já existia no Asaas. Vinculado com sucesso!',
          customerId: existing.id,
          method: 'LINKED_EXISTING',
          customer: {
            id: existing.id,
            name: existing.name,
            email: existing.email
          }
        })
      }
    } catch (searchError: any) {
      console.warn('⚠️  Erro ao buscar cliente existente (continuando):', searchError.message)
    }

    console.log('➕ Criando novo cliente no Asaas...')

    // 5. Criar novo cliente no Asaas
    try {
      const customerData = formatCustomerForAsaas({
        name: user.name || 'Usuario',
        email: user.email,
        cpfCnpj: cpfCnpj.replace(/\D/g, ''),
        externalReference: user.id
      })

      console.log('📤 Dados do cliente:', { name: customerData.name, email: customerData.email })

      const asaasCustomer = await asaas.createCustomer(customerData)

      console.log('✅ Cliente criado no Asaas:', asaasCustomer.id)

      // Salvar customer ID no banco
      await prisma.$executeRaw`
        UPDATE users
        SET "asaasCustomerId" = ${asaasCustomer.id}
        WHERE id = ${user.id}
      `

      // Log da criação
      await prisma.usageLog.create({
        data: {
          userId: user.id,
          action: 'ASAAS_CUSTOMER_CREATED',
          creditsUsed: 0,
          details: {
            asaasCustomerId: asaasCustomer.id,
            method: 'QUICK_SETUP',
            cpfCnpj: cpfCnpj.replace(/\D/g, '')
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: '✅ Setup completo! Cliente criado no Asaas com sucesso!',
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
      console.error('❌ Erro ao criar cliente no Asaas:', asaasError)
      return NextResponse.json({
        error: 'Falha ao criar cliente no Asaas',
        message: asaasError.message,
        details: asaasError
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ Erro geral no quick setup:', error)
    return NextResponse.json({
      error: 'Erro interno',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}