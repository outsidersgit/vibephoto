import { NextRequest, NextResponse } from 'next/server'
import { createUser, getUserByEmail } from '@/lib/db/users'

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json()

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato de email inválido' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      )
    }

    // Check if user already exists (with database error handling)
    let existingUser = null
    try {
      existingUser = await getUserByEmail(email)
    } catch (error) {
      console.error('Database connection error during signup check:', error)
      return NextResponse.json(
        { error: 'Sistema temporariamente indisponível. Tente novamente em alguns minutos.' },
        { status: 503 }
      )
    }

    if (existingUser) {
      return NextResponse.json(
        { error: 'Usuário já existe' },
        { status: 400 }
      )
    }

    // Create new user (with database error handling)
    let user = null
    try {
      user = await createUser({
        name,
        email,
        password
      })
    } catch (error) {
      console.error('Database connection error during user creation:', error)
      return NextResponse.json(
        { error: 'Sistema temporariamente indisponível. Tente novamente em alguns minutos.' },
        { status: 503 }
      )
    }

    // Return success (don't include password)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        creditsUsed: user.creditsUsed,
        creditsLimit: user.creditsLimit
      }
    })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}