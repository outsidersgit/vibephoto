# TASK.md - Sistema Multi-Agent Principal

## Status do Sistema
- **Status Geral**: Operacional
- **Ambiente Ativo**: Desenvolvimento Local
- **Última Atualização**: 2025-08-21

## Arquitetura do Sistema

### Componentes Principais
- **Frontend**: Next.js 15.4.6 + TypeScript + TailwindCSS
- **Backend**: API Routes do Next.js
- **Database**: PostgreSQL (Supabase)
- **Authentication**: NextAuth.js
- **Storage**: Configurável (AWS S3, Cloudinary, Local)
- **AI Provider**: Configurável (Replicate, RunPod, Local mock)
- **Payments**: Asaas (mercado brasileiro)

### Módulos Ativos
- ✅ Sistema de Autenticação (NextAuth.js)
- ✅ Sistema de Créditos e Planos
- ✅ Upload e Processamento de Arquivos
- ✅ Integração com Replicate (AI)
- ✅ Sistema de Pagamentos Asaas
- ✅ Rate Limiting e Segurança
- ✅ Monitoring e Health Checks

## Agentes Especializados

### 🤖 Replicate Agent
- **Arquivo**: `.claude/agents/replicate.md`
- **Responsabilidade**: Treinamento de modelos AI, geração de imagens
- **Status**: Configurado e operacional
- **Último Update**: -

### 💳 Asaas Agent  
- **Arquivo**: `.claude/agents/asaas.md`
- **Responsabilidade**: Processamento de pagamentos, webhooks, billing
- **Status**: Configurado e operacional
- **Último Update**: -

### 🚀 Vercel Agent
- **Arquivo**: `.claude/agents/vercel.md`
- **Responsabilidade**: Deploy, configuração de produção, CI/CD
- **Status**: Configurado e operacional
- **Último Update**: -

## Próximas Ações Prioritárias

### Imediatas (Hoje)
- [ ] Documentar configuração atual dos agentes
- [ ] Verificar integridade dos webhooks em produção
- [ ] Monitorar performance do sistema de créditos

### Curto Prazo (Esta Semana)
- [ ] Otimizar performance do sistema de upload
- [ ] Implementar logs estruturados para debugging
- [ ] Revisar limites de rate limiting

### Médio Prazo (Este Mês)
- [ ] Implementar cache para requests do Replicate
- [ ] Melhorar UX do processo de treinamento
- [ ] Adicionar métricas avançadas de monitoring

## Histórico de Mudanças

### 2025-08-21
- ✅ Criação do sistema multi-agent
- ✅ Estruturação de arquivos de contexto
- ✅ Templates para documentação de agentes

## Configuração de Ambiente

### Desenvolvimento Local
```env
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
NEXTAUTH_SECRET="dev-secret-key-for-local-development-only"
NEXTAUTH_URL="http://localhost:3000"
STORAGE_PROVIDER="local"
AI_PROVIDER="local"
```

### Produção (Vercel)
```env
DATABASE_URL="[supabase-production-url]"
NEXTAUTH_SECRET="[secure-production-secret]"
NEXTAUTH_URL="https://[your-vercel-app].vercel.app"
STORAGE_PROVIDER="aws"
AI_PROVIDER="replicate"
ASAAS_ENVIRONMENT="production"
```

## Comandos Essenciais

### Desenvolvimento
```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build para produção
npm run lint         # Verificar código
npx prisma generate  # Gerar cliente Prisma
npx prisma studio    # GUI do banco de dados
```

### Monitoramento
- Health Check: `GET /api/health`
- Métricas: `GET /api/monitoring/metrics`
- Admin Security: `/admin/security`
- Admin Monitoring: `/admin/monitoring`

## Notas Importantes

### Para Agentes
1. **SEMPRE ler este arquivo antes de trabalhar**
2. **Atualizar seu arquivo específico após mudanças**
3. **Sincronizar mudanças importantes aqui**
4. **Manter histórico atualizado**

### Alertas de Sistema
- 🔴 **Crítico**: Falhas que afetam funcionalidade principal
- 🟡 **Atenção**: Performance degradada ou limites próximos
- 🟢 **Normal**: Sistema operando dentro dos parâmetros

---

**Última verificação automática**: -
**Próxima verificação programada**: -