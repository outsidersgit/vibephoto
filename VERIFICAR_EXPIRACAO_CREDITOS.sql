-- Verificar data de expiração dos créditos
SELECT
  id,
  email,
  "creditsLimit",
  "creditsUsed",
  "creditsBalance",
  "creditsExpiresAt",
  "subscriptionStatus",
  "subscriptionEndsAt",
  "lastCreditRenewalAt",
  plan,
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
