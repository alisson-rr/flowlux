-- =============================================
-- FlowLux - Supabase Database Schema
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. PROFILES (user profiles)
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- =============================================
-- 2. WHATSAPP INSTANCES
-- =============================================
CREATE TABLE whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting')),
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own instances" ON whatsapp_instances FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 3. FUNNEL STAGES
-- =============================================
CREATE TABLE funnel_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8B5CF6',
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE funnel_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own stages" ON funnel_stages FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 4. LEADS
-- =============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_e164 TEXT,
  phone_country_code TEXT,
  phone_search_keys TEXT[] NOT NULL DEFAULT '{}',
  email TEXT,
  stage_id UUID REFERENCES funnel_stages(id) ON DELETE SET NULL,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own leads" ON leads FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 5. TAGS
-- =============================================
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8B5CF6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tags" ON tags FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 6. LEAD_TAGS (many-to-many)
-- =============================================
CREATE TABLE lead_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, tag_id)
);

ALTER TABLE lead_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage lead tags" ON lead_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_tags.lead_id AND leads.user_id = auth.uid()));

-- =============================================
-- 7. NOTES
-- =============================================
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own notes" ON notes FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 8. CONVERSATIONS
-- =============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  remote_jid TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT NOT NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own conversations" ON conversations FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 9. MESSAGES
-- =============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  remote_jid TEXT NOT NULL,
  from_me BOOLEAN NOT NULL DEFAULT false,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio', 'document')),
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read')),
  provider_message_id TEXT,
  provider_payload JSONB,
  provider_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own messages" ON messages FOR ALL
  USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));

-- =============================================
-- 10. AUTOMATION TRIGGERS
-- =============================================
CREATE TABLE automation_triggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'keyword' CHECK (type IN ('keyword', 'schedule', 'event')),
  keywords TEXT[] DEFAULT '{}',
  schedule_cron TEXT,
  message_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE automation_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own triggers" ON automation_triggers FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 11. MASS MESSAGES
-- =============================================
CREATE TABLE mass_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  target_tags TEXT[] DEFAULT '{}',
  target_stages TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed')),
  scheduled_at TIMESTAMPTZ,
  sent_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mass_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own mass messages" ON mass_messages FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 12. SCHEDULED MESSAGES
-- =============================================
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own scheduled messages" ON scheduled_messages FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 13. MESSAGE TEMPLATES
-- =============================================
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'geral',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own templates" ON message_templates FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 14. INTEGRATIONS (Hotmart, etc.)
-- =============================================
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  api_key TEXT,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, type)
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own integrations" ON integrations FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 15. HOTMART WEBHOOKS (incoming events)
-- =============================================
CREATE TABLE hotmart_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hotmart_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own webhooks" ON hotmart_webhooks FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- 16. PRE-CHECKOUT FORMS
-- =============================================
CREATE TABLE pre_checkout_forms (
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
CREATE POLICY "Users can manage own pre-checkout forms" ON pre_checkout_forms FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 17. PRE-CHECKOUT FORM STEPS
-- =============================================
CREATE TABLE pre_checkout_form_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  form_id UUID NOT NULL REFERENCES pre_checkout_forms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL CHECK (type IN ('intro', 'welcome_screen', 'statement', 'short_text', 'long_text', 'email', 'phone', 'number', 'date', 'single_choice', 'multiple_choice', 'dropdown', 'yes_no', 'rating', 'opinion_scale', 'legal', 'end_screen')),
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
CREATE POLICY "Users can manage own pre-checkout form steps" ON pre_checkout_form_steps FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 18. PRE-CHECKOUT SESSIONS
-- =============================================
CREATE TABLE pre_checkout_sessions (
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
CREATE POLICY "Users can manage own pre-checkout sessions" ON pre_checkout_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 19. PRE-CHECKOUT ANSWERS
-- =============================================
CREATE TABLE pre_checkout_answers (
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
CREATE POLICY "Users can manage own pre-checkout answers" ON pre_checkout_answers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 20. PRE-CHECKOUT EVENTS
-- =============================================
CREATE TABLE pre_checkout_events (
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
CREATE POLICY "Users can manage own pre-checkout events" ON pre_checkout_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_leads_stage_id ON leads(stage_id);
CREATE INDEX idx_leads_phone_e164 ON leads(phone_e164);
CREATE INDEX idx_leads_phone_search_keys ON leads USING GIN(phone_search_keys);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_instance_remote_jid ON conversations(instance_id, remote_jid);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_provider_timestamp ON messages(provider_timestamp DESC);
CREATE INDEX idx_lead_tags_lead_id ON lead_tags(lead_id);
CREATE INDEX idx_lead_tags_tag_id ON lead_tags(tag_id);
CREATE INDEX idx_notes_lead_id ON notes(lead_id);
CREATE INDEX idx_automation_triggers_user_id ON automation_triggers(user_id);
CREATE INDEX idx_scheduled_messages_scheduled_at ON scheduled_messages(scheduled_at);
CREATE INDEX idx_whatsapp_instances_user_id ON whatsapp_instances(user_id);
CREATE INDEX idx_pre_checkout_forms_user_status ON pre_checkout_forms(user_id, status, updated_at DESC);
CREATE INDEX idx_pre_checkout_forms_slug ON pre_checkout_forms(slug);
CREATE INDEX idx_pre_checkout_form_steps_form_position ON pre_checkout_form_steps(form_id, position);
CREATE INDEX idx_pre_checkout_sessions_form_status ON pre_checkout_sessions(form_id, status, updated_at DESC);
CREATE INDEX idx_pre_checkout_sessions_lead_id ON pre_checkout_sessions(lead_id);
CREATE INDEX idx_pre_checkout_sessions_phone_search_keys ON pre_checkout_sessions USING GIN(visitor_phone_search_keys);
CREATE INDEX idx_pre_checkout_answers_session ON pre_checkout_answers(session_id, confirmed_at DESC);
CREATE INDEX idx_pre_checkout_answers_form ON pre_checkout_answers(form_id, confirmed_at DESC);
CREATE INDEX idx_pre_checkout_events_form_type ON pre_checkout_events(form_id, event_type, occurred_at DESC);
CREATE INDEX idx_pre_checkout_events_session ON pre_checkout_events(session_id, occurred_at DESC);
CREATE UNIQUE INDEX uq_conversations_instance_remote_jid ON conversations(instance_id, remote_jid);
CREATE UNIQUE INDEX uq_messages_conversation_provider_message_id ON messages(conversation_id, provider_message_id);

-- =============================================
-- FUNCTION: Upsert inbound chat message idempotently
-- =============================================
CREATE OR REPLACE FUNCTION upsert_inbound_chat_message(
  p_instance_id UUID,
  p_user_id UUID,
  p_remote_jid TEXT,
  p_contact_name TEXT,
  p_contact_phone TEXT,
  p_provider_message_id TEXT,
  p_from_me BOOLEAN,
  p_message_type TEXT,
  p_content TEXT,
  p_media_url TEXT,
  p_status TEXT,
  p_message_created_at TIMESTAMPTZ,
  p_message_preview TEXT,
  p_provider_payload JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_message_id UUID;
  v_inserted BOOLEAN := FALSE;
  v_effective_created_at TIMESTAMPTZ := COALESCE(p_message_created_at, NOW());
  v_effective_preview TEXT := COALESCE(NULLIF(BTRIM(p_message_preview), ''), NULLIF(BTRIM(p_content), ''), '[Mensagem]');
  v_effective_type TEXT := CASE
    WHEN p_message_type IN ('text', 'image', 'video', 'audio', 'document') THEN p_message_type
    ELSE 'text'
  END;
  v_effective_status TEXT := CASE
    WHEN p_status IN ('pending', 'sent', 'delivered', 'read') THEN p_status
    ELSE 'delivered'
  END;
  v_unread_count INTEGER := 0;
BEGIN
  IF p_instance_id IS NULL THEN
    RAISE EXCEPTION 'instance_id is required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF COALESCE(NULLIF(BTRIM(p_remote_jid), ''), '') = '' THEN
    RAISE EXCEPTION 'remote_jid is required';
  END IF;

  INSERT INTO conversations (
    user_id,
    instance_id,
    remote_jid,
    contact_name,
    contact_phone,
    unread_count,
    created_at
  )
  VALUES (
    p_user_id,
    p_instance_id,
    p_remote_jid,
    NULLIF(BTRIM(p_contact_name), ''),
    COALESCE(NULLIF(BTRIM(p_contact_phone), ''), p_remote_jid),
    0,
    NOW()
  )
  ON CONFLICT (instance_id, remote_jid) DO UPDATE
  SET
    contact_name = COALESCE(NULLIF(EXCLUDED.contact_name, ''), conversations.contact_name),
    contact_phone = COALESCE(NULLIF(EXCLUDED.contact_phone, ''), conversations.contact_phone)
  RETURNING id INTO v_conversation_id;

  INSERT INTO messages (
    conversation_id,
    remote_jid,
    from_me,
    message_type,
    content,
    media_url,
    status,
    provider_message_id,
    provider_payload,
    provider_timestamp,
    created_at
  )
  VALUES (
    v_conversation_id,
    p_remote_jid,
    COALESCE(p_from_me, FALSE),
    v_effective_type,
    COALESCE(p_content, ''),
    NULLIF(BTRIM(COALESCE(p_media_url, '')), ''),
    v_effective_status,
    NULLIF(BTRIM(COALESCE(p_provider_message_id, '')), ''),
    COALESCE(p_provider_payload, '{}'::JSONB),
    v_effective_created_at,
    v_effective_created_at
  )
  ON CONFLICT (conversation_id, provider_message_id) DO NOTHING
  RETURNING id INTO v_message_id;

  IF v_message_id IS NOT NULL THEN
    v_inserted := TRUE;

    IF NOT COALESCE(p_from_me, FALSE) THEN
      UPDATE conversations
      SET unread_count = COALESCE(unread_count, 0) + 1
      WHERE id = v_conversation_id;
    END IF;

    UPDATE conversations
    SET
      contact_name = COALESCE(NULLIF(BTRIM(p_contact_name), ''), contact_name),
      contact_phone = COALESCE(NULLIF(BTRIM(p_contact_phone), ''), contact_phone),
      last_message = v_effective_preview,
      last_message_at = v_effective_created_at
    WHERE id = v_conversation_id
      AND (
        last_message_at IS NULL
        OR v_effective_created_at >= last_message_at
      );
  ELSE
    SELECT id
    INTO v_message_id
    FROM messages
    WHERE conversation_id = v_conversation_id
      AND provider_message_id = NULLIF(BTRIM(COALESCE(p_provider_message_id, '')), '')
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  SELECT unread_count
  INTO v_unread_count
  FROM conversations
  WHERE id = v_conversation_id;

  RETURN JSONB_BUILD_OBJECT(
    'conversation_id', v_conversation_id,
    'message_id', v_message_id,
    'inserted', v_inserted,
    'unread_count', COALESCE(v_unread_count, 0),
    'message_preview', v_effective_preview
  );
END;
$$;

-- =============================================
-- FUNCTION: Auto-create profile on user signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );

  -- Create default funnel stages
  INSERT INTO public.funnel_stages (user_id, name, color, "order") VALUES
    (NEW.id, 'Novo', '#8B5CF6', 0),
    (NEW.id, 'Contato', '#F97316', 1),
    (NEW.id, 'Qualificado', '#3B82F6', 2),
    (NEW.id, 'Proposta', '#10B981', 3),
    (NEW.id, 'Fechado', '#EAB308', 4);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- FUNCTION: Update updated_at timestamp
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_instances_updated_at BEFORE UPDATE ON whatsapp_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pre_checkout_forms_updated_at BEFORE UPDATE ON pre_checkout_forms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pre_checkout_form_steps_updated_at BEFORE UPDATE ON pre_checkout_form_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pre_checkout_sessions_updated_at BEFORE UPDATE ON pre_checkout_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pre_checkout_answers_updated_at BEFORE UPDATE ON pre_checkout_answers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Enable Realtime for messages and conversations
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- =============================================
-- Capture Popups
-- =============================================
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
