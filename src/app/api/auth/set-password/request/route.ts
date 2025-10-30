import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import nodemailer from 'nodemailer'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, recaptchaToken } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  // Allow admins to bypass reCAPTCHA when triggering from the admin panel
  const session = await getServerSession(authOptions)
  const isAdmin = !!session && String(((session.user as any)?.role) || '').toUpperCase() === 'ADMIN'

  // Optional reCAPTCHA verification (enable when RECAPTCHA_SECRET is set)
  if (process.env.RECAPTCHA_SECRET && !isAdmin) {
    try {
      const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: process.env.RECAPTCHA_SECRET, response: recaptchaToken || '' })
      })
      const result = (await resp.json()) as any
      if (!result.success) {
        return NextResponse.json({ error: 'reCAPTCHA failed' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'reCAPTCHA error' }, { status: 400 })
    }
  }

  // Throttle: limit to 5 requests per 15 minutes per email
  try {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000)
    const count = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count
      FROM "SystemLog"
      WHERE message = 'password_reset_request'
        AND metadata ->> 'email' = ${email}
        AND "createdAt" >= ${fifteenMinAgo}
    `
    const attempts = Number(count?.[0]?.count || 0)
    if (attempts >= 5) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }
  } catch {}

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return NextResponse.json({ ok: true }) // Do not leak existence

  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 1000 * 60 * 30) // 30 min

  // Upsert verification token
  await prisma.verificationToken.upsert({
    where: { identifier_token: { identifier: email, token } as any },
    create: { identifier: email, token, expires },
    update: { token, expires }
  } as any)

  // Log attempt
  try {
    await prisma.systemLog.create({
      data: { level: 'info', message: 'password_reset_request', metadata: { email } }
    })
  } catch {}

  const url = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/set-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`

  // Send email in production using SMTP
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP not configured, returning link in response')
      return NextResponse.json({ ok: true, url })
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })

    const from = process.env.SMTP_FROM || process.env.SMTP_USER
    const subject = isAdmin ? 'Seu acesso ao VibePhoto' : 'Redefinição de senha - VibePhoto'
    const html = isAdmin
      ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #667EEA; padding-bottom: 10px;">Bem-vindo ao VibePhoto</h2>
        <p>Olá! Seu acesso ao VibePhoto foi criado para o e-mail <b>${email}</b>. Você pode entrar de duas formas:</p>
        <ol style="margin: 12px 0 16px 18px; color:#333;">
          <li style="margin:6px 0;"><b>Login com Google (recomendado):</b> use o mesmo e-mail (${email}).</li>
          <li style="margin:6px 0;"><b>Definir uma senha:</b> clique no botão abaixo em até <b>30 minutos</b> para criar sua senha. Depois, você pode usar e-mail/senha normalmente.</li>
        </ol>
        <p style="margin: 20px 0;">
          <a href="${url}" style="background:#6d28d9;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">Definir minha senha</a>
        </p>
        <p>Se preferir, copie e cole este link no navegador:</p>
        <p style="word-break:break-all;color:#555">${url}</p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #eee" />
        <p style="font-size:12px;color:#888">Dúvidas? Responda este e-mail.</p>
      </div>
      `
      : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #667EEA; padding-bottom: 10px;">Redefinição de senha</h2>
        <p>Recebemos uma solicitação para redefinir a senha da conta <b>${email}</b>.</p>
        <p>Clique no botão abaixo para criar uma nova senha. Este link expira em <b>30 minutos</b>.</p>
        <p style="margin: 24px 0;">
          <a href="${url}" style="background:#6d28d9;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block">Redefinir minha senha</a>
        </p>
        <p>Se o botão não funcionar, copie e cole este link no navegador:</p>
        <p style="word-break:break-all;color:#555">${url}</p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #eee" />
        <p style="font-size:12px;color:#888">Se você não solicitou este procedimento, ignore este e-mail.</p>
      </div>
      `
    const text = isAdmin
      ? `Olá! Seu acesso ao VibePhoto foi criado. Você pode entrar com Google usando ${email} ou definir sua senha (expira em 30 min): ${url}`
      : `Redefinição de senha do VibePhoto (expira em 30 min): ${url}`

    const info = await transporter.sendMail({
      from: from,
      sender: process.env.SMTP_USER,
      to: email,
      replyTo: process.env.SMTP_FROM || process.env.SMTP_USER,
      subject,
      html,
      text
    })
    console.log('📧 Password reset email sent:', { messageId: info.messageId, to: email })
    return NextResponse.json({ ok: true, messageId: info.messageId })
  } catch (e) {
    console.error('Password email send error:', e)
    // Fall back to returning the URL so o admin pode compartilhar manualmente
    return NextResponse.json({ ok: true, url })
  }
}


