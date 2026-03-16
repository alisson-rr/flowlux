-- =============================================
-- FlowLux - Migration V3
-- Run this in your Supabase SQL editor
-- =============================================

-- 1. Soft delete for leads: add deleted_at column
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Multiple funnels support: create funnels table
CREATE TABLE IF NOT EXISTS funnels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own funnels" ON funnels FOR ALL USING (auth.uid() = user_id);

-- 3. Add funnel_id to funnel_stages (link stages to a specific funnel)
ALTER TABLE funnel_stages ADD COLUMN IF NOT EXISTS funnel_id UUID REFERENCES funnels(id) ON DELETE CASCADE;

-- 4. Add funnel_id to leads (link lead to a specific funnel)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS funnel_id UUID REFERENCES funnels(id) ON DELETE SET NULL;

-- 5. Add instance_id to automation_triggers and mass_messages
ALTER TABLE automation_triggers ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL;
ALTER TABLE mass_messages ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL;
ALTER TABLE scheduled_messages ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL;

-- 6. Add instance_id to conversations if not exists (should already exist)
-- ALTER TABLE conversations ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL;

-- 7. Hotmart webhook config: add funnel mapping per event
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS webhook_config JSONB DEFAULT '{}';

-- 8. Delete mass messages support
-- (already can delete, just needs UI button)

-- 9. Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON leads(deleted_at);
CREATE INDEX IF NOT EXISTS idx_leads_funnel_id ON leads(funnel_id);
CREATE INDEX IF NOT EXISTS idx_funnel_stages_funnel_id ON funnel_stages(funnel_id);
CREATE INDEX IF NOT EXISTS idx_funnels_user_id ON funnels(user_id);

-- 10. Migrate existing stages to a default funnel
-- Run this AFTER the above, it creates a default funnel for each user and links existing stages
DO $$
DECLARE
  r RECORD;
  new_funnel_id UUID;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM funnel_stages WHERE funnel_id IS NULL
  LOOP
    INSERT INTO funnels (user_id, name, description)
    VALUES (r.user_id, 'Funil Principal', 'Funil padrão')
    RETURNING id INTO new_funnel_id;

    UPDATE funnel_stages SET funnel_id = new_funnel_id WHERE user_id = r.user_id AND funnel_id IS NULL;
    UPDATE leads SET funnel_id = new_funnel_id WHERE user_id = r.user_id AND funnel_id IS NULL;
  END LOOP;
END $$;
