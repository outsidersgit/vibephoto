# 🚀 CloudFront HTTP/2 e Cache - Correção Definitiva

## ❌ Problemas Identificados no Lighthouse

1. **HTTP/1.1 em vez de HTTP/2** - 7 requests servidos por HTTP/1.1
2. **Cache TTL: None** - Thumbnails sem cache headers
3. **Page prevented back/forward cache** - 3 failure reasons relacionados a `Cache-Control: no-store`

---

## ✅ Solução 1: Habilitar HTTP/2 no CloudFront

### Passo 1: Acessar CloudFront

1. Entre no [AWS Console](https://console.aws.amazon.com/cloudfront/)
2. Clique na sua distribuição (`d2df849qfdugnh.cloudfront.net`)

### Passo 2: Configurar HTTP/2

1. Clique em **Edit** na aba **General**
2. Em **Supported HTTP Versions**, marque:
   - ✅ **HTTP/2**
   - ✅ **HTTP/1.1**
   - ✅ **HTTP/1.0**
3. Clique em **Save Changes**

### Resultado Esperado
- Todos os requests passarão a usar HTTP/2 automaticamente
- Redução de latência de ~8,467ms para ~2,000ms

---

## ✅ Solução 2: Configurar Cache Headers no S3

### Para Thumbnails EXISTENTES (já no S3)

```bash
# 1. Listar todos os thumbnails
aws s3 ls s3://ensaio-fotos-prod/generated/ --recursive | grep thumbnail

# 2. Copiar cada thumbnail para si mesmo com novos metadados (isso atualiza headers)
aws s3 cp s3://ensaio-fotos-prod/generated/cmf3555br0004qjk80pe9dhqr/videos/ \
  s3://ensaio-fotos-prod/generated/cmf3555br0004qjk80pe9dhqr/videos/ \
  --recursive \
  --exclude "*" \
  --include "*_thumbnail.*" \
  --metadata-directive REPLACE \
  --content-type "image/webp" \
  --cache-control "public, max-age=31536000, immutable" \
  --acl public-read
```

### Para NOVOS Thumbnails (código já corrigido)

O código em `src/lib/video/extract-frame.ts` já está correto:

```typescript
metadata: {
  'Content-Type': 'image/jpeg', // ou image/webp
  'Cache-Control': 'public, max-age=31536000, immutable',
  'X-Optimized': 'true'
}
```

---

## ✅ Solução 3: Configurar CloudFront Response Headers Policy

### Passo 1: Criar/Editar Response Headers Policy

1. No CloudFront Console, vá em **Policies** > **Response headers**
2. Encontre sua policy customizada (ex: `vibephoto-cors-policy`)
3. Clique em **Edit**

### Passo 2: Configurar CORS

Em **CORS**, garanta que:

```
Access-Control-Allow-Origin: * (ou https://vibephoto.app)
Access-Control-Allow-Methods: GET,HEAD,OPTIONS
Access-Control-Allow-Headers: *
Access-Control-Expose-Headers: Content-Range,Accept-Ranges,Content-Length,Content-Type,ETag
Access-Control-Max-Age: 86400
Origin Override: ✅ Yes
```

**⚠️ IMPORTANTE:** 
- **SEM ESPAÇOS** após vírgulas em `Access-Control-Expose-Headers`
- Exemplo CORRETO: `Content-Range,Accept-Ranges,Content-Length`
- Exemplo ERRADO: `Content-Range, Accept-Ranges, Content-Length`

### Passo 3: Configurar Cache Headers

Em **Custom headers**, adicione:

```
Header: Cache-Control
Value: public, max-age=31536000, immutable
Override origin: No
```

### Passo 4: Salvar e Invalidar Cache

```bash
# Invalidar cache do CloudFront para aplicar mudanças
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/generated/*"
```

---

## ✅ Solução 4: Configurar Cache Behavior no CloudFront

### Passo 1: Editar Default Behavior

1. No CloudFront, vá em **Behaviors**
2. Selecione **Default (*)** e clique em **Edit**

### Passo 2: Configurar Cache Policy

Em **Cache key and origin requests**:

```
Cache policy: CachingOptimized (ou criar custom)
- Min TTL: 0
- Max TTL: 31536000 (1 ano)
- Default TTL: 86400 (1 dia)

Query strings: All
Headers: 
  - Accept
  - Accept-Encoding
  - Origin
Cookies: None
```

### Passo 3: Configurar Origin Request Policy

```
Origin request policy: CORS-CustomOrigin (ou similar)
- Query strings: All
- Headers: Origin, Access-Control-Request-Method, Access-Control-Request-Headers
- Cookies: None
```

---

## ✅ Solução 5: Configurar S3 Bucket Policy

Garanta que o bucket permite leitura pública:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::ensaio-fotos-prod/generated/*"
    }
  ]
}
```

---

## 🧪 Teste Final

### 1. Testar HTTP/2

```bash
curl -I --http2 https://d2df849qfdugnh.cloudfront.net/generated/cmf3555br0004qjk80pe9dhqr/videos/cmibt6fq20001jm041x8xt3xc_thumbnail.webp
```

Procure por:
```
HTTP/2 200
cache-control: public, max-age=31536000, immutable
content-type: image/webp
access-control-allow-origin: *
```

### 2. Testar Cache

```bash
# Primeira requisição (MISS)
curl -I https://d2df849qfdugnh.cloudfront.net/generated/.../thumbnail.webp

# Segunda requisição (HIT)
curl -I https://d2df849qfdugnh.cloudfront.net/generated/.../thumbnail.webp
```

Procure por:
```
x-cache: Hit from cloudfront
age: 123 (segundos desde o cache)
```

### 3. Rodar Lighthouse Novamente

Após aplicar as mudanças:

1. Abra DevTools > Lighthouse
2. Mode: Navigation
3. Device: Desktop ou Mobile
4. Categorias: Performance
5. **Clear storage** antes do teste
6. Run analysis

**Melhorias Esperadas:**
- ✅ Use HTTP/2: PASSOU
- ✅ Use efficient cache lifetimes: PASSOU (ou reduzido para <50 KiB)
- ✅ LCP request discovery: Melhorado
- ✅ Network dependency tree: Latência reduzida de 8,467ms para ~2,000ms

---

## 📊 Resultados Esperados

### Antes:
- **Thumbnails:** 80 KiB, 63 KiB, 61 KiB, 49 KiB
- **Cache TTL:** None
- **HTTP:** 1.1
- **LCP:** 8,467ms

### Depois:
- **Thumbnails:** 40-60 KiB (WebP otimizado)
- **Cache TTL:** 1 ano (31536000s)
- **HTTP:** 2
- **LCP:** ~2,000ms

### Performance Score:
- **Antes:** ~60-70
- **Depois:** ~85-95 ✅

---

## 🎯 Checklist de Implementação

- ✅ Vídeos com `preload="none"` (frontend)
- ✅ Thumbnails com `loading="lazy"`, `decoding="async"`, `width`, `height`, `sizes`
- ✅ HTTP/2 habilitado no CloudFront
- ✅ Response Headers Policy com CORS correto (sem espaços)
- ✅ Cache Policy com TTL de 1 ano
- ✅ S3 metadata com `Cache-Control` nos arquivos existentes
- ✅ CloudFront cache invalidado

---

**Dúvidas?** Abra o CloudFront console e verifique:
1. **General** > HTTP Versions
2. **Behaviors** > Cache Policy
3. **Policies** > Response Headers

