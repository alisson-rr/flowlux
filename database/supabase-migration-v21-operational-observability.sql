-- =============================================
-- FlowLux - Migration V21
-- Observabilidade operacional minima
-- =============================================

CREATE TABLE IF NOT EXISTS operational_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'warning', 'error')),
  entity_type TEXT,
  entity_id UUID,
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE operational_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own operational events" ON operational_events;
CREATE POLICY "Users can view own operational events"
  ON operational_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_operational_events_user_created_at
  ON operational_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_events_source_created_at
  ON operational_events(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_events_severity_created_at
  ON operational_events(severity, created_at DESC);
