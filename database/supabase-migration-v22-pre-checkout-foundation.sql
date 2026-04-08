-- =============================================
-- FlowLux - Migration V22
-- Pre-checkout forms foundation
-- =============================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS phone_country_code TEXT,
  ADD COLUMN IF NOT EXISTS phone_search_keys TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_leads_phone_e164
  ON leads(phone_e164);

CREATE INDEX IF NOT EXISTS idx_leads_phone_search_keys
  ON leads USING GIN(phone_search_keys);

CREATE TABLE IF NOT EXISTS pre_checkout_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT DEFAULT '',
  template_key TEXT NOT NULL,
  template_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'paused', 'archived')),
  theme JSONB NOT NULL DEFAULT '{}'::JSONB,
  final_config JSONB NOT NULL DEFAULT '{}'::JSONB,
  integrations JSONB NOT NULL DEFAULT '{}'::JSONB,
  session_settings JSONB NOT NULL DEFAULT '{"resume_window_minutes": 1440, "abandonment_window_minutes": 60}'::JSONB,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(slug)
);

ALTER TABLE pre_checkout_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own pre-checkout forms" ON pre_checkout_forms;
CREATE POLICY "Users can manage own pre-checkout forms"
  ON pre_checkout_forms
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pre_checkout_forms_user_status
  ON pre_checkout_forms(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pre_checkout_forms_slug
  ON pre_checkout_forms(slug);

CREATE TABLE IF NOT EXISTS pre_checkout_form_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES pre_checkout_forms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('intro', 'short_text', 'long_text', 'email', 'phone', 'single_choice', 'multiple_choice')),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  placeholder TEXT DEFAULT '',
  is_required BOOLEAN NOT NULL DEFAULT true,
  options JSONB NOT NULL DEFAULT '[]'::JSONB,
  settings JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(form_id, step_key),
  UNIQUE(form_id, position)
);

ALTER TABLE pre_checkout_form_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own pre-checkout form steps" ON pre_checkout_form_steps;
CREATE POLICY "Users can manage own pre-checkout form steps"
  ON pre_checkout_form_steps
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pre_checkout_form_steps_form_position
  ON pre_checkout_form_steps(form_id, position);

CREATE TABLE IF NOT EXISTS pre_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES pre_checkout_forms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token UUID NOT NULL DEFAULT uuid_generate_v4(),
  resume_token UUID NOT NULL DEFAULT uuid_generate_v4(),
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'in_progress', 'completed', 'abandoned', 'expired')),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  current_step_position INTEGER NOT NULL DEFAULT 0,
  answers_count INTEGER NOT NULL DEFAULT 0,
  visitor_phone_raw TEXT,
  visitor_phone_e164 TEXT,
  visitor_phone_search_keys TEXT[] NOT NULL DEFAULT '{}',
  visitor_email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_interaction_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_token),
  UNIQUE(resume_token)
);

ALTER TABLE pre_checkout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own pre-checkout sessions" ON pre_checkout_sessions;
CREATE POLICY "Users can manage own pre-checkout sessions"
  ON pre_checkout_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pre_checkout_sessions_form_status
  ON pre_checkout_sessions(form_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pre_checkout_sessions_lead_id
  ON pre_checkout_sessions(lead_id);

CREATE INDEX IF NOT EXISTS idx_pre_checkout_sessions_phone_search_keys
  ON pre_checkout_sessions USING GIN(visitor_phone_search_keys);

CREATE TABLE IF NOT EXISTS pre_checkout_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES pre_checkout_forms(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES pre_checkout_sessions(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES pre_checkout_form_steps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answer_text TEXT,
  answer_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, step_id)
);

ALTER TABLE pre_checkout_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own pre-checkout answers" ON pre_checkout_answers;
CREATE POLICY "Users can manage own pre-checkout answers"
  ON pre_checkout_answers
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pre_checkout_answers_session
  ON pre_checkout_answers(session_id, confirmed_at DESC);

CREATE INDEX IF NOT EXISTS idx_pre_checkout_answers_form
  ON pre_checkout_answers(form_id, confirmed_at DESC);

CREATE TABLE IF NOT EXISTS pre_checkout_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES pre_checkout_forms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES pre_checkout_sessions(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'start', 'step_answered', 'lead_captured', 'completed', 'redirect_checkout', 'redirect_whatsapp', 'abandoned')),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'warning', 'error')),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pre_checkout_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own pre-checkout events" ON pre_checkout_events;
CREATE POLICY "Users can manage own pre-checkout events"
  ON pre_checkout_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pre_checkout_events_form_type
  ON pre_checkout_events(form_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_pre_checkout_events_session
  ON pre_checkout_events(session_id, occurred_at DESC);

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
      WHERE tgname = 'update_pre_checkout_forms_updated_at'
    ) THEN
      CREATE TRIGGER update_pre_checkout_forms_updated_at
      BEFORE UPDATE ON pre_checkout_forms
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'update_pre_checkout_form_steps_updated_at'
    ) THEN
      CREATE TRIGGER update_pre_checkout_form_steps_updated_at
      BEFORE UPDATE ON pre_checkout_form_steps
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'update_pre_checkout_sessions_updated_at'
    ) THEN
      CREATE TRIGGER update_pre_checkout_sessions_updated_at
      BEFORE UPDATE ON pre_checkout_sessions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'update_pre_checkout_answers_updated_at'
    ) THEN
      CREATE TRIGGER update_pre_checkout_answers_updated_at
      BEFORE UPDATE ON pre_checkout_answers
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END $$;
