-- =============================================
-- FlowLux - Migration V2
-- Run this in your Supabase SQL editor
-- =============================================

-- 1. Add 'archived' column to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- 2. Create media/attachments table
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'image', 'video', 'audio', 'document'
  file_url TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own media" ON media FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_media_user_id ON media(user_id);
CREATE INDEX idx_media_conversation_id ON media(conversation_id);
CREATE INDEX idx_media_file_type ON media(file_type);

-- 3. Make sure public_bucket  storage policy allows authenticated uploads
-- Go to Supabase Dashboard > Storage > public_bucket  > Policies
-- Add policy: INSERT for authenticated users
-- Add policy: SELECT for everyone (public)
-- Add policy: UPDATE for authenticated users (to allow upsert)
