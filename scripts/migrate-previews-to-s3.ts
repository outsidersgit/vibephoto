/**
 * Script para migrar imagens de preview dos pacotes do /public para S3
 *
 * Uso: npx ts-node scripts/migrate-previews-to-s3.ts
 *
 * Requer variáveis de ambiente:
 * - AWS_REGION
 * - AWS_S3_BUCKET
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' })

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const BUCKET = process.env.AWS_S3_BUCKET!
const REGION = process.env.AWS_REGION!
const CLOUDFRONT_URL = process.env.AWS_CLOUDFRONT_URL

const PREVIEWS_DIR = path.join(process.cwd(), 'public', 'packages', 'previews')

interface PackagePreview {
  packageId: string
  localPath: string
  fileName: string
}

async function findAllPreviews(): Promise<PackagePreview[]> {
  const previews: PackagePreview[] = []

  if (!fs.existsSync(PREVIEWS_DIR)) {
    console.log('❌ Diretório de previews não encontrado:', PREVIEWS_DIR)
    return previews
  }

  const packageDirs = fs.readdirSync(PREVIEWS_DIR)

  for (const packageId of packageDirs) {
    const packageDir = path.join(PREVIEWS_DIR, packageId)

    // Pular arquivos (como README.md)
    if (!fs.statSync(packageDir).isDirectory()) continue

    const files = fs.readdirSync(packageDir)

    for (const file of files) {
      if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
        previews.push({
          packageId,
          localPath: path.join(packageDir, file),
          fileName: file
        })
      }
    }
  }

  return previews
}

async function uploadToS3(localPath: string, s3Key: string, contentType: string): Promise<string> {
  const fileContent = fs.readFileSync(localPath)

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: fileContent,
    ContentType: contentType
  })

  await s3.send(command)

  // Retornar URL pública
  if (CLOUDFRONT_URL) {
    return `${CLOUDFRONT_URL}/${s3Key}`
  }
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${s3Key}`
}

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

// Mapeamento de nomes de pasta para IDs do banco
// Você pode precisar ajustar isso baseado nos IDs reais no seu banco
function normalizePackageName(folderName: string): string {
  // Converter nome da pasta para formato mais flexível para busca
  return folderName.toLowerCase().replace(/-/g, ' ').replace(/_/g, ' ')
}

async function migrate() {
  console.log('🚀 Iniciando migração de previews para S3...\n')

  // Verificar variáveis de ambiente
  if (!BUCKET || !REGION) {
    console.error('❌ AWS_S3_BUCKET e AWS_REGION são obrigatórios')
    return
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórios')
    return
  }

  // 1. Buscar todos os pacotes do banco
  console.log('📥 Buscando pacotes do banco de dados...')
  const { data: packages, error } = await supabase
    .from('photo_packages')
    .select('id, name')

  if (error) {
    console.error('❌ Erro ao buscar pacotes:', error)
    return
  }

  console.log(`✅ Encontrados ${packages?.length || 0} pacotes no banco\n`)

  // Criar mapa de nome normalizado -> pacote
  const packageMap = new Map<string, { id: string; name: string }>()
  for (const pkg of packages || []) {
    // Mapear por nome normalizado
    const normalized = pkg.name.toLowerCase().replace(/-/g, ' ').replace(/_/g, ' ')
    packageMap.set(normalized, pkg)
    // Também mapear pelo nome original em lowercase
    packageMap.set(pkg.name.toLowerCase(), pkg)
  }

  // 2. Encontrar todas as imagens de preview
  const previews = await findAllPreviews()
  console.log(`📁 Encontradas ${previews.length} imagens de preview\n`)

  if (previews.length === 0) {
    console.log('Nenhuma imagem para migrar.')
    return
  }

  // 3. Agrupar por pacote
  const byPackage = new Map<string, PackagePreview[]>()
  for (const preview of previews) {
    const list = byPackage.get(preview.packageId) || []
    list.push(preview)
    byPackage.set(preview.packageId, list)
  }

  console.log(`📦 Total de pastas de pacotes: ${byPackage.size}\n`)

  // 4. Processar cada pacote
  let successCount = 0
  let errorCount = 0

  for (const [folderId, packagePreviews] of byPackage) {
    console.log(`\n📦 Processando pasta: ${folderId}`)

    // Tentar encontrar o pacote no banco
    const normalizedFolder = normalizePackageName(folderId)
    let dbPackage = packageMap.get(normalizedFolder) || packageMap.get(folderId.toLowerCase())

    // Se não encontrou, tentar busca parcial
    if (!dbPackage) {
      for (const [key, pkg] of packageMap) {
        if (key.includes(normalizedFolder) || normalizedFolder.includes(key)) {
          dbPackage = pkg
          break
        }
      }
    }

    if (!dbPackage) {
      console.log(`  ⚠️ Pacote não encontrado no banco: ${folderId}`)
      console.log(`     Pastas disponíveis: ${Array.from(packageMap.keys()).slice(0, 5).join(', ')}...`)
      errorCount++
      continue
    }

    console.log(`  ✅ Encontrado no banco: ${dbPackage.name} (${dbPackage.id})`)

    const uploadedUrls: string[] = []

    // Upload de cada imagem
    for (const preview of packagePreviews) {
      const s3Key = `package-previews/${dbPackage.id}/${preview.fileName}`
      const contentType = getContentType(preview.fileName)

      try {
        console.log(`  📤 Uploading: ${preview.fileName}...`)
        const url = await uploadToS3(preview.localPath, s3Key, contentType)
        uploadedUrls.push(url)
        console.log(`     ✅ ${url}`)
      } catch (error) {
        console.error(`     ❌ Erro ao fazer upload: ${error}`)
      }
    }

    // Atualizar banco de dados
    if (uploadedUrls.length > 0) {
      // Ordenar URLs para manter ordem consistente (preview-1, preview-2, etc)
      uploadedUrls.sort()

      const { error: updateError } = await supabase
        .from('photo_packages')
        .update({ previewUrls: uploadedUrls })
        .eq('id', dbPackage.id)

      if (updateError) {
        console.error(`  ❌ Erro ao atualizar banco: ${updateError.message}`)
        errorCount++
      } else {
        console.log(`  💾 Banco atualizado com ${uploadedUrls.length} URLs`)
        successCount++
      }
    }
  }

  console.log('\n\n========================================')
  console.log('✅ Migração concluída!')
  console.log(`   Sucesso: ${successCount} pacotes`)
  console.log(`   Erros: ${errorCount} pacotes`)
  console.log('========================================')
  console.log('\n📋 Próximos passos:')
  console.log('1. Verifique se as imagens estão acessíveis')
  console.log('2. Teste o painel de pacotes para confirmar que as previews aparecem')
  console.log('3. Após confirmar, remova a pasta /public/packages/previews')
}

migrate()
  .catch(console.error)
