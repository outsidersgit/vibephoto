-- ============================================================================
-- VERIFICAÇÃO URGENTE: Saldo real do usuário cmhktfezk0000lb04ergjfykk
-- ============================================================================

-- Badge no frontend mostra: 1845 créditos
-- Nossa query calculou: 3185 créditos
-- Precisamos confirmar qual está correto!

-- ============================================================================
-- 1. VERIFICAR DADOS ATUAIS DA TABELA USERS
-- ============================================================================
SELECT
  id,
  email,
  name,
  plan,
  "subscriptionStatus",
  "creditsUsed",
  "creditsLimit",
  "creditsBalance",
  -- Fórmula padrão do saldo
  ("creditsLimit" - "creditsUsed" + "creditsBalance") as saldo_formula_padrao,
  -- Apenas créditos avulsos (o que o badge pode estar mostrando)
  "creditsBalance" as apenas_creditos_avulsos,
  -- Apenas créditos do plano
  ("creditsLimit" - "creditsUsed") as apenas_creditos_plano
FROM users
WHERE id = 'cmhktfezk0000lb04ergjfykk';

-- ANÁLISE DOS RESULTADOS ESPERADOS:
-- Se creditsBalance = 1845 → Badge está mostrando APENAS créditos avulsos (ERRADO)
-- Se (creditsLimit - creditsUsed) + creditsBalance = 3185 → Saldo real é 3185 (CORRETO)

-- ============================================================================
-- 2. VERIFICAR QUAL CAMPO O BADGE ESTÁ USANDO
-- ============================================================================
-- Precisamos verificar o código do badge em:
-- - src/hooks/useCredits.ts
-- - src/components/layout/header.tsx (ou similar)
-- 
-- Possíveis causas do bug no badge:
-- 1. Badge está usando apenas "creditsBalance" ao invés da fórmula completa
-- 2. Backend está retornando valor errado
-- 3. Frontend está calculando errado

-- ============================================================================
-- 3. CONFIRMAR ÚLTIMA TRANSAÇÃO DO LEDGER
-- ============================================================================
SELECT
  "balanceAfter" as saldo_no_ledger,
  amount,
  type,
  source,
  description,
  "createdAt"
FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
ORDER BY "createdAt" DESC
LIMIT 1;

-- ============================================================================
-- 4. COMPARAÇÃO TRIPLA
-- ============================================================================
SELECT
  'Badge Frontend' as fonte,
  1845 as valor_mostrado,
  'Valor que o usuário VÊ na tela' as observacao
UNION ALL
SELECT
  'User Table (fórmula padrão)' as fonte,
  ("creditsLimit" - "creditsUsed" + "creditsBalance") as valor_mostrado,
  'Saldo REAL calculado do banco' as observacao
FROM users
WHERE id = 'cmhktfezk0000lb04ergjfykk'
UNION ALL
SELECT
  'User Table (apenas balance)' as fonte,
  "creditsBalance" as valor_mostrado,
  'Créditos avulsos (sem incluir plano)' as observacao
FROM users
WHERE id = 'cmhktfezk0000lb04ergjfykk'
UNION ALL
SELECT
  'Ledger (balanceAfter)' as fonte,
  "balanceAfter" as valor_mostrado,
  'Último saldo registrado no ledger' as observacao
FROM credit_transactions
WHERE "userId" = 'cmhktfezk0000lb04ergjfykk'
ORDER BY "createdAt" DESC
LIMIT 1;

-- ============================================================================
-- DECISÃO BASEADA NOS RESULTADOS:
-- ============================================================================

-- CENÁRIO A: Se creditsBalance = 1845
-- → Badge está mostrando APENAS créditos avulsos (BUG)
-- → Saldo real = 3185 (plano + avulsos)
-- → Correção do ledger: remover 1560 (de 4745 para 3185) ✅

-- CENÁRIO B: Se (creditsLimit - creditsUsed + creditsBalance) = 1845
-- → User table foi alterada desde nossa última query
-- → Saldo real = 1845
-- → Correção do ledger: remover 2900 (de 4745 para 1845) ❌ RECALCULAR

-- ============================================================================
-- PRÓXIMO PASSO:
-- ============================================================================
-- 1. EXECUTAR esta query e confirmar os valores
-- 2. Se CENÁRIO A → Corrigir ledger + corrigir bug do badge
-- 3. Se CENÁRIO B → Recalcular correção do ledger
