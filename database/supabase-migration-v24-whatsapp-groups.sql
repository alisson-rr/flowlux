CREATE TABLE IF NOT EXISTS whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  remote_jid TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  picture_url TEXT,
  owner_jid TEXT,
  participants_count INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'sync' CHECK (source IN ('sync', 'manual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instance_id, remote_jid)
);

ALTER TABLE whatsapp_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own whatsapp groups" ON whatsapp_groups;
CREATE POLICY "Users can manage own whatsapp groups"
  ON whatsapp_groups
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_user_status
  ON whatsapp_groups(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_instance
  ON whatsapp_groups(instance_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_remote_jid
  ON whatsapp_groups(remote_jid);

CREATE TABLE IF NOT EXISTS group_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  flow_execution_id UUID REFERENCES flow_executions(id) ON DELETE SET NULL,
  scheduled_message_id UUID,
  send_mode TEXT NOT NULL CHECK (send_mode IN ('manual', 'flow', 'scheduled')),
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document')),
  content TEXT,
  media_url TEXT,
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'failed')),
  error_message TEXT,
  provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE group_message_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own group message logs" ON group_message_logs;
CREATE POLICY "Users can manage own group message logs"
  ON group_message_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_group_message_logs_group_created
  ON group_message_logs(group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_message_logs_user_created
  ON group_message_logs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS group_scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  remote_jid TEXT NOT NULL,
  group_subject TEXT NOT NULL,
  message TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  next_run_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'retry_waiting', 'sent', 'failed', 'cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  claimed_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failure_reason TEXT,
  provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'audio', 'document')),
  file_name TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE group_scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own group scheduled messages" ON group_scheduled_messages;
CREATE POLICY "Users can manage own group scheduled messages"
  ON group_scheduled_messages
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_group_scheduled_messages_user_status
  ON group_scheduled_messages(user_id, status, COALESCE(next_run_at, scheduled_at));

CREATE INDEX IF NOT EXISTS idx_group_scheduled_messages_group
  ON group_scheduled_messages(group_id, scheduled_at DESC);

CREATE TABLE IF NOT EXISTS group_scheduled_message_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_message_id UUID NOT NULL REFERENCES group_scheduled_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  attempt_number INTEGER NOT NULL,
  target_group_jid TEXT NOT NULL,
  group_subject TEXT NOT NULL,
  instance_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('processing', 'sent', 'failed', 'skipped')),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  provider_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE group_scheduled_message_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own group scheduled message attempts" ON group_scheduled_message_attempts;
CREATE POLICY "Users can manage own group scheduled message attempts"
  ON group_scheduled_message_attempts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_group_scheduled_attempts_scheduled
  ON group_scheduled_message_attempts(scheduled_message_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_whatsapp_groups_updated_at'
  ) THEN
    CREATE TRIGGER update_whatsapp_groups_updated_at
    BEFORE UPDATE ON whatsapp_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_group_scheduled_messages_updated_at'
  ) THEN
    CREATE TRIGGER update_group_scheduled_messages_updated_at
    BEFORE UPDATE ON group_scheduled_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_group_scheduled_message_attempts_updated_at'
  ) THEN
    CREATE TRIGGER update_group_scheduled_message_attempts_updated_at
    BEFORE UPDATE ON group_scheduled_message_attempts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;
