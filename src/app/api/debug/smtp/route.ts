import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function GET(req: NextRequest) {
  try {
    const host = process.env.SMTP_HOST
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    const port = parseInt(process.env.SMTP_PORT || '587')
    const secure = process.env.SMTP_SECURE === 'true'

    if (!host || !user || !pass) {
      return NextResponse.json({ ok: false, error: 'SMTP env not configured' }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
    const verified = await transporter.verify()
    return NextResponse.json({ ok: true, verified, host, port, secure, from: process.env.SMTP_FROM || user })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}


