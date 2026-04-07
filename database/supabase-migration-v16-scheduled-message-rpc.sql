-- =====================================================
-- FlowLux - Migration V16: Scheduled Message RPC Workflow
-- =====================================================
-- Objetivos:
-- 1. Tirar a logica de claim/validacao do n8n
-- 2. Garantir lock seguro e tentativas auditaveis
-- 3. Padronizar o fluxo de agendamentos com o modelo RPC

DROP FUNCTION IF EXISTS public.claim_next_scheduled_message();
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
    ELSIF COALESCE(trim(v_scheduled_message.message), '') = '' THEN
      v_failure_reason := 'Mensagem vazia para este agendamento.';
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
      'message', v_scheduled_message.message,
      'number', v_normalized_phone,
      'scheduled_at', v_scheduled_message.scheduled_at
    );
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.finish_scheduled_message_attempt(UUID, JSONB);
DROP FUNCTION IF EXISTS public.finish_scheduled_message_attempt(TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.finish_scheduled_message_attempt(
  p_attempt_id TEXT,
  p_provider_response JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt_id UUID;
  v_attempt scheduled_message_attempts%ROWTYPE;
  v_success BOOLEAN;
  v_failure_reason TEXT;
BEGIN
  BEGIN
    v_attempt_id := NULLIF(trim(p_attempt_id), '')::UUID;
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'attempt_id', p_attempt_id,
      'error', 'Tentativa invalida.'
    );
  END;

  IF v_attempt_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'attempt_id', p_attempt_id,
      'error', 'Tentativa invalida.'
    );
  END IF;

  SELECT *
  INTO v_attempt
  FROM scheduled_message_attempts
  WHERE id = v_attempt_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'attempt_id', p_attempt_id,
      'error', 'Tentativa nao encontrada.'
    );
  END IF;

  v_success := public.mass_message_response_is_success(COALESCE(p_provider_response, '{}'::jsonb));
  v_failure_reason := CASE
    WHEN v_success THEN NULL
    ELSE public.mass_message_response_failure_reason(COALESCE(p_provider_response, '{}'::jsonb))
  END;

  UPDATE scheduled_message_attempts
  SET status = CASE WHEN v_success THEN 'sent' ELSE 'failed' END,
      completed_at = NOW(),
      failure_reason = v_failure_reason,
      provider_response = COALESCE(p_provider_response, '{}'::jsonb)
  WHERE id = v_attempt.id;

  UPDATE scheduled_messages
  SET status = CASE WHEN v_success THEN 'sent' ELSE 'failed' END,
      claimed_at = NULL,
      sent_at = CASE WHEN v_success THEN NOW() ELSE NULL END,
      failure_reason = v_failure_reason,
      provider_response = COALESCE(p_provider_response, '{}'::jsonb)
  WHERE id = v_attempt.scheduled_message_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'scheduled_message_id', v_attempt.scheduled_message_id,
    'attempt_id', v_attempt.id,
    'success', v_success,
    'failure_reason', v_failure_reason
  );
END;
$$;
