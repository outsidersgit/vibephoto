import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({ region: process.env.AWS_REGION })

export async function POST(req: NextRequest) {
  try {
    const { userId, files = [], prefix = 'training' } = await req.json()

    if (!userId || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'Parâmetros inválidos: userId e files são obrigatórios' }, { status: 400 })
    }

    const bucket = process.env.AWS_S3_BUCKET
    const region = process.env.AWS_REGION
    if (!bucket || !region) {
      return NextResponse.json({ error: 'Configuração AWS ausente (AWS_S3_BUCKET/AWS_REGION)' }, { status: 500 })
    }

    const cloudFrontUrl = process.env.AWS_CLOUDFRONT_URL

    const results = await Promise.all(files.map(async (f: any, i: number) => {
      const safeName = typeof f?.name === 'string' ? f.name.replace(/[^A-Za-z0-9._-]/g, '_') : `file_${i}`
      const category = typeof f?.category === 'string' ? f.category : 'misc'
      const contentType = typeof f?.type === 'string' ? f.type : 'application/octet-stream'
      
      // Construir key baseado no prefix customizado ou padrão
      const key = prefix === 'package-previews'
        ? `${prefix}/${Date.now()}_${i}_${safeName}`
        : `${prefix}/${userId}/${category}/${Date.now()}_${i}_${safeName}`

      // Importante: assinar apenas o que o cliente realmente enviará no PUT
      // Se assinarmos cabeçalhos extras aqui, o navegador também precisa enviá-los, senão dá 403
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType
      })

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 })
      const publicUrl = cloudFrontUrl
        ? `${cloudFrontUrl}/${key}`
        : `https://${bucket}.s3.${region}.amazonaws.com/${key}`

      return { uploadUrl, key, publicUrl, contentType }
    }))

    return NextResponse.json({ uploads: results })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao pré-assinar upload' }, { status: 500 })
  }
}


