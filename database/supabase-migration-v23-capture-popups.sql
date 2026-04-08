CREATE TABLE IF NOT EXISTS capture_popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  template_key TEXT NOT NULL DEFAULT 'lead-capture-minimal',
  template_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'paused', 'archived')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  trigger JSONB NOT NULL DEFAULT '{}'::jsonb,
  integrations JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE capture_popups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own capture popups" ON capture_popups;
CREATE POLICY "Users can manage own capture popups"
  ON capture_popups
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_capture_popups_user_status
  ON capture_popups(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_capture_popups_slug
  ON capture_popups(slug);

CREATE TABLE IF NOT EXISTS capture_popup_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id UUID NOT NULL REFERENCES capture_popups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  field_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('name', 'email', 'phone', 'text', 'textarea')),
  label TEXT NOT NULL,
  placeholder TEXT,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  width TEXT NOT NULL DEFAULT 'full' CHECK (width IN ('full', 'half')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (popup_id, field_key)
);

ALTER TABLE capture_popup_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own capture popup fields" ON capture_popup_fields;
CREATE POLICY "Users can manage own capture popup fields"
  ON capture_popup_fields
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_capture_popup_fields_popup_position
  ON capture_popup_fields(popup_id, position);

CREATE TABLE IF NOT EXISTS capture_popup_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id UUID NOT NULL REFERENCES capture_popups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  submission_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  visitor_name TEXT,
  visitor_email TEXT,
  visitor_phone_raw TEXT,
  visitor_phone_e164 TEXT,
  visitor_phone_search_keys TEXT[] NOT NULL DEFAULT '{}',
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  fbclid TEXT,
  gclid TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE capture_popup_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own capture popup submissions" ON capture_popup_submissions;
CREATE POLICY "Users can manage own capture popup submissions"
  ON capture_popup_submissions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_capture_popup_submissions_popup_submitted_at
  ON capture_popup_submissions(popup_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_capture_popup_submissions_lead_id
  ON capture_popup_submissions(lead_id);

CREATE INDEX IF NOT EXISTS idx_capture_popup_submissions_phone_search_keys
  ON capture_popup_submissions USING GIN(visitor_phone_search_keys);

CREATE TABLE IF NOT EXISTS capture_popup_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  popup_id UUID NOT NULL REFERENCES capture_popups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  submission_id UUID REFERENCES capture_popup_submissions(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  session_token TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'open', 'close', 'submit', 'redirect', 'pixel_error')),
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'warning', 'error')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE capture_popup_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own capture popup events" ON capture_popup_events;
CREATE POLICY "Users can manage own capture popup events"
  ON capture_popup_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_capture_popup_events_popup_type
  ON capture_popup_events(popup_id, event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_capture_popup_events_submission
  ON capture_popup_events(submission_id, occurred_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_capture_popups_updated_at'
  ) THEN
    CREATE TRIGGER update_capture_popups_updated_at
    BEFORE UPDATE ON capture_popups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_capture_popup_fields_updated_at'
  ) THEN
    CREATE TRIGGER update_capture_popup_fields_updated_at
    BEFORE UPDATE ON capture_popup_fields
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_capture_popup_submissions_updated_at'
  ) THEN
    CREATE TRIGGER update_capture_popup_submissions_updated_at
    BEFORE UPDATE ON capture_popup_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;
