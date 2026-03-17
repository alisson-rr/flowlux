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

-- =============================================
-- 11. FLOW TRIGGERS (new flow-based trigger system)
-- Replaces the old automation_triggers concept
-- =============================================
CREATE TABLE IF NOT EXISTS flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'keyword', 'schedule')),
  keywords TEXT[] DEFAULT '{}',
  schedule_cron TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own flows" ON flows FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_flows_user_id ON flows(user_id);
CREATE INDEX IF NOT EXISTS idx_flows_is_active ON flows(is_active);

-- =============================================
-- 12. FLOW STEPS (ordered sequence of actions in a flow)
-- =============================================
CREATE TABLE IF NOT EXISTS flow_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 0,
  step_type TEXT NOT NULL DEFAULT 'text' CHECK (step_type IN ('text', 'image', 'video', 'audio', 'document', 'delay')),
  content TEXT DEFAULT '',
  media_url TEXT,
  file_name TEXT,
  delay_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE flow_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own flow steps" ON flow_steps FOR ALL
  USING (EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_steps.flow_id AND flows.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_flow_steps_flow_id ON flow_steps(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_steps_order ON flow_steps(flow_id, step_order);

-- =============================================
-- 13. FLOW EXECUTIONS (log of flow runs)
-- =============================================
CREATE TABLE IF NOT EXISTS flow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  remote_jid TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

ALTER TABLE flow_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own flow executions" ON flow_executions FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_flow_executions_flow_id ON flow_executions(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_user_id ON flow_executions(user_id);

-- Add updated_at trigger
CREATE TRIGGER update_flows_updated_at BEFORE UPDATE ON flows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
