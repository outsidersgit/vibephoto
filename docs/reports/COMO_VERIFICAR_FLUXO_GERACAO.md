# Como Verificar o Fluxo de Geração de Imagem

## 📡 O que é Broadcast?

**Broadcast** é um sistema de comunicação em tempo real que funciona assim:

1. **Backend (webhook do Astria)** recebe notificação de que a imagem está pronta
2. **Backend atualiza o banco de dados** (status → COMPLETED)
3. **Backend faz "broadcast"** = envia uma mensagem para TODOS os clientes conectados via SSE (Server-Sent Events)
4. **Frontend recebe a mensagem** e atualiza a interface automaticamente

É como um sistema de notificação push, mas dentro da própria aplicação.

---

## ✅ Como Verificar Cada Teste

### **Teste 2: Verificar se o Polling está funcionando**

**O que é Polling?**
É um sistema de "fallback" que verifica o status da geração a cada 3 segundos enquanto está processando. Se o SSE (broadcast) falhar, o polling garante que ainda detectamos quando a imagem estiver pronta.

**Como verificar:**

1. **Abra o Console do Navegador** (F12 → Console)
2. **Gere uma imagem**
3. **Procure por estas mensagens no console:**

```
🔍 [ASTRIA_STATUS] Checking status for prompt...
🔄 Polling detected status change: PROCESSING -> COMPLETED
✅ Generation {id} completed via polling - showing success message
```

**Se você ver essas mensagens**: ✅ Polling está funcionando

**Se NÃO ver essas mensagens**: ❌ Polling pode não estar rodando ou não está detectando mudanças

---

### **Teste 3: Verificar se o Webhook está fazendo Broadcast**

**O que é Webhook?**
É quando o Astria (provedor de IA) envia uma notificação para nosso servidor dizendo "a imagem está pronta!".

**O que é Broadcast?**
É quando nosso servidor recebe essa notificação e envia uma mensagem para todos os navegadores conectados.

**Como verificar:**

#### **Opção A: Logs do Servidor (Vercel/Produção)**

1. Vá para o **Dashboard do Vercel**
2. Acesse o projeto **vibephoto**
3. Clique em **"Deployments"** → Selecione o deployment mais recente
4. Clique em **"Functions"** → Procure por `/api/webhooks/astria`
5. Veja os **logs** procurando por:

```
📡 Broadcasting generation status change: { generationId: '...', status: 'COMPLETED', ... }
✅ Broadcast sent successfully for generation {id} with status: COMPLETED
```

**Se você ver essas mensagens**: ✅ Webhook está recebendo e fazendo broadcast

**Se NÃO ver essas mensagens**: ❌ Webhook pode não estar sendo chamado pelo Astria

#### **Opção B: Console do Navegador (Frontend)**

1. **Abra o Console do Navegador** (F12 → Console)
2. **Gere uma imagem**
3. **Procure por estas mensagens:**

```
📥 SSE event received: generation_status_changed { ... }
🔄 Real-time update: Generation {id} -> COMPLETED
📥 Gallery received generation status update: {id} -> COMPLETED
```

**Se você ver essas mensagens**: ✅ Broadcast chegou no frontend

**Se NÃO ver essas mensagens**: ❌ Broadcast pode não estar sendo enviado ou SSE está desconectado

#### **Opção C: Verificar Conexão SSE**

No console do navegador, procure por:

```
📡 Connecting to SSE stream...
✅ SSE connection opened - event-driven system active
✅ SSE connection confirmed: Real-time updates connected
```

**Se você ver essas mensagens**: ✅ SSE está conectado (pronto para receber broadcast)

**Se ver "❌ Disconnected from real-time updates"**: ❌ SSE está desconectado (broadcast não chega)

---

## 🔍 Checklist de Verificação

### **1. Botão "Gerar Foto" permanece em loading?**
- [ ] Sim → ✅ Correto
- [ ] Não → ❌ Problema: `currentGeneration?.status` não está sendo setado como `PROCESSING`

### **2. Polling está funcionando?**
- [ ] Vejo logs de "Polling detected status change" → ✅ Funcionando
- [ ] Não vejo logs de polling → ❌ Problema: `useGenerationPolling` não está rodando

### **3. Webhook está fazendo broadcast?**
- [ ] Vejo logs de "Broadcasting generation status change" no servidor → ✅ Funcionando
- [ ] Vejo logs de "SSE event received: generation_status_changed" no frontend → ✅ Broadcast chegou
- [ ] Não vejo nenhum dos dois → ❌ Problema: Webhook pode não estar sendo chamado ou broadcast não está funcionando

### **4. Galeria atualiza automaticamente?**
- [ ] Vejo logs de "Gallery received generation status update" → ✅ Recebeu atualização
- [ ] Vejo logs de "Added new completed generation to gallery" → ✅ Adicionou à galeria
- [ ] Imagem aparece sem F5 → ✅ Funcionando
- [ ] Imagem só aparece após F5 → ❌ Problema: Estado local não está sendo atualizado

---

## 🐛 Onde Procurar Problemas

### **Se o botão volta ao normal antes da hora:**
- Verifique no console se `currentGeneration?.status` existe e é `'PROCESSING'`
- Verifique se `setCurrentGeneration` está sendo chamado com status correto

### **Se polling não funciona:**
- Verifique se o endpoint `/api/generations/[id]/check-status` existe e aceita GET
- Verifique se `useGenerationPolling` está habilitado quando `currentGeneration?.status === 'PROCESSING'`

### **Se broadcast não funciona:**
- Verifique se o webhook do Astria está configurado corretamente
- Verifique se o SSE está conectado (veja logs de conexão)
- Verifique se `broadcastGenerationStatusChange` está sendo chamado no webhook

### **Se galeria não atualiza:**
- Verifique se `handleGenerationStatusChange` está sendo chamado
- Verifique se `setLocalGenerations` está atualizando o estado
- Verifique se não há conflito entre estado local e cache do React Query

---

## 📝 Exemplo de Logs Esperados (Sucesso)

### **Console do Navegador:**
```
📡 Connecting to SSE stream...
✅ SSE connection opened - event-driven system active
✅ SSE connection confirmed: Real-time updates connected

🚀 Generation started, waiting for real-time updates...
{ generationId: 'xxx', status: 'PROCESSING' }

🔄 Polling detected status change: PROCESSING -> COMPLETED
✅ Generation xxx completed via polling - showing success message

📥 SSE event received: generation_status_changed
🔄 Real-time update: Generation xxx -> COMPLETED
📥 Gallery received generation status update: xxx -> COMPLETED
✅ Added new completed generation xxx to gallery
```

### **Logs do Servidor (Vercel):**
```
🎯 Processing Astria prompt webhook for generation: xxx
✅ Astria prompt {id} updated to status: COMPLETED
📡 Broadcasting generation status change: { generationId: 'xxx', status: 'COMPLETED', ... }
✅ Broadcast sent successfully for generation xxx with status: COMPLETED
```

---

## 🆘 Se Algo Não Funcionar

1. **Copie TODOS os logs** do console do navegador (especialmente erros em vermelho)
2. **Copie os logs do servidor** (Vercel Functions → `/api/webhooks/astria`)
3. **Me envie** e eu ajudo a identificar o problema específico

