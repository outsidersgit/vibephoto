-- Verificar data de expiração dos créditos do usuário
SELECT
  id,
  email,
  name,
  plan,
  "subscriptionStatus",
  "creditsUsed",
  "creditsLimit",
  "creditsBalance",
  "creditsExpiresAt",
  "subscriptionEndsAt",
  "lastCreditRenewalAt",
  "billingCycle",
  -- Verificar se expirou
  CASE
    WHEN "creditsExpiresAt" IS NULL THEN 'SEM DATA DE EXPIRAÇÃO'
    WHEN "creditsExpiresAt" < NOW() THEN 'EXPIRADO ❌'
    ELSE 'VÁLIDO ✅'
  END as status_expiracao,
  -- Dias até expirar (ou desde que expirou)
  CASE
    WHEN "creditsExpiresAt" IS NULL THEN NULL
    ELSE EXTRACT(DAY FROM ("creditsExpiresAt" - NOW())) 
  END as dias_ate_expirar
FROM users
WHERE id = 'cmhktfezk0000lb04ergjfykk';
