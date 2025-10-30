import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const { email, token, password } = await req.json()
  if (!email || !token || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const vt = await prisma.verificationToken.findFirst({ where: { identifier: email, token } })
  if (!vt || vt.expires < new Date()) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })

  const hashed = await bcrypt.hash(password, 10)
  await prisma.user.update({ where: { email }, data: { password: hashed } })
  await prisma.verificationToken.deleteMany({ where: { identifier: email } })

  return NextResponse.json({ ok: true })
}


