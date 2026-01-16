# 🪣 Guia de Configuração do Bucket S3 - ensaio-fotos-prod

## ⚠️ PROBLEMA IDENTIFICADO
O upload para S3 está falhando desde 25/out/2025. Testes confirmam:
- ✅ Credenciais AWS válidas
- ✅ Downloads da Astria funcionando
- ❌ Upload para S3 falhando silenciosamente

## 📋 Configurações Necessárias no AWS S3

### 1. Bucket Policy (Política do Bucket)

Acesse: AWS Console → S3 → ensaio-fotos-prod → Permissions → Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::ensaio-fotos-prod/*"
    },
    {
      "Sid": "AllowVercelUpload",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/vibephoto-uploader"
      },
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::ensaio-fotos-prod/*"
    }
  ]
}
```

**OU** se usar a Access Key diretamente (mais simples):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::ensaio-fotos-prod/*"
    }
  ]
}
```

### 2. ACL (Access Control List)

Acesse: Permissions → Object Ownership

✅ **Configuração necessária:**
- Object Ownership: **ACLs enabled**
- Bucket owner preferred: **Enabled**

Ou alternativamente (recomendado):
- Object Ownership: **Bucket owner enforced**
  - Desabilita ACLs
  - Simplifica controle de acesso

### 3. Block Public Access

Acesse: Permissions → Block Public Access

**Para funcionamento correto:**
```
❌ Block all public access: OFF
   ❌ Block public access to buckets and objects granted through new access control lists (ACLs)
   ❌ Block public access to buckets and objects granted through any access control lists (ACLs)
   ❌ Block public access to buckets and objects granted through new public bucket or access point policies
   ❌ Block public and cross-account access to buckets and objects through any public bucket or access point policies
```

**⚠️ IMPORTANTE:** Todas essas opções devem estar **DESABILITADAS** para permitir acesso público às imagens.

### 4. CORS Configuration (Opcional - apenas para frontend)

Acesse: Permissions → Cross-origin resource sharing (CORS)

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": [
      "https://vibephoto.app",
      "https://www.vibephoto.app",
      "http://localhost:3000"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

**Nota:** CORS não afeta uploads do servidor (Vercel), apenas requisições do navegador.

### 5. IAM User Permissions (Para a Access Key)

Acesse: IAM → Users → vibephoto-uploader (ou usuário usado)

**Policy necessária:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ensaio-fotos-prod",
        "arn:aws:s3:::ensaio-fotos-prod/*"
      ]
    }
  ]
}
```

## 🔍 Verificação das Configurações

### Passo 1: Verificar Access Key ID

No código, a Access Key começa com: `AKIAVIADBE...`

Verifique no IAM:
1. IAM → Users → Encontre o usuário com essa Access Key
2. Verifique se o usuário tem as permissões acima
3. Verifique se a Access Key está **ativa**

### Passo 2: Testar Permissões

Use nossa rota de teste:
```
https://vibephoto.app/api/debug/test-aws-direct
```

Deve retornar:
```json
{
  "diagnosis": {
    "credentialsValid": true,
    "uploadPermission": true,
    "overallStatus": "✅ AWS S3 working"
  }
}
```

### Passo 3: Verificar Logs da Vercel

Acesse: Vercel Dashboard → Functions → `/api/webhooks/astria`

Procure por:
- `❌ Error name:`
- `❌ Error message:`
- `❌ Error stack:`

Erros comuns:
- `AccessDenied` → Falta permissão no IAM ou Bucket Policy
- `NoSuchBucket` → Nome do bucket incorreto
- `InvalidAccessKeyId` → Access Key inválida ou expirada
- `SignatureDoesNotMatch` → Secret Key incorreta
- `RequestTimeout` → Timeout da Vercel (10s)

## 🛠️ Solução Mais Provável

Baseado no problema (funcionava até 25/out e parou):

**Hipótese 1: Access Key Rotacionada**
- AWS pode ter rotacionado a Access Key automaticamente
- Solução: Gerar nova Access Key e atualizar no Vercel

**Hipótese 2: Política do Bucket Alterada**
- Alguém mudou as configurações do bucket
- Solução: Restaurar configurações acima

**Hipótese 3: ACL Desabilitado**
- AWS mudou para "Bucket owner enforced" (desabilita ACLs)
- Código tenta definir ACL `public-read`
- Solução: Remover ACL do código OU habilitar ACLs

## ⚡ Ação Imediata

1. **Verificar Object Ownership:**
   ```
   S3 → ensaio-fotos-prod → Permissions → Object Ownership
   ```

   Se estiver em **"Bucket owner enforced"**, o código está falhando ao tentar definir ACL.

   **Solução rápida:** Mudar para **"ACLs enabled"** + **"Bucket owner preferred"**

2. **Verificar Block Public Access:**
   ```
   S3 → ensaio-fotos-prod → Permissions → Block Public Access
   ```

   Todas as opções devem estar **DESABILITADAS**.

3. **Após mudanças, testar:**
   ```
   https://vibephoto.app/api/debug/test-aws-direct
   ```

## 📞 Próximos Passos

Após verificar/corrigir as configurações acima:

1. Teste novamente com a rota de debug
2. Faça uma nova geração de teste
3. Verifique se agora salva no S3:
   ```
   https://vibephoto.app/api/debug/check-user-generations?email=tainabuenojg@gmail.com
   ```

Se ainda falhar, compartilhe os logs da Vercel para análise mais profunda.
