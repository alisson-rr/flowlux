-- =============================================
-- FlowLux - Migration V27
-- Persist internal AI chat history
-- =============================================

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('home', 'form_builder')),
  form_id UUID NULL REFERENCES pre_checkout_forms(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_user_scope_created
  ON ai_chat_messages(user_id, scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_form_created
  ON ai_chat_messages(form_id, created_at DESC)
  WHERE form_id IS NOT NULL;

ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own ai chat messages" ON ai_chat_messages;
CREATE POLICY "Users can select own ai chat messages" ON ai_chat_messages
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own ai chat messages" ON ai_chat_messages;
CREATE POLICY "Users can insert own ai chat messages" ON ai_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own ai chat messages" ON ai_chat_messages;
CREATE POLICY "Users can delete own ai chat messages" ON ai_chat_messages
  FOR DELETE USING (auth.uid() = user_id);

