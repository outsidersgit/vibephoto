# 🔍 Como Verificar Status de Pacotes e Gerações

## 📋 Passo a Passo

### 1. Encontrar o ID do Pacote Recente

Execute primeiro `find-recent-packages.sql` para listar os pacotes mais recentes:

```sql
-- Copie e cole no Supabase SQL Editor
-- Isso vai mostrar os últimos 10 pacotes criados
```

**Resposta esperada:**
- Lista de pacotes com `user_package_id`, `package_name`, `status`, `totalImages`, `generatedImages`, etc.
- Anote o `user_package_id` do pacote que você quer verificar

### 2. Verificar Status Completo do Pacote

Execute `check-package-status.sql` substituindo `'SEU_USER_PACKAGE_ID'` pelo ID real.

**Query 1 - Status do UserPackage:**
```sql
SELECT * FROM user_packages WHERE id = 'SEU_USER_PACKAGE_ID';
```

**Resposta esperada (SUCESSO):**
```
status: 'COMPLETED' ou 'GENERATING'
generatedImages: número de imagens completadas (ex: 3)
failedImages: número de falhas (ex: 0)
completedAt: data/hora quando completou (se COMPLETED)
```

**Resposta esperada (PROBLEMA):**
```
status: 'GENERATING' (mas deveria ser COMPLETED)
generatedImages: 0 (mas deveria ter imagens)
completedAt: null (deveria ter data)
```

### 3. Verificar Gerações Individuais

**Query 2 - Lista de Gerações:**
```sql
SELECT id, status, imageUrls, metadata->>'webhookProcessed', metadata->>'stored'
FROM generations
WHERE metadata->>'userPackageId' = 'SEU_USER_PACKAGE_ID';
```

**Resposta esperada (SUCESSO):**
```
Para cada geração:
- status: 'COMPLETED'
- imageUrls: ['https://...', 'https://...'] (URLs permanentes S3)
- webhook_processed: 'true'
- stored: 'true'
- permanentUrls: ['https://...'] (no metadata)
```

**Resposta esperada (PROBLEMA):**
```
- status: 'PROCESSING' ou 'PENDING' (deveria ser COMPLETED)
- imageUrls: null ou [] (deveria ter URLs)
- webhook_processed: null ou 'false' (deveria ser 'true')
- stored: null ou 'false' (deveria ser 'true')
```

### 4. Contar Gerações por Status

**Query 3 - Contagem:**
```sql
SELECT status, COUNT(*) as count
FROM generations
WHERE metadata->>'userPackageId' = 'SEU_USER_PACKAGE_ID'
GROUP BY status;
```

**Resposta esperada (SUCESSO):**
```
COMPLETED: 3 (ou número esperado)
FAILED: 0
PENDING: 0
PROCESSING: 0
```

**Resposta esperada (PROBLEMA):**
```
COMPLETED: 0 (nenhuma completou)
PROCESSING: 3 (todas ainda processando)
ou
PENDING: 3 (nenhuma iniciou)
```

## 🚨 Problemas Comuns e O Que Significam

### Problema 1: `status = 'GENERATING'` mas gerações estão `COMPLETED`
- **Causa:** Reconciliação não foi executada ou falhou
- **Solução:** Verificar logs do webhook, pode ter erro na reconciliação

### Problema 2: `imageUrls = null` ou `[]` mas `status = 'COMPLETED'`
- **Causa:** Webhook não salvou as URLs ou storage falhou
- **Solução:** Verificar logs do storage no Vercel

### Problema 3: `webhook_processed = null` ou `'false'`
- **Causa:** Webhook não foi executado ou falhou antes de atualizar
- **Solução:** Verificar logs do webhook no Vercel

### Problema 4: `stored = 'false'` ou `null`
- **Causa:** Storage falhou ou não foi executado
- **Solução:** Verificar logs do storage, pode ser problema de permissões S3

## 📊 Exemplo de Resposta Correta

```sql
-- UserPackage
status: 'COMPLETED'
generatedImages: 3
failedImages: 0
completedAt: '2025-11-20 00:30:00'

-- Generations (3 registros)
Geração 1:
  status: 'COMPLETED'
  imageUrls: ['https://bucket.s3.amazonaws.com/generated/.../image1.jpg']
  webhook_processed: 'true'
  stored: 'true'

Geração 2:
  status: 'COMPLETED'
  imageUrls: ['https://bucket.s3.amazonaws.com/generated/.../image2.jpg']
  webhook_processed: 'true'
  stored: 'true'

Geração 3:
  status: 'COMPLETED'
  imageUrls: ['https://bucket.s3.amazonaws.com/generated/.../image3.jpg']
  webhook_processed: 'true'
  stored: 'true'
```

