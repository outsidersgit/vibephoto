# Agent Coordination Workflow

## Workflow: Multi-Agent Task Coordination

### Descrição
Este workflow define como os agentes especializados coordenam suas atividades, compartilham contexto e mantêm sincronização durante execução de tarefas complexas.

### Agente Responsável
- **Agente Principal**: System Coordinator (implementado via TASK.md)
- **Agentes Colaboradores**: Replicate, Asaas, Vercel Agents

### Pré-requisitos
- [ ] Arquivo TASK.md atualizado e acessível
- [ ] Arquivos de agente (.claude/agents/*.md) existem
- [ ] Sistema de logs funcionando
- [ ] Comunicação entre agentes habilitada

### Etapas do Workflow

#### 1. Task Assignment
**Descrição**: Sistema identifica tarefa e determina agente responsável
**Tempo Esperado**: < 1min
**Agente**: System Coordinator
**Dependências**: Análise da natureza da tarefa

```bash
# Análise de tarefa exemplo
if (task.involves("ai", "training", "generation")) {
  assignTo: "replicate-agent"
} else if (task.involves("payment", "billing", "subscription")) {
  assignTo: "asaas-agent"  
} else if (task.involves("deploy", "performance", "infrastructure")) {
  assignTo: "vercel-agent"
}
```

**Validação**: Agente apropriado identificado e disponível
**Rollback**: Reatribuir para agente generalista se especialista não disponível

#### 2. Context Reading
**Descrição**: Agente designado lê contexto atual do sistema
**Tempo Esperado**: < 30seg
**Agente**: Agente Designado
**Dependências**: TASK.md atualizado

```bash
# Sequência de leitura obrigatória
1. Ler .claude/TASK.md (contexto geral)
2. Ler .claude/agents/{agent-name}.md (contexto específico)
3. Verificar dependências de outros agentes
4. Checar logs recentes relevantes
```

**Validação**: Contexto compreendido, dependências identificadas
**Rollback**: Solicitar atualização de contexto se informações desatualizadas

#### 3. Task Execution Planning
**Descrição**: Agente planeja execução considerando dependências e recursos
**Tempo Esperado**: 2-5min
**Agente**: Agente Designado
**Dependências**: Contexto completo, recursos disponíveis

**Validação**: Plano detalhado criado com checkpoints claros
**Rollback**: Replanejar se recursos insuficientes ou conflitos detectados

#### 4. Cross-Agent Coordination
**Descrição**: Coordenação com outros agentes se necessário
**Tempo Esperado**: 1-3min
**Agente**: Todos os envolvidos
**Dependências**: Identificação de dependências cruzadas

```bash
# Exemplo: Deploy que afeta pagamentos
vercel-agent: "Deploy scheduled for 14:00"
asaas-agent: "Acknowledged, will monitor webhooks"
replicate-agent: "No AI operations scheduled during window"
```

**Validação**: Todos os agentes coordenados e cientes
**Rollback**: Reagendar se conflitos não resolvidos

#### 5. Task Execution
**Descrição**: Execução da tarefa com logging contínuo
**Tempo Esperado**: Varia por tarefa
**Agente**: Agente Designado
**Dependências**: Plano aprovado, recursos disponíveis

**Validação**: Progresso reportado em checkpoints regulares
**Rollback**: Procedimento específico por tipo de tarefa

#### 6. Status Update
**Descrição**: Atualização do contexto global com resultados
**Tempo Esperado**: 1-2min
**Agente**: Agente Designado
**Dependências**: Tarefa completada ou falhou

```bash
# Atualização obrigatória
1. Atualizar .claude/agents/{agent-name}.md
2. Atualizar .claude/TASK.md com resultado
3. Criar log em .claude/docs/logs/ se significativo
4. Notificar outros agentes se necessário
```

**Validação**: Contexto atualizado, outros agentes notificados
**Rollback**: Não aplicável (sempre executar updates)

### Pontos de Verificação
- [ ] Checkpoint 1: Agente correto identificado e disponível
- [ ] Checkpoint 2: Contexto lido e compreendido completamente  
- [ ] Checkpoint 3: Plano de execução validado
- [ ] Checkpoint 4: Coordenação com outros agentes realizada
- [ ] Checkpoint 5: Tarefa executada com sucesso
- [ ] Checkpoint 6: Contexto global atualizado

### Tratamento de Erros

#### Erro: Agent Unavailable
**Sintoma**: Agente especializado não responde ou está ocupado
**Causa**: Sobrecarga ou falha do agente
**Solução**: 
1. Verificar status do agente
2. Aguardar ou reatribuir para agente backup
3. Escalar para intervenção manual se crítico

#### Erro: Context Conflict
**Sintoma**: Informações conflitantes entre agentes
**Causa**: Atualizações simultâneas ou falha na sincronização
**Solução**:
1. Parar todas as operações
2. Resolver conflito manualmente
3. Resincronizar contexto
4. Reiniciar operações

#### Erro: Dependency Failure
**Sintoma**: Agente dependente falha durante coordenação
**Causa**: Falha de sistema ou erro de execução
**Solução**:
1. Rollback operações relacionadas
2. Isolar agente com falha
3. Continuar com agentes funcionais
4. Agendar retry quando serviço restaurado

### Métricas de Sucesso
- **Taxa de Coordenação**: 98%+
- **Tempo Médio de Coordenação**: < 5min
- **SLA**: Resposta em < 30seg para tarefas críticas

### Logs Relacionados
- **Local dos Logs**: `.claude/docs/logs/coordination/`
- **Filtros Úteis**: 
  - Por agente: `grep "agent:replicate"`
  - Por status: `grep "status:error"`
  - Por período: `ls logs/ | grep "2025-08-21"`
- **Alertas**: Falhas de coordenação disparam alert imediato

### Casos de Uso Comuns

#### Scenario 1: AI Model Training
```
1. User requests model training
2. replicate-agent assigned
3. Reads TASK.md, checks asaas-agent for payment status
4. Coordinates with vercel-agent for webhook availability
5. Executes training
6. Updates all contexts with results
```

#### Scenario 2: Payment Processing
```
1. User upgrades plan
2. asaas-agent assigned  
3. Reads TASK.md, checks user current status
4. Coordinates with system for credit update
5. Processes payment
6. Updates user plan, notifies other agents
```

#### Scenario 3: Production Deploy
```
1. New code needs deployment
2. vercel-agent assigned
3. Reads TASK.md, checks for ongoing AI operations
4. Coordinates maintenance window with other agents
5. Executes deployment
6. Updates system status, confirms all agents operational
```

### Contatos e Escalação
- **Responsável Primário**: System Coordinator
- **Escalação**: Manual intervention required
- **Documentação Externa**: Agent-specific documentation in `/agents/`

### Histórico de Mudanças
| Data | Versão | Mudança | Autor |
|------|--------|---------|-------|
| 2025-08-21 | 1.0 | Criação do workflow de coordenação | System |

---

**Criado**: 2025-08-21
**Próxima revisão**: Semanal