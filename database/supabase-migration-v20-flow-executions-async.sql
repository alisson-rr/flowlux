-- =============================================
-- FlowLux - Migration V20
-- Flows async: queue, worker state and per-step audit
-- =============================================

ALTER TABLE flow_executions
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instance_name TEXT,
  ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS provider_response JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE flow_executions
  DROP CONSTRAINT IF EXISTS flow_executions_status_check;

ALTER TABLE flow_executions
  ADD CONSTRAINT flow_executions_status_check
  CHECK (status IN ('pending', 'queued', 'running', 'processing', 'retry_waiting', 'completed', 'failed', 'cancelled'));

UPDATE flow_executions
SET status = 'queued'
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_flow_executions_status_next_run
  ON flow_executions(status, next_run_at);

CREATE INDEX IF NOT EXISTS idx_flow_executions_conversation_id
  ON flow_executions(conversation_id);

CREATE TABLE IF NOT EXISTS flow_execution_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id UUID NOT NULL REFERENCES flow_executions(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  flow_step_id UUID REFERENCES flow_steps(id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL DEFAULT 0,
  step_type TEXT NOT NULL CHECK (step_type IN ('text', 'image', 'video', 'audio', 'document', 'delay')),
  content TEXT DEFAULT '',
  media_url TEXT,
  file_name TEXT,
  delay_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'waiting_delay', 'processing', 'retry_waiting', 'completed', 'failed', 'cancelled', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  provider_response JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE flow_execution_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own flow execution steps" ON flow_execution_steps;
CREATE POLICY "Users can view own flow execution steps"
  ON flow_execution_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM flow_executions
      WHERE flow_executions.id = flow_execution_steps.execution_id
        AND flow_executions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage own flow execution steps" ON flow_execution_steps;
CREATE POLICY "Users can manage own flow execution steps"
  ON flow_execution_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM flow_executions
      WHERE flow_executions.id = flow_execution_steps.execution_id
        AND flow_executions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM flow_executions
      WHERE flow_executions.id = flow_execution_steps.execution_id
        AND flow_executions.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_flow_execution_steps_execution_id
  ON flow_execution_steps(execution_id);

CREATE INDEX IF NOT EXISTS idx_flow_execution_steps_status_scheduled_for
  ON flow_execution_steps(status, scheduled_for);

CREATE INDEX IF NOT EXISTS idx_flow_execution_steps_execution_order
  ON flow_execution_steps(execution_id, step_order);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'update_updated_at_column'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'update_flow_execution_steps_updated_at'
    ) THEN
      CREATE TRIGGER update_flow_execution_steps_updated_at
      BEFORE UPDATE ON flow_execution_steps
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END $$;
