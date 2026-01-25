# 🧪 TESTE DA API DE CRÉDITOS

## Problema
Badge mostra **1845** créditos, mas deveria mostrar **3185** créditos.

## Teste Manual da API

### 1. Abra o DevTools (F12) no navegador
### 2. Vá para a aba "Console"
### 3. Execute os testes abaixo:

#### TESTE 1: API Original (com cache)
```javascript
fetch('/api/credits/balance')
  .then(res => res.json())
  .then(data => {
    console.log('📊 API ORIGINAL (com cache):', data);
    console.log('🎯 TOTAL:', data.balance.totalCredits);
  })
  .catch(err => console.error('❌ Erro:', err));
```

#### TESTE 2: API sem cache (nova)
```javascript
fetch('/api/credits/balance-no-cache')
  .then(res => res.json())
  .then(data => {
    console.log('📊 API SEM CACHE:', data);
    console.log('🎯 TOTAL:', data.balance.totalCredits);
  })
  .catch(err => console.error('❌ Erro:', err));
```

#### TESTE 3: Invalidar cache e testar novamente
```javascript
// Primeiro: invalidar cache
fetch('/api/credits/invalidate-cache', { method: 'POST' })
  .then(res => res.json())
  .then(data => {
    console.log('✅ Cache invalidado:', data);
    
    // Aguardar 1 segundo e testar novamente
    setTimeout(() => {
      fetch('/api/credits/balance')
        .then(res => res.json())
        .then(data => {
          console.log('📊 API APÓS INVALIDAR CACHE:', data);
          console.log('🎯 TOTAL:', data.balance.totalCredits);
        });
    }, 1000);
  })
  .catch(err => console.error('❌ Erro:', err));
```

### 4. Copie e me envie os resultados dos 3 testes!

---

## O que estamos testando

1. Se a API está retornando `totalCredits: 3185` (correto)
2. Ou se está retornando `totalCredits: 1845` (errado)

Se a API retornar **1845**, o bug está no backend (cache do Next.js).
Se a API retornar **3185**, o bug está no frontend (React Query ou algum cálculo).

---

## ⚠️ IMPORTANTE

Execute este teste **enquanto está logado** com o usuário `cmhktfezk0000lb04ergjfykk` (lucasamoura@gmail.com).
