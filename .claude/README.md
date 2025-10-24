# Sistema Multi-Agent - Ensaio Fotos

## Visão Geral

Sistema organizado de agentes especializados para gestão coordenada do projeto Ensaio Fotos - SaaS de geração de imagens AI.

## Estrutura de Arquivos

```
.claude/
├── TASK.md                           # Contexto principal e coordenação
├── README.md                         # Este arquivo
├── agents/                           # Documentação dos agentes
│   ├── replicate.md                  # Especialista em AI (Replicate)
│   ├── asaas.md                      # Especialista em Pagamentos
│   └── vercel.md                     # Especialista em Deploy/Infra
└── docs/                             # Documentação e logs
    ├── README.md                     # Índice da documentação
    ├── architecture/                 # Arquitetura do sistema
    │   └── system-overview.md        # Visão geral técnica
    ├── workflows/                    # Processos e procedimentos
    │   ├── agent-workflow-template.md # Template para workflows
    │   └── agent-coordination-workflow.md # Coordenação entre agentes
    └── logs/                         # Logs organizados por agente
```

## Agentes Especializados

### 🤖 Replicate Agent
- **Arquivo**: `agents/replicate.md`
- **Responsabilidade**: Treinamento de modelos AI, geração de imagens, webhooks
- **APIs**: Replicate API, processamento de imagens
- **Status**: ✅ Operacional

### 💳 Asaas Agent
- **Arquivo**: `agents/asaas.md`  
- **Responsabilidade**: Processamento de pagamentos, billing, assinaturas
- **APIs**: Asaas API (PIX, cartão, boleto), webhooks de pagamento
- **Status**: ✅ Operacional

### 🚀 Vercel Agent
- **Arquivo**: `agents/vercel.md`
- **Responsabilidade**: Deploy, monitoramento, performance, CI/CD
- **APIs**: Vercel API, métricas de performance
- **Status**: ✅ Operacional

## Protocolo de Workflow

### Para Agentes (IA/Claude):
1. **SEMPRE ler `TASK.md`** antes de iniciar qualquer trabalho
2. **Atualizar arquivo específico** do agente após mudanças
3. **Sincronizar contexto** no `TASK.md` após completar tarefas
4. **Documentar eventos críticos** em `/docs/logs/`
5. **Seguir workflows** documentados em `/docs/workflows/`

### Coordenação:
- **Single Source of Truth**: `TASK.md` mantém estado global
- **Agent Autonomy**: Cada agente gerencia seu domínio
- **Cross-Dependencies**: Documentadas nos arquivos de agente
- **Conflict Resolution**: Priority baseada em criticidade do sistema

## Como Usar

### Para Desenvolvedores:
```bash
# Verificar status do sistema
cat .claude/TASK.md

# Ver documentação de agente específico  
cat .claude/agents/replicate.md

# Consultar workflow específico
cat .claude/docs/workflows/agent-coordination-workflow.md
```

### Para Agentes IA:
1. Leia `TASK.md` para contexto atual
2. Identifique seu papel (Replicate/Asaas/Vercel)
3. Consulte sua documentação específica
4. Execute tarefas conforme workflows documentados
5. Atualize contextos após mudanças

## Comandos Essenciais

### Sistema
```bash
npm run dev          # Desenvolvimento local
npm run build        # Build para produção  
npm run lint         # Verificar código
npx prisma studio    # GUI do banco
```

### Monitoramento
- **Health**: http://localhost:3000/api/health
- **Admin**: http://localhost:3000/admin/monitoring
- **Metrics**: http://localhost:3000/api/monitoring/metrics

## Alertas e Status

### 🟢 Normal
- Todos os sistemas operacionais
- Agentes sincronizados
- Sem alertas críticos

### 🟡 Atenção  
- Performance degradada
- Limites próximos do máximo
- Sincronização pendente

### 🔴 Crítico
- Falha de sistema principal
- Perda de sincronização entre agentes
- Indisponibilidade de serviço

## Contatos de Emergência

### Escalação por Sistema:
- **AI/Replicate Issues**: Consultar `agents/replicate.md`
- **Payment Issues**: Consultar `agents/asaas.md`  
- **Deployment Issues**: Consultar `agents/vercel.md`
- **System-wide**: Analisar `TASK.md` + logs

### Recursos Externos:
- **Replicate Status**: https://status.replicate.com
- **Asaas Status**: https://status.asaas.com
- **Vercel Status**: https://vercel-status.com

---

**Sistema criado**: 2025-08-21
**Última atualização**: 2025-08-21  
**Versão**: 1.0
**Maintainers**: Sistema Multi-Agent