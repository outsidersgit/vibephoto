# 🔧 CloudFront CORS - Troubleshooting

## 🧪 Teste de CORS

**Endpoint de teste criado:** `/api/test-cors?url=YOUR_VIDEO_URL`

### Como testar:

1. **Copie a URL de um vídeo** do CloudFront:
   ```
   https://d2df849qfdugnh.cloudfront.net/generated/.../video.mp4
   ```

2. **Abra no navegador:**
   ```
   https://vibephoto.app/api/test-cors?url=https://d2df849qfdugnh.cloudfront.net/generated/.../video.mp4
   ```

3. **Analise o resultado:**
   - ✅ Se todos headers estiverem presentes: CORS está configurado
   - ❌ Se faltar algum header: CORS não está configurado corretamente

---

## 📋 Checklist Completo de Configuração

### ✅ **1. CORS no S3 Bucket**

1. Acesse: https://s3.console.aws.amazon.com/
2. Bucket `vibephoto-images`
3. **Permissions** → **Cross-origin resource sharing (CORS)**
4. Cole exatamente:

```json
[
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD",
      "OPTIONS"
    ],
    "AllowedOrigins": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
      "Content-Type"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**⚠️ Importante:** Use `"*"` em `AllowedOrigins` para testar. Depois pode restringir.

---

### ✅ **2. CloudFront Behavior**

#### **Opção A: Usar Policy Managed pela AWS (Mais Fácil)**

1. Acesse CloudFront: https://console.aws.amazon.com/cloudfront/
2. Clique na sua distribuição
3. **Behaviors** → Selecione o default → **Edit**
4. Configure:
   - **Origin request policy:** `CORS-S3Origin`
   - **Response headers policy:** `SimpleCORS`
5. **Save changes**
6. **⏳ Aguarde 10-15 minutos** para propagar

#### **Opção B: Criar Response Headers Policy Custom**

Se `SimpleCORS` não funcionar, crie uma custom:

1. CloudFront → **Policies** → **Response headers** → **Create policy**
2. **Name:** `VideoStreamingCORS`
3. **CORS Configuration:**
   - ✅ **Access-Control-Allow-Origin:** `*` (ou `https://vibephoto.app`)
   - ✅ **Access-Control-Allow-Methods:** `GET, HEAD, OPTIONS`
   - ✅ **Access-Control-Allow-Headers:** `*`
   - ✅ **Access-Control-Expose-Headers:** `Content-Range, Accept-Ranges, Content-Length, ETag, Content-Type`
   - ✅ **Access-Control-Max-Age:** `3600`
   - ✅ **Access-Control-Allow-Credentials:** `false`
4. **Create**
5. Volte em **Behaviors** → **Edit** → **Response headers policy:** `VideoStreamingCORS`

---

### ✅ **3. Invalidar Cache do CloudFront**

**Muito importante!** O CloudFront pode ter cacheado a resposta sem CORS.

1. CloudFront → Sua distribuição
2. **Invalidations** → **Create invalidation**
3. **Object paths:**
   ```
   /generated/*
   /*
   ```
4. **Create invalidation**
5. **⏳ Aguarde 5-10 minutos**

---

### ✅ **4. Verificar Bucket Policy**

O bucket precisa permitir leitura pública:

1. S3 → `vibephoto-images` → **Permissions** → **Bucket Policy**
2. Verifique se tem algo assim:

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

## 🔍 **Diagnóstico de Problemas Comuns**

### **Problema 1: Headers não aparecem no teste**

**Causa:** CloudFront não está usando a Response Headers Policy

**Solução:**
1. Verifique se a policy está **realmente associada** ao Behavior
2. Invalide o cache
3. Aguarde propagação (10-15 min)

---

### **Problema 2: `Access-Control-Allow-Origin: *` não funciona**

**Causa:** Pode ter configuração conflitante

**Solução:**
1. Remova qualquer configuração CORS antiga
2. Use apenas uma policy (não misture S3 CORS + CloudFront)
3. Prefira configurar no CloudFront (Response Headers Policy)

---

### **Problema 3: Funciona no teste mas não no site**

**Causa:** Preflight request (OPTIONS) bloqueado

**Solução:**
1. Adicione `OPTIONS` em `AllowedMethods` no S3 CORS
2. Em CloudFront Behavior:
   - **Allowed HTTP Methods:** `GET, HEAD, OPTIONS`
   - **Cached HTTP Methods:** Marque `OPTIONS`

---

### **Problema 4: Cache do navegador**

**Solução:**
1. Abra DevTools → **Network** tab
2. Marque **Disable cache**
3. Faça um **Hard Refresh** (Ctrl+Shift+R)

---

## 🧪 **Teste Manual via cURL**

```bash
# Teste 1: Verificar headers CORS
curl -I -H "Origin: https://vibephoto.app" \
  "https://d2df849qfdugnh.cloudfront.net/generated/USER_ID/videos/VIDEO.mp4"

# Deve retornar:
# HTTP/2 200
# access-control-allow-origin: *
# access-control-expose-headers: Content-Range, Accept-Ranges, ...
# accept-ranges: bytes
```

```bash
# Teste 2: Range request (essencial para vídeos)
curl -I -H "Origin: https://vibephoto.app" \
  -H "Range: bytes=0-1000" \
  "https://d2df849qfdugnh.cloudfront.net/generated/USER_ID/videos/VIDEO.mp4"

# Deve retornar:
# HTTP/2 206 Partial Content
# content-range: bytes 0-1000/TOTAL_SIZE
# access-control-allow-origin: *
# access-control-expose-headers: Content-Range, ...
```

---

## ⚡ **Solução Temporária (se nada funcionar)**

O proxy já está configurado e funcionando! Deixe assim até resolver o CORS:

```typescript
// Está funcionando via proxy:
/api/videos/[id]/stream
```

**Vantagens do proxy:**
- ✅ Funciona 100%
- ✅ Sem configuração AWS
- ✅ Headers CORS garantidos

**Desvantagens:**
- ⚠️ Passa pelo servidor (consome banda)
- ⚠️ Latência extra (~100-300ms)

---

## 📊 **Comparação de Soluções**

| Solução | Performance | Setup | Custo Banda |
|---------|-------------|-------|-------------|
| **CloudFront + CORS** | ⚡⚡⚡ Excelente | ⚠️ Complexo (30 min) | ✅ Zero |
| **Proxy (atual)** | ⚡⚡ Boa | ✅ Pronto | ⚠️ Alto |

---

## 🎯 **Recomendação Final**

1. **Use o teste:** `/api/test-cors?url=...` para verificar
2. **Se CORS funcionar no teste mas não no site:**
   - Problema é no frontend (cache do navegador)
   - Solução: Hard refresh
3. **Se CORS não funcionar no teste:**
   - Configure CloudFront Response Headers Policy
   - Invalide cache
   - Aguarde propagação
4. **Se depois de 30 min ainda não funcionar:**
   - Continue com o proxy (está funcionando perfeitamente)
   - Tente resolver CORS depois com mais calma

---

**Data:** 23/11/2025  
**Status:** Proxy funcionando ✅ | CORS CloudFront em configuração ⏳

