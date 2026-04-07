-- =====================================================
-- FlowLux - Migration V10: Mass Message Observability
-- =====================================================
-- Objetivos:
-- 1. Salvar logs por contato em disparos em massa
-- 2. Persistir motivo de falha e tentativas
-- 3. Permitir reprocessamento seletivo sem reenviar para contatos já enviados

ALTER TABLE mass_messages
  ADD COLUMN IF NOT EXISTS failed_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE mass_messages
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE mass_messages
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE mass_messages
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE mass_messages DROP CONSTRAINT IF EXISTS mass_messages_status_check;
ALTER TABLE mass_messages ADD CONSTRAINT mass_messages_status_check
  CHECK (status IN (
    'draft',
    'scheduled',
    'sending',
    'completed',
    'completed_with_errors',
    'failed',
    'cancelled'
  ));

CREATE INDEX IF NOT EXISTS idx_mass_messages_status_scheduled
  ON mass_messages(status, scheduled_at)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS mass_message_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mass_message_id UUID NOT NULL REFERENCES mass_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  lead_name TEXT NOT NULL DEFAULT '',
  lead_phone TEXT NOT NULL DEFAULT '',
  normalized_phone TEXT NOT NULL DEFAULT '',
  remote_jid TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failure_reason TEXT,
  provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mass_message_id, lead_id)
);

ALTER TABLE mass_message_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own mass message deliveries" ON mass_message_deliveries;
CREATE POLICY "Users can manage own mass message deliveries"
  ON mass_message_deliveries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mass_message_deliveries_campaign
  ON mass_message_deliveries(mass_message_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mass_message_deliveries_status
  ON mass_message_deliveries(mass_message_id, status);

CREATE INDEX IF NOT EXISTS idx_mass_message_deliveries_user_status
  ON mass_message_deliveries(user_id, status, created_at DESC);

DROP TRIGGER IF EXISTS update_mass_message_deliveries_updated_at ON mass_message_deliveries;
CREATE TRIGGER update_mass_message_deliveries_updated_at
  BEFORE UPDATE ON mass_message_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
