-- =====================================================
-- FlowLux - Migration V14: Claim Delivery Lock Fix
-- =====================================================
-- Objetivo:
-- corrigir a RPC claim_next_mass_message_delivery para evitar
-- erro de FOR UPDATE em LEFT JOIN com whatsapp_instances.

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
