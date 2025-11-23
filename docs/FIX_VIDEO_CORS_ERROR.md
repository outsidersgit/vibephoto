# 🎬 Correção: Erro CORS ao Reproduzir Vídeos

## 🔍 **Problema**

Ao tentar reproduzir vídeos, o navegador mostra:
```
Access to video at 'https://d2df849qfdugnh.cloudfront.net/...' has been blocked by CORS policy
```

**Causa:** CloudFront/S3 não está enviando os headers CORS necessários para permitir o acesso ao vídeo.

---

## ✅ **Solução Implementada: Proxy Automático com Fallback**

O sistema agora tenta carregar o vídeo diretamente do CloudFront/S3, mas se houver erro de CORS, **automaticamente faz fallback para um proxy** que adiciona os headers CORS corretos.

### **Como funciona:**

1. ✅ **Primeira tentativa:** Carrega vídeo direto do CloudFront (rápido, sem consumo de banda do servidor)
2. ❌ **Se falhar:** Detecta erro CORS automaticamente
3. 🔄 **Fallback:** Recarrega vídeo através do proxy `/api/videos/[id]/stream`
4. ✅ **Proxy adiciona headers CORS** e faz streaming progressivo

**Vantagens:**
- ✅ Funciona **imediatamente** sem configuração extra
- ✅ Fallback automático e transparente para o usuário
- ✅ Streaming progressivo (HTTP 206) funcionando corretamente
- ✅ Suporte a Range requests para seek no vídeo

---

## 🚀 **Solução Definitiva: Configurar CORS no S3/CloudFront**

Para **melhor performance** e evitar o proxy, configure CORS diretamente no S3:

### **1. Configurar CORS no S3**

1. Acesse: https://s3.console.aws.amazon.com/
2. Clique no bucket `vibephoto-images`
3. Vá em **"Permissions"** → **"Cross-origin resource sharing (CORS)"**
4. Clique em **"Edit"** e cole:

```json
[
  {
    "AllowedHeaders": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedOrigins": [
      "https://vibephoto.app",
      "https://*.vibephoto.app",
      "http://localhost:3000",
      "https://*.vercel.app"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Range",
      "Accept-Ranges"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

5. Clique em **"Save changes"**

**Por que `ExposeHeaders` é importante?**
- `Content-Range` e `Accept-Ranges` são **essenciais** para streaming de vídeo
- Permitem HTTP 206 (Partial Content) para seek e buffering progressivo

---

### **2. Configurar CloudFront (se estiver usando)**

1. Acesse: https://console.aws.amazon.com/cloudfront/
2. Clique na sua distribuição
3. Vá em **"Behaviors"** → **"Edit"**
4. Configure:
   - **Origin request policy:** `CORS-S3Origin` ou `CORS-CustomOrigin`
   - **Response headers policy:** `SimpleCORS` ou crie custom:
     - Access-Control-Allow-Origin: *
     - Access-Control-Allow-Methods: GET, HEAD
     - Access-Control-Allow-Headers: *
     - Access-Control-Expose-Headers: Content-Range, Accept-Ranges, Content-Length, ETag
5. Clique em **"Save changes"**
6. **Aguarde 10-15 minutos** para propagar

---

### **3. Testar Configuração CORS**

```bash
# Testar headers CORS
curl -I -H "Origin: https://vibephoto.app" \
  "https://d2df849qfdugnh.cloudfront.net/generated/USER_ID/videos/VIDEO.mp4"

# Deve retornar:
# HTTP/2 206
# access-control-allow-origin: https://vibephoto.app
# access-control-expose-headers: Content-Range, Accept-Ranges
# content-range: bytes 0-...
# accept-ranges: bytes
```

---

## 📊 **Comparação: Proxy vs CORS Direto**

| Aspecto | Proxy (Atual) | CORS Direto (Ideal) |
|---------|---------------|---------------------|
| Performance | ⚠️ Boa (passa pelo servidor) | ✅ Excelente (direto do CDN) |
| Latência | ~100-300ms extra | ~50ms (CDN) |
| Consumo Banda Servidor | ⚠️ Alto | ✅ Zero |
| Setup | ✅ Já configurado | ⚠️ Requer config AWS |
| Funcionamento | ✅ Imediato | ✅ Após configuração |

**Recomendação:** Use o proxy como solução temporária, mas configure CORS no S3/CloudFront para melhor performance.

---

## 🔧 **Arquivos Modificados**

### **Proxy Backend**
- `src/app/api/videos/[id]/stream/route.ts` - Proxy para streaming com CORS

### **Frontend**
- `src/components/gallery/video-modal.tsx` - Fallback automático para proxy

---

## 🧪 **Como Testar**

1. **Abrir modal de vídeo** na galeria
2. **Verificar console do navegador:**
   - Se carregar diretamente: `✅ Video can play (using proxy: false)`
   - Se usar proxy: `🔄 Trying proxy fallback...` → `✅ Video can play (using proxy: true)`
3. **Testar seek/scrub** na barra de progresso
4. **Testar download** do vídeo

---

## ❓ **FAQ**

### **Por que o erro acontece?**
Browsers modernos exigem headers CORS para acessar recursos de outro domínio (CloudFront ≠ vibephoto.app).

### **Por que vídeos e não imagens?**
Vídeos usam Range Requests (HTTP 206) para streaming progressivo, que requer headers CORS especiais (`Content-Range`, `Accept-Ranges`).

### **O proxy consome muita banda?**
Sim. Por isso a configuração CORS direta é recomendada para produção.

### **Posso desabilitar o proxy?**
Sim, após configurar CORS no S3/CloudFront, o proxy não será mais usado (fallback só acontece em erro).

---

## 📝 **Próximos Passos**

- [ ] Configurar CORS no S3 bucket
- [ ] Configurar Response Headers Policy no CloudFront
- [ ] Testar reprodução de vídeos
- [ ] Monitorar uso do proxy (deve diminuir após config CORS)
- [ ] Considerar remover proxy após 100% dos vídeos carregarem direto

---

**Data da implementação:** 23/11/2025
**Status:** ✅ Proxy funcional | ⏳ CORS AWS pendente

