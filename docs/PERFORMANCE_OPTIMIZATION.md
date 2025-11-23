# 🚀 Guia de Otimização de Performance

## ⚡ Problema Identificado (Lighthouse)

A galeria de vídeos está com performance ruim devido a:

1. **Thumbnails pesadíssimas**: 2.5 MB cada (deveria ser ~50-100 KB)
2. **Sem cache HTTP**: Thumbnails são re-baixadas a cada navegação
3. **Back/forward cache desabilitado**: `cache-control:no-store`

---

## ✅ Correções Implementadas

### 1. Compressão de Thumbnails ✅

**Arquivo:** `src/lib/video/extract-frame.ts`

Agora os thumbnails são:
- **Redimensionados** para 640x360px
- **Comprimidos** com JPEG quality 75 + mozjpeg
- **Otimizados** de ~2.5 MB → ~50-100 KB (95% de redução!)

```typescript
const optimizedThumbnail = await sharp(frameBuffer)
  .resize(640, 360, {
    fit: 'cover',
    position: 'center'
  })
  .jpeg({
    quality: 75,
    progressive: true,
    mozjpeg: true
  })
  .toBuffer()
```

---

### 2. Headers de Cache no Next.js ✅

**Arquivo:** `next.config.js`

Adicionados headers de cache agressivo para imagens e vídeos:

```javascript
async headers() {
  return [
    {
      source: '/:path*.(jpg|jpeg|png|webp|avif|mp4)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ]
}
```

---

## 🔧 Configurações Pendentes (AWS/CloudFront)

### 3. Configurar Cache no S3 Bucket

**⚠️ AÇÃO NECESSÁRIA:**

1. Acesse o **AWS S3 Console**
2. Abra o bucket: `ensaio-fotos-prod.s3.us-east-2.amazonaws.com`
3. Vá em **Properties** → **Default encryption and lifecycle**
4. Configure **Metadata Defaults**:

```
Content-Type: image/jpeg (para thumbnails)
Cache-Control: public, max-age=31536000, immutable
```

**OU** via AWS CLI:

```bash
aws s3 cp s3://ensaio-fotos-prod/generated/ \
  s3://ensaio-fotos-prod/generated/ \
  --recursive \
  --metadata-directive REPLACE \
  --cache-control "public, max-age=31536000, immutable" \
  --content-type "image/jpeg" \
  --exclude "*" \
  --include "*.jpg"
```

---

### 4. Configurar CloudFront

**⚠️ AÇÃO NECESSÁRIA:**

1. Acesse **CloudFront Console**
2. Selecione a distribuição: `d2df849qfdugnh.cloudfront.net`
3. Vá em **Behaviors** → **Edit**
4. Configure:

**Cache Policy:**
- **Cache based on**: Query strings, headers, and cookies
- **Minimum TTL**: 31536000 (1 ano)
- **Maximum TTL**: 31536000
- **Default TTL**: 31536000

**Response Headers Policy:**
```
Cache-Control: public, max-age=31536000, immutable
Access-Control-Allow-Origin: *
Access-Control-Expose-Headers: Content-Length,Content-Type,ETag
```

5. **Invalidate Cache** para aplicar:

```bash
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/generated/*"
```

---

## 📊 Resultados Esperados

| Métrica | Antes | Depois |
|---------|-------|--------|
| Thumbnail Size | 2.5 MB | 50-100 KB |
| Network Payload | 7.1 MB | < 500 KB |
| Cache Misses | 100% | < 5% |
| LCP | > 5s | < 2s |
| Back/Forward Cache | ❌ Disabled | ✅ Enabled |
| Lighthouse Score | ~40 | ~90 |

---

## 🧪 Como Testar

1. **Limpar cache do navegador** (Ctrl + Shift + Delete)
2. **Acessar** `/gallery?tab=videos`
3. **Abrir DevTools** → Network tab
4. **Verificar**:
   - Thumbnails devem ter ~50-100 KB
   - Headers devem mostrar: `cache-control: public, max-age=31536000`
   - Segunda visita deve usar cache (disk cache)

5. **Rodar Lighthouse** novamente:
```bash
# No Chrome DevTools
Lighthouse → Performance → Analyze page load
```

---

## 🔍 Outras Otimizações Recomendadas

### A. Lazy Loading de Imagens

Todas as imagens/vídeos deveriam usar `loading="lazy"`:

```tsx
<img 
  src={thumbnail} 
  loading="lazy" 
  fetchpriority="low"
/>
```

### B. Usar `next/image` para Otimização Automática

```tsx
import Image from 'next/image'

<Image
  src={thumbnail}
  width={640}
  height={360}
  alt="Video thumbnail"
  loading="lazy"
  quality={75}
/>
```

### C. Implementar Pagination/Infinite Scroll

Em vez de carregar 20 vídeos de uma vez, carregar 5-10 inicialmente e implementar scroll infinito.

### D. Preconnect para Recursos Externos

**Arquivo:** `src/app/layout.tsx`

```tsx
<head>
  <link rel="preconnect" href="https://d2df849qfdugnh.cloudfront.net" />
  <link rel="preconnect" href="https://ensaio-fotos-prod.s3.us-east-2.amazonaws.com" />
</head>
```

---

## 📝 Checklist de Deploy

- [x] Compressão de thumbnails implementada
- [x] Headers de cache no Next.js
- [ ] Configurar cache no S3
- [ ] Configurar CloudFront
- [ ] Invalidar cache do CloudFront
- [ ] Testar com Lighthouse
- [ ] Confirmar score > 80

---

## 🆘 Troubleshooting

### Thumbnails ainda pesadas após deploy?

1. **Limpar cache do navegador**
2. **Verificar se o webhook está regenerando thumbnails**:
```sql
SELECT "thumbnailUrl", "videoUrl", "createdAt" 
FROM "video_generations" 
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
ORDER BY "createdAt" DESC
LIMIT 5;
```

3. **Forçar regeneração** de thumbnails antigas (opcional):
```bash
# Criar script para re-gerar thumbnails antigas
node scripts/regenerate-video-thumbnails.js
```

### Cache ainda não funciona?

1. **Verificar headers na resposta**:
```bash
curl -I https://d2df849qfdugnh.cloudfront.net/generated/user/videos/thumb.jpg
```

Deve retornar:
```
cache-control: public, max-age=31536000, immutable
```

2. **Invalidar cache do CloudFront**
3. **Aguardar 5-10 minutos** para propagação

---

## 📚 Referências

- [Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [CloudFront Cache Behaviors](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesCacheBehavior)
- [S3 Object Metadata](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingMetadata.html)
- [Web.dev Performance Guide](https://web.dev/performance/)

