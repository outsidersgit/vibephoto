-- Migration: Add custom commission fields to discount_coupons
-- Allows admin to override influencer default commission per coupon

ALTER TABLE discount_coupons 
ADD COLUMN IF NOT EXISTS custom_commission_percentage DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS custom_commission_fixed_value DECIMAL(10, 2);

COMMENT ON COLUMN discount_coupons.custom_commission_percentage IS 'Comissão percentual customizada para este cupom (sobrescreve padrão do influencer)';
COMMENT ON COLUMN discount_coupons.custom_commission_fixed_value IS 'Comissão em valor fixo customizada para este cupom (sobrescreve padrão do influencer)';
