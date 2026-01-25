# 🧪 TESTES DA API DE CRÉDITOS
# Execute um teste por vez, na ordem!

## ⚠️ ANTES DE COMEÇAR
1. Abra o site: https://vibephoto.app
2. Faça login com: lucasamoura@gmail.com
3. Aperte F12 para abrir o DevTools
4. Vá na aba "Console"

---

## 📋 TESTE 1: API com cache (atual)

**Cole e execute este código:**

```javascript
fetch('/api/credits/balance')
  .then(res => res.json())
  .then(data => {
    console.log('========================================');
    console.log('📊 TESTE 1: API COM CACHE');
    console.log('========================================');
    console.log('Créditos de assinatura:', data.balance.subscriptionCredits);
    console.log('Créditos comprados:', data.balance.purchasedCredits);
    console.log('🎯 TOTAL:', data.balance.totalCredits);
    console.log('========================================');
  })
  .catch(err => console.error('❌ Erro:', err));
```

**📸 Tire um print do resultado e me envie**

---

## 📋 TESTE 2: API sem cache (nova)

**Cole e execute este código:**

```javascript
fetch('/api/credits/balance-no-cache')
  .then(res => res.json())
  .then(data => {
    console.log('========================================');
    console.log('📊 TESTE 2: API SEM CACHE');
    console.log('========================================');
    console.log('Créditos de assinatura:', data.balance.subscriptionCredits);
    console.log('Créditos comprados:', data.balance.purchasedCredits);
    console.log('🎯 TOTAL:', data.balance.totalCredits);
    console.log('========================================');
  })
  .catch(err => console.error('❌ Erro:', err));
```

**📸 Tire um print do resultado e me envie**

---

## 📋 TESTE 3: Invalidar cache e testar

**Cole e execute este código:**

```javascript
fetch('/api/credits/invalidate-cache', { method: 'POST' })
  .then(res => res.json())
  .then(data => {
    console.log('========================================');
    console.log('✅ TESTE 3: CACHE INVALIDADO');
    console.log('========================================');
    console.log(data);
    
    console.log('Aguardando 2 segundos...');
    setTimeout(() => {
      fetch('/api/credits/balance')
        .then(res => res.json())
        .then(data => {
          console.log('========================================');
          console.log('📊 TESTANDO NOVAMENTE APÓS LIMPAR CACHE');
          console.log('========================================');
          console.log('Créditos de assinatura:', data.balance.subscriptionCredits);
          console.log('Créditos comprados:', data.balance.purchasedCredits);
          console.log('🎯 TOTAL:', data.balance.totalCredits);
          console.log('========================================');
        });
    }, 2000);
  })
  .catch(err => console.error('❌ Erro:', err));
```

**📸 Tire um print do resultado e me envie**

---

## 📤 O QUE FAZER DEPOIS

Envie os 3 prints dos resultados para eu analisar!
