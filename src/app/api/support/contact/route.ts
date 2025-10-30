import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import nodemailer from 'nodemailer'

// Support contact form API endpoint - handles email sending with attachments
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const account = formData.get('account') as string
    const subject = formData.get('subject') as string
    const problemType = formData.get('problemType') as string
    const description = formData.get('description') as string

    // Handle file attachments
    const attachments = formData.getAll('attachments') as File[]
    const attachmentDetails: Array<{filename: string, content: Buffer, contentType: string, size: number}> = []

    // Validação dos campos obrigatórios
    if (!account || !subject || !problemType || !description) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
    }

    if (description.length < 20) {
      return NextResponse.json({ error: 'A descrição deve ter pelo menos 20 caracteres' }, { status: 400 })
    }

    // Process file attachments if any (convert to buffer for email attachment)
    if (attachments.length > 0) {
      for (const file of attachments) {
        if (file.size > 0) { // Check if file is not empty
          // Limit file size to 10MB
          if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'Arquivos devem ter no máximo 10MB' }, { status: 400 })
          }

          // Convert file to buffer
          const bytes = await file.arrayBuffer()
          const buffer = Buffer.from(bytes)

          attachmentDetails.push({
            filename: file.name,
            content: buffer,
            contentType: file.type || 'application/octet-stream',
            size: file.size
          })
        }
      }
    }

    // Configuração do transporter do Nodemailer
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    // Verificar se as credenciais SMTP estão configuradas
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('SMTP credentials not configured')
      return NextResponse.json({ error: 'Serviço de email não configurado' }, { status: 500 })
    }

    // Formatação do email
    const attachmentsHtml = attachmentDetails.length > 0 ? `
      <div style="margin: 20px 0;">
        <h3 style="color: #333; margin-bottom: 10px;">Anexos (${attachmentDetails.length}):</h3>
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
          ${attachmentDetails.map(att => `
            <div style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">
              <strong>${att.filename}</strong> (${(att.size / 1024 / 1024).toFixed(2)} MB)
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #667EEA; padding-bottom: 10px;">
          Nova mensagem de suporte
        </h2>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">Conta:</td>
              <td style="padding: 8px 0;">${account}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">Email:</td>
              <td style="padding: 8px 0;">${session.user.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">Assunto:</td>
              <td style="padding: 8px 0;">${subject}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #555;">Tipo de problema:</td>
              <td style="padding: 8px 0;">${problemType}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 20px 0;">
          <h3 style="color: #333; margin-bottom: 10px;">Descrição do problema:</h3>
          <div style="background-color: white; padding: 15px; border-left: 4px solid #667EEA; border-radius: 0 4px 4px 0;">
            ${description.replace(/\n/g, '<br>')}
          </div>
        </div>

        ${attachmentsHtml}

        <div style="margin: 20px 0; padding: 15px; background-color: #e3f2fd; border-radius: 8px;">
          <p style="margin: 0; color: #666; font-size: 14px;">
            <strong>ID do usuário:</strong> ${session.user.id}<br>
            <strong>Nome:</strong> ${session.user.name || 'Não informado'}<br>
            <strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}
          </p>
        </div>
      </div>
    `

    const attachmentsText = attachmentDetails.length > 0 ? `\n\nAnexos (${attachmentDetails.length}):\n${attachmentDetails.map(att => `- ${att.filename} (${(att.size / 1024 / 1024).toFixed(2)} MB)`).join('\n')}` : ''

    const emailText = `
      Nova mensagem de suporte

      Conta: ${account}
      Email: ${session.user.email}
      Assunto: ${subject}
      Tipo de problema: ${problemType}

      Descrição:
      ${description}${attachmentsText}

      ---
      ID do usuário: ${session.user.id}
      Nome: ${session.user.name || 'Não informado'}
      Data: ${new Date().toLocaleString('pt-BR')}
    `

    // Configuração do email com anexos
    const mailOptions: any = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'suporte@vibephoto.app',
      subject: `[Suporte] ${subject}`,
      text: emailText,
      html: emailHtml,
      replyTo: session.user.email,
    }

    // Add attachments if any (using buffer instead of file path for serverless)
    if (attachmentDetails.length > 0) {
      mailOptions.attachments = attachmentDetails.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType
      }))
    }

    // Enviar o email
    await transporter.sendMail(mailOptions)

    return NextResponse.json({
      success: true,
      message: 'Mensagem enviada com sucesso! Responderemos em breve.'
    })

  } catch (error) {
    console.error('Error sending support email:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor. Tente novamente mais tarde.' },
      { status: 500 }
    )
  }
}