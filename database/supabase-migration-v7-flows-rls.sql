-- =====================================================
-- FlowLux - Migration V7: RLS for Flows & Flow Steps
-- =====================================================
-- Fix: "not authorized" error when saving flows

-- Enable RLS on flows
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;

-- Policies for flows
CREATE POLICY "Users can view own flows" ON flows
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own flows" ON flows
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own flows" ON flows
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own flows" ON flows
  FOR DELETE USING (auth.uid() = user_id);

-- Enable RLS on flow_steps
ALTER TABLE flow_steps ENABLE ROW LEVEL SECURITY;

-- flow_steps don't have user_id directly, so we join through flows
CREATE POLICY "Users can view own flow steps" ON flow_steps
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_steps.flow_id AND flows.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own flow steps" ON flow_steps
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_steps.flow_id AND flows.user_id = auth.uid())
  );

CREATE POLICY "Users can update own flow steps" ON flow_steps
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_steps.flow_id AND flows.user_id = auth.uid())
  );

CREATE POLICY "Users can delete own flow steps" ON flow_steps
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_steps.flow_id AND flows.user_id = auth.uid())
  );
