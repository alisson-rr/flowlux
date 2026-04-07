-- =====================================================
-- FlowLux - Migration V17: Scheduled Message Rich Content
-- =====================================================
-- Objetivos:
-- 1. Permitir agendar mídia com legenda
-- 2. Manter compatibilidade com agendamentos só de texto
-- 3. Expor mídia no RPC de claim para o n8n

ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS media_url TEXT;

ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS media_type TEXT;

ALTER TABLE scheduled_messages
  ADD COLUMN IF NOT EXISTS file_name TEXT;

ALTER TABLE scheduled_messages DROP CONSTRAINT IF EXISTS scheduled_messages_media_type_check;
ALTER TABLE scheduled_messages ADD CONSTRAINT scheduled_messages_media_type_check
  CHECK (media_type IS NULL OR media_type IN ('image', 'video', 'document'));

CREATE OR REPLACE FUNCTION public.claim_next_scheduled_message()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scheduled_message scheduled_messages%ROWTYPE;
  v_lead_id UUID;
  v_lead_name TEXT;
  v_lead_phone TEXT;
  v_instance_id UUID;
  v_instance_name TEXT;
  v_instance_status TEXT;
  v_normalized_phone TEXT;
  v_failure_reason TEXT;
  v_attempt scheduled_message_attempts%ROWTYPE;
BEGIN
  LOOP
    SELECT *
    INTO v_scheduled_message
    FROM scheduled_messages
    WHERE status = 'pending'
      AND deleted_at IS NULL
      AND scheduled_at <= NOW()
    ORDER BY scheduled_at ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('found', FALSE);
    END IF;

    UPDATE scheduled_messages
    SET status = 'processing',
        claimed_at = NOW(),
        last_attempt_at = NOW(),
        attempt_count = attempt_count + 1,
        failure_reason = NULL,
        provider_response = '{}'::jsonb,
        sent_at = NULL
    WHERE id = v_scheduled_message.id
    RETURNING *
    INTO v_scheduled_message;

    SELECT
      l.id,
      l.name,
      l.phone
    INTO v_lead_id, v_lead_name, v_lead_phone
    FROM leads l
    WHERE l.id = v_scheduled_message.lead_id
      AND COALESCE(l.archived, FALSE) = FALSE
      AND l.deleted_at IS NULL
    LIMIT 1;

    SELECT
      wi.id,
      wi.instance_name,
      wi.status
    INTO v_instance_id, v_instance_name, v_instance_status
    FROM whatsapp_instances wi
    WHERE wi.id = v_scheduled_message.instance_id
      AND wi.deleted_at IS NULL
    LIMIT 1;

    v_normalized_phone := public.flowlux_normalize_phone_br(v_lead_phone);
    v_failure_reason := NULL;

    IF v_lead_id IS NULL THEN
      v_failure_reason := 'Lead nao encontrado ou removido.';
    ELSIF COALESCE(trim(v_scheduled_message.message), '') = ''
          AND COALESCE(trim(v_scheduled_message.media_url), '') = '' THEN
      v_failure_reason := 'Defina uma mensagem ou anexe uma midia para o agendamento.';
    ELSIF COALESCE(trim(v_scheduled_message.media_url), '') <> ''
          AND COALESCE(trim(v_scheduled_message.media_type), '') = '' THEN
      v_failure_reason := 'A midia selecionada nao possui um tipo valido.';
    ELSIF v_instance_id IS NULL THEN
      v_failure_reason := 'Instancia de WhatsApp nao encontrada.';
    ELSIF v_instance_status <> 'connected' THEN
      v_failure_reason := 'A instancia selecionada precisa estar conectada antes do envio.';
    ELSIF v_normalized_phone IS NULL THEN
      v_failure_reason := 'Telefone do lead invalido para envio.';
    END IF;

    INSERT INTO scheduled_message_attempts (
      scheduled_message_id,
      user_id,
      lead_id,
      instance_id,
      attempt_number,
      target_phone,
      normalized_phone,
      lead_name,
      instance_name,
      status,
      attempted_at,
      completed_at,
      failure_reason,
      provider_response
    )
    VALUES (
      v_scheduled_message.id,
      v_scheduled_message.user_id,
      v_scheduled_message.lead_id,
      v_scheduled_message.instance_id,
      v_scheduled_message.attempt_count,
      COALESCE(v_lead_phone, ''),
      v_normalized_phone,
      COALESCE(v_lead_name, ''),
      v_instance_name,
      CASE WHEN v_failure_reason IS NULL THEN 'processing' ELSE 'failed' END,
      NOW(),
      CASE WHEN v_failure_reason IS NULL THEN NULL ELSE NOW() END,
      v_failure_reason,
      CASE
        WHEN v_failure_reason IS NULL THEN '{}'::jsonb
        ELSE jsonb_build_object(
          'success', FALSE,
          'source', 'validation',
          'reason', v_failure_reason
        )
      END
    )
    RETURNING *
    INTO v_attempt;

    IF v_failure_reason IS NOT NULL THEN
      UPDATE scheduled_messages
      SET status = 'failed',
          claimed_at = NULL,
          failure_reason = v_failure_reason,
          provider_response = jsonb_build_object(
            'success', FALSE,
            'source', 'validation',
            'reason', v_failure_reason
          )
      WHERE id = v_scheduled_message.id;

      CONTINUE;
    END IF;

    RETURN jsonb_build_object(
      'found', TRUE,
      'scheduled_message_id', v_scheduled_message.id,
      'attempt_id', v_attempt.id,
      'user_id', v_scheduled_message.user_id,
      'lead_id', v_scheduled_message.lead_id,
      'lead_name', COALESCE(v_lead_name, ''),
      'instance_id', v_scheduled_message.instance_id,
      'instance_name', v_instance_name,
      'message', COALESCE(v_scheduled_message.message, ''),
      'media_url', v_scheduled_message.media_url,
      'media_type', v_scheduled_message.media_type,
      'file_name', v_scheduled_message.file_name,
      'number', v_normalized_phone,
      'scheduled_at', v_scheduled_message.scheduled_at
    );
  END LOOP;
END;
$$;
