DELETE FROM subscriptions WHERE status = 'pending' AND mp_preapproval_id IS NULL;
-- =====================================================
-- FlowLux - Migration V8: Subscription Fixes
-- =====================================================
-- Correções no sistema de assinatura:
-- 1. Índice único em mp_payment_id para evitar pagamentos duplicados
-- 2. Função RPC para buscar user_id por email (usado no webhook do MP)

-- Índice único para deduplicação de pagamentos do Mercado Pago
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_payments_mp_payment_id
  ON subscription_payments(mp_payment_id) WHERE mp_payment_id IS NOT NULL;

-- Função para buscar user_id por email de forma eficiente (usado no webhook)
CREATE OR REPLACE FUNCTION get_user_id_by_email(email_input TEXT)
RETURNS UUID AS $$
  SELECT id FROM auth.users WHERE email = lower(email_input) LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
