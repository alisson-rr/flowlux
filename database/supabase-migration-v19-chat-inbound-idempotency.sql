-- ============================================================
-- v19 - Chat inbound v2: idempotência + persistência atômica
-- ============================================================

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_payload JSONB,
  ADD COLUMN IF NOT EXISTS provider_timestamp TIMESTAMPTZ;

-- Consolida conversas duplicadas por instância + JID antes da chave única.
WITH ranked_conversations AS (
  SELECT
    id,
    instance_id,
    remote_jid,
    FIRST_VALUE(id) OVER (
      PARTITION BY instance_id, remote_jid
      ORDER BY COALESCE(last_message_at, created_at) DESC, created_at ASC, id ASC
    ) AS keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY instance_id, remote_jid
      ORDER BY COALESCE(last_message_at, created_at) DESC, created_at ASC, id ASC
    ) AS rn
  FROM conversations
  WHERE instance_id IS NOT NULL
),
duplicate_conversations AS (
  SELECT id, keep_id
  FROM ranked_conversations
  WHERE rn > 1
)
UPDATE messages AS m
SET conversation_id = d.keep_id
FROM duplicate_conversations AS d
WHERE m.conversation_id = d.id
  AND m.conversation_id <> d.keep_id;

WITH ranked_conversations AS (
  SELECT
    id,
    instance_id,
    remote_jid,
    ROW_NUMBER() OVER (
      PARTITION BY instance_id, remote_jid
      ORDER BY COALESCE(last_message_at, created_at) DESC, created_at ASC, id ASC
    ) AS rn
  FROM conversations
  WHERE instance_id IS NOT NULL
)
DELETE FROM conversations AS c
USING ranked_conversations AS r
WHERE c.id = r.id
  AND r.rn > 1;

-- Remove mensagens duplicadas que já tenham provider_message_id.
WITH ranked_messages AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY conversation_id, provider_message_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM messages
  WHERE provider_message_id IS NOT NULL
)
DELETE FROM messages AS m
USING ranked_messages AS r
WHERE m.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_instance_remote_jid
  ON conversations(instance_id, remote_jid);

CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_conversation_provider_message_id
  ON messages(conversation_id, provider_message_id);

CREATE INDEX IF NOT EXISTS idx_conversations_instance_remote_jid
  ON conversations(instance_id, remote_jid);

CREATE INDEX IF NOT EXISTS idx_messages_provider_timestamp
  ON messages(provider_timestamp DESC);

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
