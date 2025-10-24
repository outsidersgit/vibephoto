# System Architecture Overview

## Visão Geral do Sistema Multi-Agent

### Arquitetura de Alto Nível

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Replicate      │    │     Asaas       │    │    Vercel       │
│    Agent        │    │    Agent        │    │    Agent        │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • AI Training   │    │ • Payments      │    │ • Deployment    │
│ • Image Gen     │    │ • Billing       │    │ • Monitoring    │
│ • Webhooks      │    │ • Webhooks      │    │ • Performance   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   TASK.md       │
                    │ Central Context │
                    ├─────────────────┤
                    │ • System Status │
                    │ • Coordination  │
                    │ • Task Queue    │
                    │ • History       │
                    └─────────────────┘
```

### Componentes Principais

#### Frontend Layer
- **Framework**: Next.js 15.4.6 com App Router
- **UI**: TailwindCSS + shadcn/ui components
- **State Management**: React hooks + Context API
- **Authentication**: NextAuth.js session management

#### API Layer
- **Routes**: Next.js API routes (/api/*)
- **Middleware**: Rate limiting, auth validation
- **Webhooks**: External service callbacks
- **Health Checks**: System monitoring endpoints

#### Business Logic Layer
- **User Management**: Plans, credits, permissions
- **AI Operations**: Model training, image generation
- **Payment Processing**: Billing, subscriptions
- **File Management**: Upload, storage, processing

#### Data Layer
- **Primary DB**: PostgreSQL (Supabase)
- **ORM**: Prisma with type generation
- **File Storage**: AWS S3 (production) / Local (dev)
- **Caching**: Edge caching via Vercel

#### External Integrations
- **AI Provider**: Replicate API
- **Payment Provider**: Asaas API
- **Storage Provider**: AWS S3
- **Hosting**: Vercel platform

### Data Flow Architecture

```
User Request → Next.js Router → API Route → Business Logic → Database/External APIs
     ↑                                                              ↓
User Response ← UI Component ← Server Response ← Processed Data ← Response
```

### Security Architecture

#### Authentication Flow
```
User Login → NextAuth.js → Provider Validation → Session Creation → JWT Token
```

#### Authorization Layers
- **Route Protection**: Middleware-level auth checks
- **Plan Validation**: Feature access by user plan
- **Rate Limiting**: Per-user, per-endpoint limits
- **Content Moderation**: AI prompt/image validation

### Agent Communication Protocol

#### Workflow Synchronization
1. Agent reads `TASK.md` for current system state
2. Agent updates own documentation file
3. Agent executes assigned tasks
4. Agent updates `TASK.md` with results
5. Agent logs important events in `/docs/logs/`

#### Coordination Rules
- **Single Source of Truth**: `TASK.md` maintains global state
- **Agent Autonomy**: Each agent manages its domain independently  
- **Cross-Agent Dependencies**: Documented in agent files
- **Conflict Resolution**: Priority based on system criticality

### Deployment Architecture

```
Development → GitHub → Vercel Build → Production Deploy
     ↓            ↓         ↓              ↓
Local Env → Git Push → Auto Build → Live System
```

#### Environment Strategy
- **Local**: Mock services, local DB, file uploads
- **Staging**: Preview deployments per branch
- **Production**: Full external services, monitoring

### Monitoring and Observability

#### Health Check Endpoints
- `/api/health` - Overall system health
- `/api/monitoring/metrics` - Usage statistics
- Admin dashboards - `/admin/monitoring`, `/admin/security`

#### Logging Strategy
- **Application Logs**: Structured JSON logs
- **Agent Logs**: Specific to each agent's operations
- **System Logs**: Database in `SystemLog` table
- **External Logs**: Vercel, Supabase, AWS CloudWatch

### Scaling Considerations

#### Current Limits
- **Vercel**: 1TB bandwidth, 1M function executions
- **Database**: Supabase connection pooling
- **File Storage**: S3 with CDN distribution
- **AI Processing**: Replicate API rate limits

#### Scale-Out Strategy
- **Database**: Read replicas, connection pooling
- **File Storage**: Multi-region S3 buckets
- **AI Processing**: Multiple provider failover
- **Frontend**: Edge caching, code splitting

### Disaster Recovery

#### Backup Strategy
- **Database**: Automated Supabase backups
- **File Storage**: S3 versioning and cross-region replication
- **Code**: Git version control with multiple remotes
- **Configuration**: Environment variables backed up

#### Recovery Procedures
1. **Database Failure**: Restore from backup, update connection strings
2. **Storage Failure**: Failover to backup region
3. **AI Provider Failure**: Switch to backup provider
4. **Deployment Failure**: Rollback via Vercel dashboard

---

**Última atualização**: 2025-08-21
**Próxima revisão**: Mensal
**Responsável**: System Architecture Team