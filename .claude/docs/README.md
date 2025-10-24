# Documentação do Sistema Multi-Agent

Esta pasta contém documentação oficial, logs e recursos para o sistema multi-agent.

## Estrutura

### 📁 `/architecture`
Documentação técnica da arquitetura do sistema:
- Diagramas de componentes
- Fluxos de dados
- Integrações entre serviços
- Schemas de banco de dados

### 📁 `/workflows`  
Documentação de processos e workflows:
- Fluxos de desenvolvimento
- Processos de deploy
- Workflows de negócio
- Procedimentos de debug

### 📁 `/logs`
Logs organizados por agente e período:
- Logs de deploy (Vercel Agent)
- Logs de pagamentos (Asaas Agent)  
- Logs de AI operations (Replicate Agent)
- System logs gerais

## Convenções

### Nomenclatura de Arquivos
```
YYYY-MM-DD_agent-name_action-type.md
2025-08-21_replicate_training-optimization.md
```

### Templates Disponíveis
- `workflow-template.md` - Para documentar novos workflows
- `architecture-template.md` - Para documentar componentes
- `log-template.md` - Para estruturar logs importantes

## Acesso Rápido

### Documentação Crítica
- [Sistema de Agentes](../TASK.md) - Contexto principal
- [Replicate Agent](../agents/replicate.md) - Especialista em AI
- [Asaas Agent](../agents/asaas.md) - Especialista em Pagamentos  
- [Vercel Agent](../agents/vercel.md) - Especialista em Deploy

### Logs Importantes
- Falhas de webhook
- Erros de treinamento de IA
- Problemas de deploy
- Issues de pagamento

### Workflows Críticos
- Pipeline de treinamento de modelo
- Fluxo de pagamento e upgrade
- Processo de deploy para produção
- Recuperação de desastres

---

**Mantido por**: Sistema Multi-Agent
**Última atualização**: 2025-08-21