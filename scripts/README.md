# 📜 Scripts de Manutenção

Scripts utilitários para manutenção e otimização da aplicação VibePhoto.

## 🎬 `reprocess-video-thumbnails.ts`

Reprocessa thumbnails de vídeo antigas para otimizá-las.

### **Uso:**

```bash
# 1. Simular o processamento (recomendado primeiro)
npx ts-node scripts/reprocess-video-thumbnails.ts --dry-run

# 2. Reprocessar thumbnails > 200KB
npx ts-node scripts/reprocess-video-thumbnails.ts

# 3. Limitar número de vídeos processados
npx ts-node scripts/reprocess-video-thumbnails.ts --limit=10

# 4. Forçar reprocessamento de todas as thumbnails
npx ts-node scripts/reprocess-video-thumbnails.ts --force

# 5. Alterar tamanho mínimo para reprocessamento
npx ts-node scripts/reprocess-video-thumbnails.ts --min-size=500
```

### **Opções:**

| Opção | Descrição | Padrão |
|-------|-----------|--------|
| `--dry-run` | Simula o processamento sem fazer alterações | `false` |
| `--limit=N` | Limita o número de vídeos processados | `unlimited` |
| `--force` | Reprocessa todas as thumbnails, independente do tamanho | `false` |
| `--min-size=N` | Define o tamanho mínimo (em KB) para reprocessamento | `200` |

### **Quando usar:**

- ✅ Após identificar thumbnails pesadas no Lighthouse
- ✅ Após implementar melhorias na otimização
- ✅ Durante manutenção periódica (mensal/trimestral)

### **Documentação completa:**

Veja `docs/VIDEO_THUMBNAIL_OPTIMIZATION.md` para mais detalhes.

---

## 📝 Como Criar Novos Scripts

### **Template:**

```typescript
/**
 * Script para [DESCRIÇÃO]
 * 
 * Uso:
 * ```bash
 * npx ts-node scripts/meu-script.ts [OPTIONS]
 * ```
 */

import { prisma } from '../src/lib/db'

async function meuScript(options: { dryRun?: boolean } = {}) {
  const { dryRun = false } = options

  console.log('🚀 Starting script...')

  try {
    // Sua lógica aqui
    if (dryRun) {
      console.log('⚠️ DRY RUN - no changes made')
      return
    }

    // Fazer alterações reais
    console.log('✅ Script completed successfully')

  } catch (error) {
    console.error('❌ Script failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Parse command line arguments
const args = process.argv.slice(2)
const options = {
  dryRun: args.includes('--dry-run')
}

// Run the script
meuScript(options)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
```

### **Boas Práticas:**

1. ✅ **Sempre implemente `--dry-run`** para simulação segura
2. ✅ **Adicione logging detalhado** com emojis para clareza
3. ✅ **Documente no README** com exemplos de uso
4. ✅ **Trate erros graciosamente** sem interromper todo o processamento
5. ✅ **Desconecte o Prisma** no `finally` block
6. ✅ **Use rate limiting** se processar muitos items (evitar sobrecarregar APIs/DB)

---

**Documentação atualizada em:** 23/11/2025

