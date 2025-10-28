# 🔍 Guia de Diagnóstico - Problemas com Salvamento de Imagens

## Problema Relatado
Gerações estão sendo cobradas (créditos deduzidos), mas as imagens não estão sendo salvas no banco de dados nem disponibilizadas na galeria.

## 📊 Rotas de Diagnóstico Criadas

### 1. Verificar Gerações do Usuário

**URL:** `https://vibephoto-delta.vercel.app/api/debug/check-user-generations?email=tainabuenojg@gmail.com`

**O que verifica:**
- ✅ Todas as gerações recentes do usuário (últimas 10)
- ✅ Status de cada geração
- ✅ Se imagens foram salvas
- ✅ Se URLs são do S3 (permanentes) ou Astria (temporárias)
- ✅ **CRÍTICO:** Créditos cobrados sem imagens salvas

**Resposta esperada:**
```json
{
  "user": {
    "id": "...",
    "email": "tainabuenojg@gmail.com",
    "credits": 990,
    "creditsUsed": 10
  },
  "totalGenerations": 5,
  "generations": [
    {
      "id": "...",
      "status": "COMPLETED",
      "imageCount": 0,
      "creditsUsed": 10,
      "problems": [
        "🔴 CRITICAL: Credits charged but no images saved!",
        "❌ Status COMPLETED but no imageUrls"
      ]
    }
  ],
  "summary": {
    "critical": 1,
    "usingAstriaUrls": 0,
    "usingS3": 0
  }
}
```

### 2. Verificar Geração Específica

**URL:** `https://vibephoto-delta.vercel.app/api/debug/webhook-logs?generationId=GEN_ID`

**O que verifica:**
- ✅ Detalhes completos da geração
- ✅ Análise de cada URL de imagem
- ✅ Configuração de S3 (AWS)
- ✅ Configuração de Webhook (Astria)
- ✅ Diagnóstico automático de problemas

**Resposta esperada:**
```json
{
  "generation": {
    "id": "...",
    "status": "COMPLETED",
    "imageUrls": [],
    "creditsUsed": 10
  },
  "images": {
    "count": 0,
    "urls": [],
    "allInS3": false,
    "hasAstriaUrls": false
  },
  "diagnosis": {
    "storageIssue": true,
    "webhookConfigured": true,
    "s3Configured": true
  },
  "config": {
    "storage": {
      "AWS_REGION": "us-east-2",
      "AWS_S3_BUCKET": "ensaio-fotos-prod",
      "AWS_ACCESS_KEY_ID": "✅ SET",
      "AWS_SECRET_ACCESS_KEY": "✅ SET"
    },
    "webhook": {
      "ASTRIA_WEBHOOK_URL": "https://vibephoto-delta.vercel.app/api/webhooks/astria",
      "ASTRIA_WEBHOOK_SECRET": "✅ SET"
    }
  }
}
```

## 🔎 Possíveis Causas Identificadas

### Cenário 1: Webhook não está sendo chamado
**Sintomas:**
- Geração fica com status `PROCESSING` indefinidamente
- Créditos deduzidos mas imagens nunca aparecem

**Verificação:**
```bash
# Verificar logs da Vercel para webhooks Astria
# Buscar por: "POST /api/webhooks/astria"
```

**Solução:**
- Verificar se webhook está configurado na Astria
- Verificar se URL está correta: `https://vibephoto-delta.vercel.app/api/webhooks/astria`
- Verificar se `ASTRIA_WEBHOOK_SECRET` está correto

### Cenário 2: Webhook é chamado mas S3 falha
**Sintomas:**
- Geração muda para `COMPLETED`
- `imageUrls` contém URLs da Astria (temporárias)
- URLs começam com `https://sdbooth2-production.s3.amazonaws.com/`

**Verificação:**
```typescript
// Logs do webhook devem mostrar:
"💾 Storing images permanently for generation: GEN_ID"
"⚠️ Storage failed, keeping original URLs: ERROR"
```

**Solução:**
- Verificar credenciais AWS no Vercel
- Verificar permissões do bucket S3
- Verificar se região está correta (`us-east-2`)

### Cenário 3: Webhook é chamado mas imageUrls vazio
**Sintomas:**
- Geração muda para `COMPLETED`
- `imageUrls` está vazio `[]`
- Créditos deduzidos

**Verificação:**
```typescript
// Webhook recebe payload da Astria sem images
{
  "id": 123456,
  "status": "completed",
  "images": []  // ❌ Vazio!
}
```

**Solução:**
- Verificar resposta da API Astria
- Verificar se geração realmente completou com sucesso
- Pode ser erro na Astria (não nossa responsabilidade)

### Cenário 4: Geração nunca inicia
**Sintomas:**
- Créditos deduzidos imediatamente
- Geração nem aparece no banco
- Ou aparece mas sem `externalId`

**Verificação:**
```typescript
// Logs da API de geração devem mostrar:
"Creating generation with Astria..."
"Astria generation created with ID: 123456"
```

**Solução:**
- Verificar logs de criação da geração
- Verificar se API da Astria está respondendo
- Verificar se `ASTRIA_API_KEY` está correto

## 🛠️ Como Usar Este Diagnóstico

### Passo 1: Executar diagnóstico geral
```bash
# Abrir no navegador:
https://vibephoto-delta.vercel.app/api/debug/check-user-generations?email=tainabuenojg@gmail.com
```

### Passo 2: Identificar geração problemática
- Procurar por gerações com `"problems": ["🔴 CRITICAL: ...]`
- Copiar o `id` da geração

### Passo 3: Analisar geração específica
```bash
# Substituir GEN_ID pelo ID copiado:
https://vibephoto-delta.vercel.app/api/debug/webhook-logs?generationId=GEN_ID
```

### Passo 4: Verificar logs da Vercel
1. Acessar Vercel Dashboard
2. Ir em "Deployments" > "Functions"
3. Buscar por `/api/webhooks/astria` ou `/api/ai/generate`
4. Verificar erros e warnings

### Passo 5: Verificar configurações
Comparar configurações retornadas pelo diagnóstico com variáveis de ambiente no Vercel:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `ASTRIA_WEBHOOK_URL`
- `ASTRIA_WEBHOOK_SECRET`

## 📝 Próximos Passos

Após executar o diagnóstico, compartilhe:
1. URL do diagnóstico geral
2. ID da geração problemática
3. Resultado do diagnóstico específico
4. Screenshots dos logs da Vercel (se possível)

Com essas informações, podemos identificar a causa exata e implementar a correção apropriada.

## 🚨 Ação Imediata

Para a geração que cobrou créditos mas não salvou imagens:
1. Identificar o ID da geração
2. Verificar se imagens ainda estão disponíveis na Astria
3. Se sim, executar rota de recuperação manual
4. Se não, reembolsar créditos ao usuário

```bash
# Reembolso de créditos (criar rota se necessário):
POST /api/admin/refund-credits
{
  "userId": "USER_ID",
  "credits": 10,
  "reason": "Generation failed - images not saved"
}
```
