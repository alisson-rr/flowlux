-- =============================================
-- FlowLux - Migration V4
-- Run this in your Supabase SQL editor
-- =============================================

-- 1. Add soft delete (deleted_at) to mass_messages if not exists
ALTER TABLE mass_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Add soft delete (deleted_at) to scheduled_messages if not exists
ALTER TABLE scheduled_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Indexes for soft delete filtering
CREATE INDEX IF NOT EXISTS idx_mass_messages_deleted_at ON mass_messages(deleted_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_deleted_at ON scheduled_messages(deleted_at);

-- 4. Ensure instance_id is required on scheduled_messages (should already exist from v3)
-- ALTER TABLE scheduled_messages ALTER COLUMN instance_id SET NOT NULL;
-- (keeping as nullable for backwards compatibility, but enforced on frontend)

-- 5. Add deleted_at to flows for future soft delete support
ALTER TABLE flows ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_flows_deleted_at ON flows(deleted_at);

-- 6. Update CHECK constraints to allow 'cancelled' status
-- mass_messages: drop old constraint and recreate with 'cancelled'
ALTER TABLE mass_messages DROP CONSTRAINT IF EXISTS mass_messages_status_check;
ALTER TABLE mass_messages ADD CONSTRAINT mass_messages_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled'));

-- scheduled_messages: drop old constraint and recreate with 'cancelled'
ALTER TABLE scheduled_messages DROP CONSTRAINT IF EXISTS scheduled_messages_status_check;
ALTER TABLE scheduled_messages ADD CONSTRAINT scheduled_messages_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'cancelled'));

-- 7. Add target_tags and target_stages to mass_messages for filtering
ALTER TABLE mass_messages ADD COLUMN IF NOT EXISTS target_tags TEXT[] DEFAULT '{}';
ALTER TABLE mass_messages ADD COLUMN IF NOT EXISTS target_stages TEXT[] DEFAULT '{}';

-- 8. Soft delete for whatsapp_instances
ALTER TABLE whatsapp_instances ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_deleted_at ON whatsapp_instances(deleted_at);
