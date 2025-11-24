/**
 * Script simples para fazer upload das imagens de preview para o S3
 * Depois gera o SQL para atualizar o banco
 *
 * Uso: npx ts-node scripts/upload-previews-to-s3.ts
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import * as fs from 'fs'
import * as path from 'path'

require('dotenv').config({ path: '.env.local' })

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

const BUCKET = process.env.AWS_S3_BUCKET!
const REGION = process.env.AWS_REGION!
const CLOUDFRONT_URL = process.env.AWS_CLOUDFRONT_URL
const PREVIEWS_DIR = path.join(process.cwd(), 'public', 'packages', 'previews')

function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase()
  const types: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
  }
  return types[ext] || 'application/octet-stream'
}

async function uploadToS3(localPath: string, s3Key: string, contentType: string): Promise<string> {
  const fileContent = fs.readFileSync(localPath)

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: fileContent,
    ContentType: contentType
  }))

  if (CLOUDFRONT_URL) {
    return `${CLOUDFRONT_URL}/${s3Key}`
  }
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`
}

async function main() {
  console.log('🚀 Iniciando upload de previews para S3...\n')

  if (!fs.existsSync(PREVIEWS_DIR)) {
    console.error('❌ Diretório não encontrado:', PREVIEWS_DIR)
    return
  }

  const packageDirs = fs.readdirSync(PREVIEWS_DIR).filter(d =>
    fs.statSync(path.join(PREVIEWS_DIR, d)).isDirectory()
  )

  console.log(`📦 Encontradas ${packageDirs.length} pastas de pacotes\n`)

  const sqlStatements: string[] = []
  let totalUploaded = 0

  for (const packageId of packageDirs) {
    const packageDir = path.join(PREVIEWS_DIR, packageId)
    const files = fs.readdirSync(packageDir).filter(f => f.match(/\.(jpg|jpeg|png|webp)$/i))

    if (files.length === 0) continue

    console.log(`\n📦 ${packageId} (${files.length} imagens)`)

    const uploadedUrls: string[] = []

    for (const file of files.sort()) {
      const localPath = path.join(packageDir, file)
      const s3Key = `package-previews/${packageId}/${file}`
      const contentType = getContentType(file)

      try {
        process.stdout.write(`   📤 ${file}... `)
        const url = await uploadToS3(localPath, s3Key, contentType)
        uploadedUrls.push(url)
        console.log('✅')
        totalUploaded++
      } catch (error) {
        console.log('❌', error)
      }
    }

    if (uploadedUrls.length > 0) {
      // Gerar SQL para este pacote
      // O nome do pacote no banco pode ter espaços ao invés de hífens
      const packageName = packageId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      const urlsJson = JSON.stringify(uploadedUrls)

      sqlStatements.push(`-- ${packageId}`)
      sqlStatements.push(`UPDATE photo_packages SET "previewUrls" = '${urlsJson}'::jsonb WHERE LOWER(name) = LOWER('${packageName}');`)
    }
  }

  console.log('\n\n========================================')
  console.log(`✅ Upload concluído! ${totalUploaded} imagens enviadas`)
  console.log('========================================\n')

  // Salvar SQL em arquivo
  const sqlContent = `-- SQL para atualizar previewUrls no Supabase
-- Execute no SQL Editor do Supabase Dashboard

${sqlStatements.join('\n')}

-- Verificar resultado:
SELECT id, name, "previewUrls" FROM photo_packages;
`

  const sqlPath = path.join(process.cwd(), 'scripts', 'update-preview-urls.sql')
  fs.writeFileSync(sqlPath, sqlContent)

  console.log(`📝 SQL salvo em: ${sqlPath}`)
  console.log('\n📋 Próximo passo:')
  console.log('   1. Abra o arquivo scripts/update-preview-urls.sql')
  console.log('   2. Execute no SQL Editor do Supabase')
}

main().catch(console.error)
