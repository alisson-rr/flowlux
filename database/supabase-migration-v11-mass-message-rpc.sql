-- =====================================================
-- FlowLux - Migration V11: Mass Message RPC Workflow
-- =====================================================
-- Objetivos:
-- 1. Tirar a logica pesada do n8n Code node
-- 2. Processar claim/preparo/finalizacao pelo Supabase
-- 3. Permitir workflow live mais estavel no n8n

CREATE OR REPLACE FUNCTION public.flowlux_normalize_phone_br(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_phone TEXT;
BEGIN
  v_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');

  IF v_phone = '' THEN
    RETURN NULL;
  END IF;

  IF v_phone LIKE '00%' THEN
    v_phone := substring(v_phone FROM 3);
  END IF;

  v_phone := regexp_replace(v_phone, '^0+', '');

  IF v_phone = '' THEN
    RETURN NULL;
  END IF;

  IF left(v_phone, 2) <> '55' THEN
    IF length(v_phone) IN (10, 11) THEN
      v_phone := '55' || v_phone;
    ELSE
      RETURN NULL;
    END IF;
  END IF;

  IF length(v_phone) < 12 OR length(v_phone) > 13 THEN
    RETURN NULL;
  END IF;

  RETURN v_phone;
END;
$$;

CREATE OR REPLACE FUNCTION public.mass_message_response_is_success(p_response JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    lower(COALESCE(p_response ->> 'status', '')) IN ('success', 'sent')
    OR (p_response ? 'key')
    OR (p_response ? 'messageId')
    OR COALESCE(p_response ->> 'statusCode', '') IN ('200', '201')
    OR COALESCE(p_response ->> 'code', '') IN ('200', '201'),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.mass_message_response_failure_reason(p_response JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_reason TEXT;
BEGIN
  v_reason := COALESCE(
    NULLIF(trim(p_response ->> 'message'), ''),
    NULLIF(trim(p_response ->> 'error'), ''),
    NULLIF(trim(p_response ->> 'description'), ''),
    NULLIF(trim(p_response ->> 'reason'), '')
  );

  IF v_reason IS NOT NULL THEN
    RETURN left(v_reason, 500);
  END IF;

  IF p_response IS NULL OR p_response = '{}'::jsonb THEN
    RETURN 'Falha no envio via Evolution API.';
  END IF;

  RETURN left(p_response::TEXT, 500);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_next_mass_message_campaign()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign mass_messages%ROWTYPE;
BEGIN
  SELECT *
  INTO v_campaign
  FROM mass_messages
  WHERE status = 'scheduled'
    AND deleted_at IS NULL
    AND scheduled_at IS NOT NULL
    AND scheduled_at <= NOW()
  ORDER BY scheduled_at ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;

  UPDATE mass_messages
  SET status = 'sending',
      started_at = NOW(),
      completed_at = NULL,
      last_error = NULL
  WHERE id = v_campaign.id
  RETURNING *
  INTO v_campaign;

  RETURN jsonb_build_object(
    'found', TRUE,
    'mass_id', v_campaign.id,
    'user_id', v_campaign.user_id,
    'instance_id', v_campaign.instance_id,
    'message', COALESCE(v_campaign.message, ''),
    'scheduled_at', v_campaign.scheduled_at
  );
END;
$$;

DROP FUNCTION IF EXISTS public.prepare_mass_message_campaign(UUID);
CREATE OR REPLACE FUNCTION public.prepare_mass_message_campaign(p_mass_message_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mass_message_id UUID;
  v_campaign mass_messages%ROWTYPE;
  v_instance RECORD;
  v_lead RECORD;
  v_target_tags TEXT[];
  v_target_stages TEXT[];
  v_existing_lead_ids TEXT[] := ARRAY[]::TEXT[];
  v_used_phones TEXT[] := ARRAY[]::TEXT[];
  v_normalized_phone TEXT;
  v_sent_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_total_count INTEGER := 0;
  v_pending_count INTEGER := 0;
BEGIN
  BEGIN
    v_mass_message_id := NULLIF(trim(p_mass_message_id), '')::UUID;
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'mass_id', p_mass_message_id,
      'error', 'Campanha invalida.'
    );
  END;

  IF v_mass_message_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'mass_id', p_mass_message_id,
      'error', 'Campanha invalida.'
    );
  END IF;

  SELECT *
  INTO v_campaign
  FROM mass_messages
  WHERE id = v_mass_message_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'mass_id', p_mass_message_id,
      'error', 'Campanha nao encontrada.'
    );
  END IF;

  v_target_tags := COALESCE(v_campaign.target_tags, ARRAY[]::TEXT[]);
  v_target_stages := COALESCE(v_campaign.target_stages, ARRAY[]::TEXT[]);

  SELECT instance_name, status
  INTO v_instance
  FROM whatsapp_instances
  WHERE id = v_campaign.instance_id
    AND deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    UPDATE mass_messages
    SET status = 'failed',
        completed_at = NOW(),
        last_error = 'Instancia de WhatsApp nao encontrada para esta campanha.'
    WHERE id = v_campaign.id;

    RETURN jsonb_build_object(
      'ok', FALSE,
      'mass_id', v_campaign.id,
      'error', 'Instancia de WhatsApp nao encontrada para esta campanha.'
    );
  END IF;

  IF v_instance.status <> 'connected' THEN
    UPDATE mass_messages
    SET status = 'failed',
        completed_at = NOW(),
        last_error = 'A instancia selecionada precisa estar conectada antes do disparo.'
    WHERE id = v_campaign.id;

    RETURN jsonb_build_object(
      'ok', FALSE,
      'mass_id', v_campaign.id,
      'error', 'A instancia selecionada precisa estar conectada antes do disparo.'
    );
  END IF;

  SELECT
    COALESCE(array_agg(lead_id::TEXT) FILTER (WHERE lead_id IS NOT NULL), ARRAY[]::TEXT[]),
    COALESCE(array_agg(normalized_phone) FILTER (WHERE normalized_phone IS NOT NULL AND normalized_phone <> ''), ARRAY[]::TEXT[])
  INTO v_existing_lead_ids, v_used_phones
  FROM mass_message_deliveries
  WHERE mass_message_id = v_campaign.id;

  FOR v_lead IN
    SELECT
      l.id,
      l.name,
      l.phone,
      l.stage_id::TEXT AS stage_id_text,
      COALESCE(
        array_agg(lt.tag_id::TEXT) FILTER (WHERE lt.tag_id IS NOT NULL),
        ARRAY[]::TEXT[]
      ) AS tag_ids
    FROM leads l
    LEFT JOIN lead_tags lt ON lt.lead_id = l.id
    WHERE l.user_id = v_campaign.user_id
      AND COALESCE(l.archived, FALSE) = FALSE
      AND l.deleted_at IS NULL
    GROUP BY l.id
    ORDER BY l.created_at ASC, l.id ASC
  LOOP
    IF array_length(v_target_tags, 1) IS NOT NULL
       AND array_length(v_target_tags, 1) > 0
       AND NOT EXISTS (
         SELECT 1
         FROM unnest(v_target_tags) AS tag_id
         WHERE tag_id = ANY(COALESCE(v_lead.tag_ids, ARRAY[]::TEXT[]))
       ) THEN
      CONTINUE;
    END IF;

    IF array_length(v_target_stages, 1) IS NOT NULL
       AND array_length(v_target_stages, 1) > 0
       AND COALESCE(v_lead.stage_id_text, '') <> ALL(v_target_stages) THEN
      CONTINUE;
    END IF;

    IF v_lead.id::TEXT = ANY(v_existing_lead_ids) THEN
      CONTINUE;
    END IF;

    v_normalized_phone := public.flowlux_normalize_phone_br(v_lead.phone);

    IF v_normalized_phone IS NULL THEN
      INSERT INTO mass_message_deliveries (
        mass_message_id,
        user_id,
        lead_id,
        instance_id,
        lead_name,
        lead_phone,
        normalized_phone,
        remote_jid,
        status,
        failure_reason
      )
      VALUES (
        v_campaign.id,
        v_campaign.user_id,
        v_lead.id,
        v_campaign.instance_id,
        COALESCE(v_lead.name, ''),
        COALESCE(v_lead.phone, ''),
        '',
        NULL,
        'failed',
        'Telefone invalido para disparo em massa.'
      )
      ON CONFLICT (mass_message_id, lead_id) DO NOTHING;

      v_existing_lead_ids := array_append(v_existing_lead_ids, v_lead.id::TEXT);
      CONTINUE;
    END IF;

    IF v_normalized_phone = ANY(v_used_phones) THEN
      INSERT INTO mass_message_deliveries (
        mass_message_id,
        user_id,
        lead_id,
        instance_id,
        lead_name,
        lead_phone,
        normalized_phone,
        remote_jid,
        status,
        failure_reason
      )
      VALUES (
        v_campaign.id,
        v_campaign.user_id,
        v_lead.id,
        v_campaign.instance_id,
        COALESCE(v_lead.name, ''),
        COALESCE(v_lead.phone, ''),
        v_normalized_phone,
        v_normalized_phone || '@s.whatsapp.net',
        'skipped',
        'Numero duplicado dentro da campanha.'
      )
      ON CONFLICT (mass_message_id, lead_id) DO NOTHING;

      v_existing_lead_ids := array_append(v_existing_lead_ids, v_lead.id::TEXT);
      CONTINUE;
    END IF;

    INSERT INTO mass_message_deliveries (
      mass_message_id,
      user_id,
      lead_id,
      instance_id,
      lead_name,
      lead_phone,
      normalized_phone,
      remote_jid,
      status,
      failure_reason
    )
    VALUES (
      v_campaign.id,
      v_campaign.user_id,
      v_lead.id,
      v_campaign.instance_id,
      COALESCE(v_lead.name, ''),
      COALESCE(v_lead.phone, ''),
      v_normalized_phone,
      v_normalized_phone || '@s.whatsapp.net',
      'pending',
      NULL
    )
    ON CONFLICT (mass_message_id, lead_id) DO NOTHING;

    v_existing_lead_ids := array_append(v_existing_lead_ids, v_lead.id::TEXT);
    v_used_phones := array_append(v_used_phones, v_normalized_phone);
  END LOOP;

  SELECT
    COUNT(*) FILTER (WHERE status = 'sent'),
    COUNT(*) FILTER (WHERE status IN ('failed', 'skipped')),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'pending')
  INTO v_sent_count, v_failed_count, v_total_count, v_pending_count
  FROM mass_message_deliveries
  WHERE mass_message_id = v_campaign.id;

  UPDATE mass_messages
  SET sent_count = v_sent_count,
      failed_count = v_failed_count,
      total_count = v_total_count,
      last_error = CASE WHEN v_total_count = 0 THEN 'Nenhum contato elegivel encontrado para o disparo.' ELSE NULL END
  WHERE id = v_campaign.id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'mass_id', v_campaign.id,
    'instance_name', v_instance.instance_name,
    'message', COALESCE(v_campaign.message, ''),
    'pending_count', v_pending_count,
    'total_count', v_total_count
  );
END;
$$;

DROP FUNCTION IF EXISTS public.claim_next_mass_message_delivery(UUID);
CREATE OR REPLACE FUNCTION public.claim_next_mass_message_delivery(p_mass_message_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mass_message_id UUID;
  v_delivery RECORD;
  v_updated_delivery mass_message_deliveries%ROWTYPE;
BEGIN
  BEGIN
    v_mass_message_id := NULLIF(trim(p_mass_message_id), '')::UUID;
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object(
      'found', FALSE,
      'mass_id', p_mass_message_id,
      'error', 'Campanha invalida.'
    );
  END;

  IF v_mass_message_id IS NULL THEN
    RETURN jsonb_build_object(
      'found', FALSE,
      'mass_id', p_mass_message_id,
      'error', 'Campanha invalida.'
    );
  END IF;

  SELECT
    d.*,
    m.message,
    wi.instance_name
  INTO v_delivery
  FROM mass_message_deliveries d
  INNER JOIN mass_messages m ON m.id = d.mass_message_id
  LEFT JOIN whatsapp_instances wi ON wi.id = d.instance_id
  WHERE d.mass_message_id = v_mass_message_id
    AND d.status = 'pending'
  ORDER BY d.created_at ASC
  FOR UPDATE OF d SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'found', FALSE,
      'mass_id', v_mass_message_id
    );
  END IF;

  UPDATE mass_message_deliveries
  SET status = 'sending',
      attempt_count = attempt_count + 1,
      last_attempt_at = NOW(),
      failure_reason = NULL
  WHERE id = v_delivery.id
  RETURNING *
  INTO v_updated_delivery;

  RETURN jsonb_build_object(
    'found', TRUE,
    'mass_id', v_mass_message_id,
    'delivery_id', v_updated_delivery.id,
    'lead_id', v_updated_delivery.lead_id,
    'lead_name', v_updated_delivery.lead_name,
    'lead_phone', v_updated_delivery.lead_phone,
    'number', v_updated_delivery.normalized_phone,
    'attempt_count', v_updated_delivery.attempt_count,
    'instance_name', COALESCE(v_delivery.instance_name, ''),
    'message', COALESCE(v_delivery.message, '')
  );
END;
$$;

DROP FUNCTION IF EXISTS public.finish_mass_message_delivery_attempt(UUID, JSONB);
CREATE OR REPLACE FUNCTION public.finish_mass_message_delivery_attempt(
  p_delivery_id TEXT,
  p_provider_response JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery_id UUID;
  v_delivery mass_message_deliveries%ROWTYPE;
  v_is_success BOOLEAN;
  v_failure_reason TEXT;
BEGIN
  BEGIN
    v_delivery_id := NULLIF(trim(p_delivery_id), '')::UUID;
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'Entrega invalida.'
    );
  END;

  IF v_delivery_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'Entrega invalida.'
    );
  END IF;

  SELECT *
  INTO v_delivery
  FROM mass_message_deliveries
  WHERE id = v_delivery_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'error', 'Entrega nao encontrada.'
    );
  END IF;

  v_is_success := public.mass_message_response_is_success(COALESCE(p_provider_response, '{}'::JSONB));
  v_failure_reason := CASE
    WHEN v_is_success THEN NULL
    ELSE public.mass_message_response_failure_reason(COALESCE(p_provider_response, '{}'::JSONB))
  END;

  UPDATE mass_message_deliveries
  SET status = CASE WHEN v_is_success THEN 'sent' ELSE 'failed' END,
      sent_at = CASE WHEN v_is_success THEN NOW() ELSE NULL END,
      failure_reason = v_failure_reason,
      provider_response = COALESCE(p_provider_response, '{}'::JSONB)
  WHERE id = v_delivery.id
  RETURNING *
  INTO v_delivery;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'mass_id', v_delivery.mass_message_id,
    'delivery_id', v_delivery.id,
    'delivery_status', v_delivery.status,
    'failure_reason', v_delivery.failure_reason
  );
END;
$$;

DROP FUNCTION IF EXISTS public.finalize_mass_message_campaign(UUID);
CREATE OR REPLACE FUNCTION public.finalize_mass_message_campaign(p_mass_message_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mass_message_id UUID;
  v_sent_count INTEGER := 0;
  v_failed_count INTEGER := 0;
  v_total_count INTEGER := 0;
  v_pending_count INTEGER := 0;
  v_sending_count INTEGER := 0;
  v_last_error TEXT;
  v_status TEXT;
BEGIN
  BEGIN
    v_mass_message_id := NULLIF(trim(p_mass_message_id), '')::UUID;
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'mass_id', p_mass_message_id,
      'error', 'Campanha invalida.'
    );
  END;

  IF v_mass_message_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'mass_id', p_mass_message_id,
      'error', 'Campanha invalida.'
    );
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status = 'sent'),
    COUNT(*) FILTER (WHERE status IN ('failed', 'skipped')),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'sending'),
    (
      SELECT failure_reason
      FROM mass_message_deliveries
      WHERE mass_message_id = v_mass_message_id
        AND failure_reason IS NOT NULL
        AND failure_reason <> ''
      ORDER BY created_at ASC
      LIMIT 1
    )
  INTO v_sent_count, v_failed_count, v_total_count, v_pending_count, v_sending_count, v_last_error
  FROM mass_message_deliveries
  WHERE mass_message_id = v_mass_message_id;

  IF v_pending_count > 0 OR v_sending_count > 0 THEN
    RETURN jsonb_build_object(
      'ok', TRUE,
      'mass_id', v_mass_message_id,
      'status', 'sending',
      'sent_count', v_sent_count,
      'failed_count', v_failed_count,
      'total_count', v_total_count,
      'pending_count', v_pending_count,
      'sending_count', v_sending_count
    );
  END IF;

  IF v_total_count = 0 THEN
    v_status := 'failed';
    v_last_error := COALESCE(v_last_error, 'Nenhum contato elegivel encontrado para o disparo.');
  ELSIF v_failed_count > 0 THEN
    IF v_sent_count > 0 THEN
      v_status := 'completed_with_errors';
    ELSE
      v_status := 'failed';
    END IF;
  ELSE
    v_status := 'completed';
    v_last_error := NULL;
  END IF;

  UPDATE mass_messages
  SET status = v_status,
      sent_count = v_sent_count,
      failed_count = v_failed_count,
      total_count = v_total_count,
      completed_at = NOW(),
      last_error = v_last_error
  WHERE id = v_mass_message_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'mass_id', v_mass_message_id,
    'status', v_status,
    'sent_count', v_sent_count,
    'failed_count', v_failed_count,
    'total_count', v_total_count,
    'last_error', v_last_error
  );
END;
$$;
