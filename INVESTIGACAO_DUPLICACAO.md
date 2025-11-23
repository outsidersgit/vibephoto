# 🔍 Investigação: Duplicação de Gerações no Banco

## Problema Reportado
- Registros duplicados aparecendo na galeria
- Um deles com tag "[GERANDO]" no prompt
- Ambos em estado PROCESSING infinito
- Não desaparecem após geração completar

## Verificações Necessárias

### 1. Verificar Banco de Dados
Execute no Prisma Studio ou SQL:

```sql
SELECT 
  id, 
  prompt, 
  status, 
  "jobId",
  "createdAt", 
  "updatedAt",
  metadata
FROM "Generation" 
WHERE "userId" = 'cmf3555br0004qjk80pe9dhqr'
  AND "createdAt" > NOW() - INTERVAL '2 hours'
ORDER BY "createdAt" DESC, "prompt" ASC;
```

**Pergunta:** Existem múltiplos registros com:
- ✅ IDs diferentes?
- ✅ Mesmo prompt (ou um com "[GERANDO]" prefixo)?
- ✅ Mesma data de criação (±1 minuto)?

### 2. Verificar Logs do Console
Durante a próxima geração, observar:

```
🎨 Starting generation for model...
📝 Created generation record: [ID]
💾 About to update database with job ID: [JOB_ID]
🔍 [POLLING] Fetching status for generation: [ID]
```

**Pergunta:** Aparece dois "Created generation record" com IDs diferentes?

### 3. Verificar React Strict Mode
Em `next.config.js` ou `next.config.mjs`, procurar:

```js
reactStrictMode: true
```

**Ação:** Se estiver em DEV, é esperado ver componentes renderizarem 2x.

### 4. Verificar Múltiplos Cliques
**Pergunta:** Você clicou no botão "Gerar" múltiplas vezes?

## Possíveis Causas Identificadas

### A. React Strict Mode (DEV only)
- **Sintoma:** Duplicação apenas em desenvolvimento
- **Causa:** React renderiza componentes 2x para detectar side effects
- **Solução:** Normal em DEV, não acontece em PROD

### B. Invalidação de Cache Excessiva
- **Sintoma:** Placeholders aparecem/desaparecem rapidamente
- **Causa:** Múltiplos `queryClient.invalidateQueries(['gallery'])`
- **Solução:** Já implementada limpeza automática

### C. Race Condition (Polling + SSE + Webhooks)
- **Sintoma:** 3 sistemas atualizando simultaneamente
- **Causa:** Polling, SSE e Webhooks processando a mesma geração
- **Solução:** Já implementada limpeza automática + deduplicação

### D. Problema no Fluxo de Criação
- **Sintoma:** Dois registros realmente criados no banco
- **Causa:** Hook ou API sendo chamada 2x
- **Solução:** Precisa confirmação via logs

## Solução Implementada

### 1. Limpeza Automática de Duplicados
**Arquivo:** `src/lib/db/cleanup-duplicates.ts`

Quando uma geração COMPLETA:
1. Busca gerações em PROCESSING
2. Compara: userId + prompt + modelId + createdAt (±1 min)
3. Deleta automaticamente os duplicados

### 2. Integração no Webhook
**Arquivo:** `src/app/api/webhooks/replicate/route.ts`

Executa limpeza após storage bem-sucedido.

## Próximos Passos

1. **Testar nova geração** e observar:
   - Aparece placeholder?
   - Desaparece quando completa?
   - Aparecem duplicados?

2. **Verificar logs do console** para:
   - Mensagens de cleanup: `🧹 [CLEANUP] Found X duplicate...`
   - Múltiplas criações: Dois `📝 Created generation record`

3. **Reportar resultado**:
   - Duplicação resolvida? ✅
   - Ainda aparece? ❌ (enviar logs)
   - Aparece apenas em DEV? (React Strict Mode)

## Logs Úteis para Debugging

```bash
# Ver gerações recentes do usuário
grep "Created generation record" logs | tail -20

# Ver limpeza de duplicados
grep "CLEANUP" logs | tail -10

# Ver invalidações de cache
grep "Invalidating cache" logs | tail -20
```

