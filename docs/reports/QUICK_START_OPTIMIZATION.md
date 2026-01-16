# 🚀 Guia Rápido: Otimização de Performance

## ⚡ Problema: Thumbnails de Vídeo Pesadas (7+ MB)

As thumbnails antigas estão muito pesadas (2-3 MB cada), impactando negativamente o score do Lighthouse.

## ✅ Solução Implementada

### **1. Novos Vídeos (Automático)**
✅ Todas as thumbnails geradas **A PARTIR DE AGORA** já são otimizadas automaticamente  
✅ Redução de **95%** no tamanho (de 2.5 MB → 50 KB)  
✅ Nenhuma ação necessária!

### **2. Vídeos Antigos (Reprocessamento)**

Execute o script para otimizar thumbnails antigas:

```bash
# Passo 1: Simulação (ver o que seria feito)
npm run optimize:thumbnails:dry

# Passo 2: Executar otimização real
npm run optimize:thumbnails

# Opcional: Forçar reprocessamento de TODAS as thumbnails
npm run optimize:thumbnails:force
```

## 📊 Resultado Esperado

### **ANTES:**
```
❌ Lighthouse Performance: 70-80
❌ Network Payloads: 7,136 KiB
❌ Thumbnail 1: 2,584 KB
❌ Thumbnail 2: 2,070 KB
❌ Thumbnail 3: 2,009 KB
```

### **DEPOIS:**
```
✅ Lighthouse Performance: 90+
✅ Network Payloads: < 500 KiB
✅ Thumbnail 1: 50 KB
✅ Thumbnail 2: 48 KB
✅ Thumbnail 3: 52 KB
```

## 🎯 Passo a Passo

### **1️⃣ Executar Simulação**

```bash
npm run optimize:thumbnails:dry
```

**Saída esperada:**
```
🎬 Starting video thumbnail reprocessing...
📹 Found 15 videos with thumbnails

[1/15] Processing video cmiapx53o0001l5041mqag9oq...
  📏 Current size: 2584 KB
  🔍 [DRY RUN] Would reprocess thumbnail (2584 KB → ~50 KB)

[2/15] Processing video cmf5gb7e60005qjk8...
  📏 Current size: 48 KB
  ✅ Already optimized (< 200 KB), skipping

============================================================
📊 REPROCESSING SUMMARY
============================================================
Total videos:     15
Processed:        8 ✅
Skipped:          7 ⏭️
Failed:           0 ❌

💾 Storage savings:
Before:           18 MB
After:            1 MB
Saved:            17 MB (94%)
============================================================

⚠️ This was a DRY RUN - no changes were made
Run without --dry-run to apply changes
```

### **2️⃣ Executar Otimização Real**

Se a simulação estiver OK, execute:

```bash
npm run optimize:thumbnails
```

**Tempo estimado:** ~1 segundo por vídeo  
**Exemplo:** 15 vídeos = ~15 segundos

### **3️⃣ Invalidar Cache do CloudFront**

Após o reprocessamento, invalide o cache:

```bash
# Via AWS CLI
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/generated/*/videos/*_thumbnail.jpg"
```

**OU** pelo console AWS:
1. CloudFront → Distributions
2. Selecionar sua distribuição
3. Invalidations → Create Invalidation
4. Path: `/generated/*/videos/*_thumbnail.jpg`

### **4️⃣ Validar com Lighthouse**

1. Abra DevTools (F12)
2. Lighthouse tab
3. Run audit
4. Verifique **"Avoid enormous network payloads"**

**Esperado:**
- ✅ Total < 500 KiB
- ✅ Thumbnails ~50 KB cada
- ✅ Performance Score: 90+

## 🛠️ Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run optimize:thumbnails:dry` | Simula otimização (seguro) |
| `npm run optimize:thumbnails` | Otimiza thumbnails > 200KB |
| `npm run optimize:thumbnails:force` | Força reprocessamento de TODAS |

## 📝 Opções Avançadas

```bash
# Limitar número de vídeos
npx ts-node scripts/reprocess-video-thumbnails.ts --limit=10

# Alterar tamanho mínimo
npx ts-node scripts/reprocess-video-thumbnails.ts --min-size=500

# Combinar opções
npx ts-node scripts/reprocess-video-thumbnails.ts --dry-run --limit=5
```

## ❓ FAQ

### **Q: É seguro executar em produção?**
✅ SIM! O script:
- Nunca deleta thumbnails antigas
- Cria novas versões otimizadas
- Atualiza o banco de dados apenas se upload for bem-sucedido
- Tem rate limiting (1 segundo entre vídeos)

### **Q: E se der erro?**
✅ Cada vídeo é processado independentemente
- Se um falhar, os outros continuam
- Logs detalhados para debugging
- Banco de dados só é atualizado se tudo der certo

### **Q: Posso cancelar no meio?**
✅ SIM! Ctrl+C cancela com segurança
- Vídeos já processados continuam otimizados
- Vídeos não processados mantêm thumbnail antiga
- Pode executar novamente depois

### **Q: Quanto tempo demora?**
⏱️ ~1 segundo por vídeo
- 10 vídeos = ~10 segundos
- 50 vídeos = ~50 segundos
- 100 vídeos = ~1.5 minutos

### **Q: Quanto espaço economiza?**
💾 ~95% de redução
- Antes: 2.5 MB por thumbnail
- Depois: 50 KB por thumbnail
- 100 vídeos: economiza ~240 MB!

## 🚨 Troubleshooting

### **Erro: FFmpeg not available**
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg
```

### **Erro: Sharp module not found**
```bash
npm install sharp
npm rebuild sharp
```

### **Thumbnails antigas ainda aparecem**
```bash
# Limpe o cache do navegador
# Ou invalide o CloudFront (passo 3)
```

## 📚 Documentação Completa

Veja `docs/VIDEO_THUMBNAIL_OPTIMIZATION.md` para:
- Detalhes técnicos da otimização
- Configuração avançada
- Troubleshooting completo
- Métricas e benchmarks

---

**Última atualização:** 23/11/2025  
**Performance target:** Score 90+ no Lighthouse  
**Economia de banda:** ~95% em thumbnails de vídeo

