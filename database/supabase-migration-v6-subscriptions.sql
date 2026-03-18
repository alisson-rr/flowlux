-- =====================================================
-- FlowLux - Migration V6: Subscriptions & Payments
-- =====================================================

-- Tabela de assinaturas
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id TEXT NOT NULL, -- 'starter' ou 'professional'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'authorized', 'paused', 'cancelled', 'trial', 'active'
  mp_preapproval_id TEXT, -- ID da assinatura no Mercado Pago
  mp_payer_id TEXT,
  mp_payer_email TEXT,
  trial_start DATE,
  trial_end DATE,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de histórico de pagamentos
CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  mp_payment_id TEXT,
  status TEXT NOT NULL, -- 'approved', 'pending', 'in_process', 'rejected', 'refunded', 'cancelled'
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'BRL',
  payment_method TEXT,
  description TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de webhooks do Mercado Pago (log)
CREATE TABLE IF NOT EXISTS mp_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_action TEXT,
  mp_id TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_mp_preapproval_id ON subscriptions(mp_preapproval_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_user_id ON subscription_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription_id ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_mp_webhooks_mp_id ON mp_webhooks(mp_id);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_webhooks ENABLE ROW LEVEL SECURITY;

-- Políticas de subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role pode fazer tudo (para webhooks)
CREATE POLICY "Service role full access subscriptions" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- Políticas de subscription_payments
CREATE POLICY "Users can view own payments" ON subscription_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access payments" ON subscription_payments
  FOR ALL USING (auth.role() = 'service_role');

-- Políticas de mp_webhooks (apenas service role)
CREATE POLICY "Service role full access mp_webhooks" ON mp_webhooks
  FOR ALL USING (auth.role() = 'service_role');

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_subscription_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_updated_at();
