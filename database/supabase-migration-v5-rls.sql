-- =============================================
-- FlowLux - Migration V5 - RLS Policies
-- Re-enable RLS on tables that were disabled for testing
-- These policies allow:
--   1. Authenticated users to manage their own data
--   2. Service role (used by n8n and API routes) to bypass RLS
-- =============================================

-- =============================================
-- CONVERSATIONS
-- =============================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
DROP POLICY IF EXISTS "Service role full access conversations" ON conversations;

-- User policy: can only see/edit their own conversations
CREATE POLICY "Users can manage own conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

-- Service role bypasses RLS by default in Supabase, but let's be explicit
CREATE POLICY "Service role full access conversations" ON conversations
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- LEADS
-- =============================================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own leads" ON leads;
DROP POLICY IF EXISTS "Service role full access leads" ON leads;

CREATE POLICY "Users can manage own leads" ON leads
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role full access leads" ON leads
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- MASS_MESSAGES
-- =============================================
ALTER TABLE mass_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own mass messages" ON mass_messages;
DROP POLICY IF EXISTS "Service role full access mass_messages" ON mass_messages;

CREATE POLICY "Users can manage own mass messages" ON mass_messages
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role full access mass_messages" ON mass_messages
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- MESSAGES
-- =============================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own messages" ON messages;
DROP POLICY IF EXISTS "Service role full access messages" ON messages;

-- Messages are linked via conversation, not directly by user_id
-- Users can access messages from their own conversations
CREATE POLICY "Users can manage own messages" ON messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access messages" ON messages
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- SCHEDULED_MESSAGES
-- =============================================
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own scheduled messages" ON scheduled_messages;
DROP POLICY IF EXISTS "Service role full access scheduled_messages" ON scheduled_messages;

CREATE POLICY "Users can manage own scheduled messages" ON scheduled_messages
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role full access scheduled_messages" ON scheduled_messages
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- WHATSAPP_INSTANCES
-- =============================================
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "Service role full access whatsapp_instances" ON whatsapp_instances;

CREATE POLICY "Users can manage own instances" ON whatsapp_instances
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role full access whatsapp_instances" ON whatsapp_instances
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- HOTMART_WEBHOOKS (special: insert needs service role for incoming webhooks)
-- =============================================
ALTER TABLE hotmart_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own webhooks" ON hotmart_webhooks;
DROP POLICY IF EXISTS "Service role full access hotmart_webhooks" ON hotmart_webhooks;

CREATE POLICY "Users can view own webhooks" ON hotmart_webhooks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access hotmart_webhooks" ON hotmart_webhooks
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- NOTES:
-- - The SUPABASE_SERVICE_ROLE_KEY used by n8n and API routes
--   automatically gets 'service_role' role, bypassing RLS.
-- - The NEXT_PUBLIC_SUPABASE_ANON_KEY used by the frontend
--   gets 'anon' role but with auth.uid() set from the JWT.
-- - This means:
--   * Frontend: user sees only their own data (RLS enforced)
--   * n8n/API routes with SERVICE_ROLE_KEY: full access (RLS bypassed)
-- =============================================
