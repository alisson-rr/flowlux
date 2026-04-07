-- =====================================================
-- FlowLux - Migration V15: Scheduled Message Observability
-- =====================================================
-- Objetivos:
-- 1. Adicionar estados operacionais aos agendamentos
-- 2. Persistir tentativas, falhas e resposta do provider
-- 3. Permitir reprocessamento com historico completo

ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS provider_response JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE scheduled_messages DROP CONSTRAINT IF EXISTS scheduled_messages_status_check;
ALTER TABLE scheduled_messages ADD CONSTRAINT scheduled_messages_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status_due
  ON scheduled_messages(status, scheduled_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user_created
  ON scheduled_messages(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS scheduled_message_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scheduled_message_id UUID NOT NULL REFERENCES scheduled_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  target_phone TEXT NOT NULL DEFAULT '',
  normalized_phone TEXT,
  lead_name TEXT NOT NULL DEFAULT '',
  instance_name TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'sent', 'failed', 'skipped')),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scheduled_message_id, attempt_number)
);

ALTER TABLE scheduled_message_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own scheduled message attempts" ON scheduled_message_attempts;
CREATE POLICY "Users can manage own scheduled message attempts"
  ON scheduled_message_attempts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_message_attempts_message
  ON scheduled_message_attempts(scheduled_message_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scheduled_message_attempts_user_status
  ON scheduled_message_attempts(user_id, status, created_at DESC);

DROP TRIGGER IF EXISTS update_scheduled_messages_updated_at ON scheduled_messages;
CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_message_attempts_updated_at ON scheduled_message_attempts;
CREATE TRIGGER update_scheduled_message_attempts_updated_at
  BEFORE UPDATE ON scheduled_message_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
