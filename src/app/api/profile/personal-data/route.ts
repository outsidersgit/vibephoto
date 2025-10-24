import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Brazilian validation functions
function validateCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i)
  let digit = 11 - (sum % 11)
  if (digit === 10 || digit === 11) digit = 0
  if (digit !== parseInt(cpf.charAt(9))) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i)
  digit = 11 - (sum % 11)
  if (digit === 10 || digit === 11) digit = 0
  return digit === parseInt(cpf.charAt(10))
}

function validateCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/\D/g, '')
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  let sum = 0
  for (let i = 0; i < 12; i++) sum += parseInt(cnpj.charAt(i)) * weights1[i]
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (digit !== parseInt(cnpj.charAt(12))) return false

  sum = 0
  for (let i = 0; i < 13; i++) sum += parseInt(cnpj.charAt(i)) * weights2[i]
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  return digit === parseInt(cnpj.charAt(13))
}

function cleanCPFCNPJ(value: string): string {
  return value.replace(/\D/g, '')
}

function cleanPhone(value: string): string {
  return value.replace(/\D/g, '')
}

// GET - Buscar dados pessoais do usuário
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    return NextResponse.json({
      success: true,
      data: user
    })

  } catch (error) {
    console.error('Error fetching personal data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch personal data' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar dados pessoais do usuário
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      cpfCnpj,
      phone,
      mobilePhone,
      postalCode,
      address,
      addressNumber,
      complement,
      province,
      city,
      state
    } = body

    // Validações obrigatórias
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    if (!cpfCnpj?.trim()) {
      return NextResponse.json({ error: 'CPF ou CNPJ é obrigatório' }, { status: 400 })
    }

    // Validar CPF ou CNPJ
    const cleanDoc = cleanCPFCNPJ(cpfCnpj)
    const isValidCPF = validateCPF(cleanDoc)
    const isValidCNPJ = validateCNPJ(cleanDoc)

    if (!isValidCPF && !isValidCNPJ) {
      return NextResponse.json({ error: 'CPF ou CNPJ inválido' }, { status: 400 })
    }

    // Verificar se CPF/CNPJ já está em uso por outro usuário
    const existingUser = await prisma.user.findFirst({
      where: {
        cpfCnpj: cleanDoc,
        id: { not: session.user.id }
      }
    })

    if (existingUser) {
      return NextResponse.json({
        error: 'Este CPF/CNPJ já está cadastrado em outra conta'
      }, { status: 400 })
    }

    // Preparar dados para atualização
    const updateData: any = {
      name: name.trim(),
      cpfCnpj: cleanDoc
    }

    // Dados opcionais
    if (phone) updateData.phone = cleanPhone(phone)
    if (mobilePhone) updateData.mobilePhone = cleanPhone(mobilePhone)
    if (postalCode) updateData.postalCode = cleanPhone(postalCode) // Remove formatting
    if (address) updateData.address = address.trim()
    if (addressNumber) updateData.addressNumber = addressNumber.trim()
    if (complement) updateData.complement = complement.trim()
    if (province) updateData.province = province.trim()
    if (city) updateData.city = city.trim()
    if (state) updateData.state = state.trim().toUpperCase()

    // Atualizar dados no banco
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
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

    // Log da atualização
    await prisma.usageLog.create({
      data: {
        userId: session.user.id,
        action: 'PERSONAL_DATA_UPDATED',
        creditsUsed: 0,
        details: {
          fields: Object.keys(updateData),
          hasAsaasCustomerId: !!updatedUser.asaasCustomerId
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'Dados pessoais atualizados com sucesso'
    })

  } catch (error: any) {
    console.error('Error updating personal data:', error)

    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return NextResponse.json({
        error: 'Dados já existem no sistema'
      }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}