# 🚀 Guia de Configuração do CloudFront para VibePhoto

**Objetivo:** Configurar AWS CloudFront como CDN para o bucket S3, reduzindo latência de 1.5s para ~150ms (90% de melhoria).

---

## 📋 Pré-requisitos

- ✅ Acesso ao Console AWS
- ✅ Bucket S3: `vibephoto-images` (região: sa-east-1)
- ✅ Imagens já configuradas como públicas

---

## 🔧 Passo a Passo

### **1. Acessar o Console CloudFront**

1. Entre em: https://console.aws.amazon.com/cloudfront/
2. Clique em **"Create Distribution"**

---

### **2. Configurar Origin**

**Origin Domain:**
```
vibephoto-images.s3.sa-east-1.amazonaws.com
```

**Origin Path:** (deixe vazio)

**Name:** `vibephoto-s3-origin`

**Origin Access:**
- ✅ Selecione **"Public"** (bucket já é público)
- ❌ NÃO use OAI (Origin Access Identity) - não é necessário

**Additional settings:**
- **Enable Origin Shield:** No (não necessário para este caso)
- **Connection timeout:** 30 seconds (padrão)

---

### **3. Configurar Default Cache Behavior**

**Path Pattern:** `Default (*)`

**Compress Objects Automatically:** ✅ **Yes** (Gzip + Brotli)

**Viewer Protocol Policy:** ✅ **Redirect HTTP to HTTPS**

**Allowed HTTP Methods:**
- ✅ GET, HEAD, OPTIONS
- ❌ PUT, POST, DELETE, PATCH (não necessário para imagens)

**Cache Policy:**
- Selecione **"CachingOptimized"** (recomendado)
- Ou criar custom:
  - **Min TTL:** 0
  - **Max TTL:** 31536000 (1 ano)
  - **Default TTL:** 86400 (1 dia)

**Origin Request Policy:**
- **CORS-S3Origin** (permite headers CORS)

---

### **4. Configurar Settings da Distribution**

**Price Class:**
- ✅ **Use all edge locations (best performance)**
- Ou: **Use only North America and Europe** (custo menor)
- Recomendado: **All** para melhor latência no Brasil

**Alternate Domain Names (CNAMEs):** (opcional)
```
cdn.vibephoto.app
images.vibephoto.app
```

**SSL Certificate:**
- Se usar CNAME: Solicitar certificado no ACM (AWS Certificate Manager) em **us-east-1**
- Se não usar CNAME: Usar certificado CloudFront padrão

**Supported HTTP Versions:**
- ✅ HTTP/2
- ✅ HTTP/3 (recomendado para melhor performance)

**Default Root Object:** (deixe vazio)

**Logging:** (opcional)
- Se quiser analytics: ative logging em bucket separado

**IPv6:** ✅ Enabled

---

### **5. Criar Distribution**

Clique em **"Create Distribution"**

⏱️ **Aguarde:** 10-15 minutos para deploy completo

---

## 📝 Após a Criação

### **Copiar a URL do CloudFront**

Exemplo: `https://d1a2b3c4d5e6f7.cloudfront.net`

---

## ⚙️ Configuração no Código

### **1. Adicionar variável de ambiente no Vercel**

```bash
# .env.production
NEXT_PUBLIC_AWS_CLOUDFRONT_URL=https://d1a2b3c4d5e6f7.cloudfront.net
```

**No Vercel Dashboard:**
1. Vá em: `Settings` → `Environment Variables`
2. Adicione:
   - **Key:** `NEXT_PUBLIC_AWS_CLOUDFRONT_URL`
   - **Value:** `https://d1a2b3c4d5e6f7.cloudfront.net`
   - **Environment:** Production, Preview, Development

---

### **2. Verificar Configuração no Código**

O código já está preparado! Verifique:

```typescript
// src/lib/storage/config.ts (linha 29)
cloudFrontUrl: process.env.NEXT_PUBLIC_AWS_CLOUDFRONT_URL

// src/lib/storage/providers/aws-s3.ts (linha 127-132)
getPublicUrl(key: string): string {
  // ✅ Usa CloudFront se configurado
  if (this.cloudFrontUrl) {
    return `${this.cloudFrontUrl}/${key}`
  }
  // Fallback para S3 direto
  return `https://${this.bucket}.s3.${STORAGE_CONFIG.aws.region}.amazonaws.com/${key}`
}
```

---

## 🧪 Testar a Configuração

### **1. Verificar se CloudFront está ativo**

```bash
# Testar URL direta do CloudFront
curl -I https://d1a2b3c4d5e6f7.cloudfront.net/generated/user123/generations/image.jpg

# Deve retornar:
# HTTP/2 200
# x-cache: Hit from cloudfront (após primeira requisição)
```

### **2. Verificar headers de cache**

```bash
curl -I https://d1a2b3c4d5e6f7.cloudfront.net/generated/user123/generations/image.jpg

# Deve conter:
# cache-control: public, max-age=31536000, immutable
# x-cache: Hit from cloudfront
# age: 123 (tempo em segundos desde cache)
```

---

## 🎯 Configurações Opcionais (Avançado)

### **Invalidação de Cache**

Se precisar limpar cache de arquivos específicos:

```bash
aws cloudfront create-invalidation \
  --distribution-id E1A2B3C4D5E6F7 \
  --paths "/generated/user123/*"
```

**Custo:** 1000 invalidações grátis/mês, depois $0.005 cada

---

### **Custom Error Pages**

Configurar páginas de erro 403, 404:

1. CloudFront → Distribution → Error Pages
2. Create Custom Error Response:
   - **HTTP Error Code:** 404
   - **Customize Error Response:** Yes
   - **Response Page Path:** `/error-404.png`
   - **HTTP Response Code:** 404

---

### **Geo Restriction** (opcional)

Se quiser bloquear/permitir países específicos:

1. CloudFront → Distribution → Restrictions
2. Enable Geo Restriction
3. Whitelist: Brasil (BR)

---

## 📊 Métricas Esperadas

### **Antes (S3 Direto):**
- Latência média: ~1500ms
- TTFB (Time to First Byte): ~800ms
- Região SA: 400-600ms
- Região US/EU: 2000-3000ms

### **Depois (CloudFront):**
- Latência média: ~150ms ⚡ (90% redução)
- TTFB: ~50ms ⚡
- Região SA: 50-100ms ⚡
- Região US/EU: 100-200ms ⚡

**Cache Hit Rate esperado:** 95%+

---

## 🔍 Monitoramento

### **CloudFront Dashboard**

Acesse: https://console.aws.amazon.com/cloudfront/

Métricas disponíveis:
- **Requests:** Total de requisições
- **Data Transfer:** Bytes transferidos
- **Cache Hit Rate:** % de hits no cache
- **Error Rate:** Taxa de erros 4xx/5xx
- **Origin Response Time:** Latência do S3

### **CloudWatch Alarms** (opcional)

Criar alertas para:
- Cache Hit Rate < 90%
- Error Rate > 5%
- Data Transfer > threshold

---

## 💰 Custos Estimados

**Premissas:**
- 1M de requisições/mês
- 500GB de transfer/mês
- Região: South America (SA)

**Custos CloudFront:**
- Requisições: $0.0075/10,000 = **$0.75**
- Data Transfer: $0.140/GB × 500GB = **$70.00**
- **Total:** ~$70.75/mês

**Economia S3:**
- S3 GET requests: $0.0004/1,000 × 1,000 = **$0.40**
- S3 Data Transfer: $0.090/GB × 500GB = **$45.00**
- **Economia:** Sim (cache reduz requisições em 95%)

**Custo real esperado:**
- CloudFront Data Transfer: $70/mês
- S3 requests (5% miss): $0.02/mês
- **Total:** ~$70/mês (mesmo custo, mas 10x mais rápido!)

---

## ⚠️ Troubleshooting

### **Erro: Access Denied (403)**

**Causa:** Bucket Policy não permite CloudFront

**Solução:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::vibephoto-images/*"
    }
  ]
}
```

---

### **Erro: Cache não funciona (sempre Miss)**

**Causa:** Headers conflitantes

**Solução:**
1. Verificar se S3 está enviando `Cache-Control` correto
2. Verificar Behavior Settings no CloudFront
3. Limpar invalidação de cache

---

### **Erro: CORS bloqueado**

**Causa:** Headers CORS não configurados

**Solução:**
1. CloudFront → Behaviors → Origin Request Policy
2. Selecionar **CORS-S3Origin**
3. Ou criar custom com headers:
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Methods`

---

## ✅ Checklist Final

Antes de marcar como concluído:

- [ ] Distribution criada e status: **Deployed**
- [ ] URL CloudFront testada: `https://d...cloudfront.net/path/image.jpg`
- [ ] Headers `x-cache: Hit from cloudfront` aparecem
- [ ] Variável `NEXT_PUBLIC_AWS_CLOUDFRONT_URL` configurada no Vercel
- [ ] Deploy do Vercel feito após adicionar variável
- [ ] Teste end-to-end: upload → URL retornada usa CloudFront
- [ ] Latência reduzida < 200ms

---

## 🚀 Próximos Passos

Após CloudFront configurado:

1. ✅ Monitorar Cache Hit Rate (meta: >95%)
2. ✅ Configurar invalidação automática (se necessário)
3. ✅ Avaliar custom domain (cdn.vibephoto.app)
4. ✅ Considerar Lambda@Edge para transformações (resize on-the-fly)

---

**Tempo estimado:** 30 minutos
**Impacto:** 🔴 **CRÍTICO** (90% redução de latência)
**Prioridade:** 🔥 **MÁXIMA**

---

**Elaborado por:** Claude (Anthropic)
**Data:** 28/10/2025
**Versão:** 1.0
